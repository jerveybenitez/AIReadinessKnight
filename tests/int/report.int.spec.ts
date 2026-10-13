import { describe, expect, it, vi } from 'vitest'

import { fallbackReport, validateReport, type ReportInput } from '@/game/report'
import {
  buildSystemMessage,
  buildUserMessage,
  extractJsonObject,
  parseReportContent,
  qwenConfig,
  requestQwenReport,
  type PromptInput,
} from '@/game/report-server'

/**
 * M7 — the QWEN report pipeline, tested entirely against stubs and dead ports (qwen-report skill:
 * "Do not hit a live endpoint in CI"). The fallback is the default local experience, so it gets
 * first-class coverage here.
 */

const VALID: Record<string, unknown> = {
  headline: 'Acme is closer than it thinks',
  summary: 'The foundations exist. Execution is uneven. One focused quarter would change this.',
  strengths: ['Archery holds'],
  gaps: ['Boxing lags'],
  nextSteps: [{ title: 'Do a thing', detail: 'In some detail, concretely.', horizon: 'now' }],
}

const prompt: PromptInput = {
  companyName: 'Acme',
  industry: 'fintech',
  finalMean: '2.0',
  finalBand: 'average',
  sections: [{ name: 'Archery', mean: '2.0', band: '1-2.9', questions: [{ question: 'Q?', answer: 'A.' }] }],
}

const config = { baseUrl: 'http://qwen.test/v1', apiKey: 'secret-key', model: 'test-model', disableThinking: true }

const okResponse = (content: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('validateReport', () => {
  it('accepts a well-formed report and returns a fresh object', () => {
    const report = validateReport(VALID)
    expect(report).not.toBeNull()
    expect(report?.headline).toBe('Acme is closer than it thinks')
    expect(report?.nextSteps).toHaveLength(1)
  })

  it('drops unknown fields instead of passing them through', () => {
    const report = validateReport({ ...VALID, extra: 'ignore me', scores: 42 })
    expect(report).not.toBeNull()
    expect(Object.keys(report ?? {}).sort()).toEqual(['gaps', 'headline', 'nextSteps', 'strengths', 'summary'])
  })

  it('clamps over-delivery to the documented caps', () => {
    const report = validateReport({
      ...VALID,
      strengths: ['a', 'b', 'c', 'd', 'e'],
      nextSteps: Array.from({ length: 7 }, (_, i) => ({
        title: `t${i}`,
        detail: 'd',
        horizon: '90-days',
      })),
    })
    expect(report?.strengths).toHaveLength(3)
    expect(report?.nextSteps).toHaveLength(5)
  })

  it('allows empty strengths — an all-weak company has none', () => {
    const report = validateReport({ ...VALID, strengths: [], gaps: [] })
    expect(report?.strengths).toEqual([])
  })

  it('rejects missing or malformed fields', () => {
    expect(validateReport(null)).toBeNull()
    expect(validateReport([])).toBeNull()
    expect(validateReport('text')).toBeNull()
    expect(validateReport({ ...VALID, headline: undefined })).toBeNull()
    expect(validateReport({ ...VALID, summary: 42 })).toBeNull()
    expect(validateReport({ ...VALID, headline: '   ' })).toBeNull()
    expect(validateReport({ ...VALID, strengths: 'not a list' })).toBeNull()
    expect(validateReport({ ...VALID, strengths: ['ok', 7] })).toBeNull()
    expect(validateReport({ ...VALID, nextSteps: [] })).toBeNull()
    expect(validateReport({ ...VALID, nextSteps: [{ title: 't', detail: 'd', horizon: 'someday' }] })).toBeNull()
  })
})

describe('extractJsonObject', () => {
  it('passes plain JSON through', () => {
    expect(extractJsonObject('{"a": 1}')).toBe('{"a": 1}')
  })

  it('strips markdown fences', () => {
    expect(extractJsonObject('```json\n{"a": 1}\n```')).toBe('{"a": 1}')
    expect(extractJsonObject('```\n{"a": 1}\n```')).toBe('{"a": 1}')
  })

  it('finds the object inside surrounding prose', () => {
    expect(extractJsonObject('Here you go: {"a": 1} Hope this helps!')).toBe('{"a": 1}')
  })

  it('returns null when there is no object', () => {
    expect(extractJsonObject('no json here')).toBeNull()
  })

  it('leaves an empty object to shape validation', () => {
    // Extraction only finds candidate JSON text; the empty object is caught by
    // validateReport as invalid-shape (a more diagnosable reason than malformed-json).
    expect(extractJsonObject('{}')).toBe('{}')
    expect(parseReportContent('{}')).toEqual({ report: null, reason: 'invalid-shape' })
  })
})

describe('parseReportContent', () => {
  it('parses fenced JSON with the exact report shape', () => {
    const parsed = parseReportContent('```json\n' + JSON.stringify(VALID) + '\n```')
    expect(parsed.report?.headline).toBe(VALID.headline)
  })

  it('treats truncated JSON as malformed', () => {
    expect(parseReportContent('{"headline": "x", "summary": "y"').reason).toBe('malformed-json')
  })

  it('treats valid JSON with the wrong shape as invalid', () => {
    expect(parseReportContent('{"hello": "world"}').reason).toBe('invalid-shape')
  })

  it('treats missing content as malformed', () => {
    expect(parseReportContent(undefined).reason).toBe('malformed-json')
    expect(parseReportContent('   ').reason).toBe('malformed-json')
  })
})

const input = (companyName: string, industry: string, means: [number, number, number]): ReportInput => {
  const keys = ['archery', 'boxing', 'swordsmanship'] as const
  const names = ['Archery skills', 'Boxing skills', 'Sword skills']
  return {
    companyName,
    industry,
    finalMean: means.reduce((a, b) => a + b, 0) / 3,
    finalBand: (means.reduce((a, b) => a + b, 0) / 3 >= 2.9
      ? 'high_average'
      : means.reduce((a, b) => a + b, 0) / 3 >= 1.7
        ? 'average'
        : 'low_average') as ReportInput['finalBand'],
    sections: means.map((mean, index) => ({
      key: keys[index],
      name: names[index],
      mean,
      band: (mean >= 3 ? '3-4' : mean >= 1 ? '1-2.9' : '0-0.9') as ReportInput['sections'][number]['band'],
    })),
  }
}

describe('fallbackReport', () => {
  it('is deterministic — two calls are deep-equal', () => {
    const source = input('Acme', 'fintech', [4, 2, 1])
    expect(fallbackReport(source)).toEqual(fallbackReport(source))
  })

  it('writes a high_average report with strengths, gaps and next steps', () => {
    const report = fallbackReport(input('Acme', 'fintech', [4, 3, 2]))
    expect(report.headline).toContain('Acme')
    expect(report.summary).toContain('in the fintech space')
    expect(report.summary).toContain('3.0/4')
    expect(report.strengths).toHaveLength(2) // the two 3-4 sections, strongest first
    expect(report.strengths[0]).toContain('Archery')
    expect(report.gaps.join(' ')).toContain('Sword skills')
    expect(report.nextSteps.length).toBeGreaterThanOrEqual(3)
  })

  it('lines the gaps up weakest first for an average run', () => {
    const report = fallbackReport(input('Beta Co', '', [4, 2, 1]))
    expect(report.gaps).toHaveLength(2)
    expect(report.gaps[0]).toContain('Sword skills') // mean 1
    expect(report.gaps[1]).toContain('Boxing') // mean 2
    expect(report.summary).toContain('Beta Co')
    expect(report.summary).not.toContain(' in the ') // no industry → no phrase
  })

  it('writes a low_average report that reads as a real report', () => {
    const report = fallbackReport(input('Gamma Ltd', 'retail', [0, 1, 0]))
    expect(report.headline).toContain('Gamma Ltd')
    expect(report.strengths).toEqual([]) // no section reached 3-4
    expect(report.gaps).toHaveLength(3)
    expect(report.nextSteps[0].title).toBe('Pick one flagship use case')
    expect(report.nextSteps[0].detail).toContain('Archery') // weakest first; ties keep canonical order
  })

  it('only ever emits valid horizons', () => {
    for (const means of [
      [4, 4, 4],
      [2, 2, 2],
      [0, 0, 0],
    ] as Array<[number, number, number]>) {
      for (const step of fallbackReport(input('X', '', means)).nextSteps) {
        expect(['now', '90-days', '12-months']).toContain(step.horizon)
      }
    }
  })
})

describe('qwenConfig', () => {
  it('trims values and strips trailing slashes from the base URL', () => {
    const parsed = qwenConfig({ QWEN_BASE_URL: ' http://x.test/v1/// ', QWEN_API_KEY: ' k ', QWEN_MODEL: ' m ' })
    expect(parsed).toEqual({ baseUrl: 'http://x.test/v1', apiKey: 'k', model: 'm', disableThinking: false })
  })

  it('treats blank values as missing, not as errors', () => {
    expect(qwenConfig({})).toEqual({ baseUrl: null, apiKey: '', model: null, disableThinking: false })
    expect(qwenConfig({ QWEN_BASE_URL: '   ', QWEN_API_KEY: '' })).toEqual({
      baseUrl: null,
      apiKey: '',
      model: null,
      disableThinking: false,
    })
  })

  it('reads the thinking knob only from truthy values', () => {
    expect(qwenConfig({ QWEN_DISABLE_THINKING: 'true' }).disableThinking).toBe(true)
    expect(qwenConfig({ QWEN_DISABLE_THINKING: '1' }).disableThinking).toBe(true)
    expect(qwenConfig({ QWEN_DISABLE_THINKING: 'YES' }).disableThinking).toBe(true)
    expect(qwenConfig({ QWEN_DISABLE_THINKING: 'false' }).disableThinking).toBe(false)
    expect(qwenConfig({ QWEN_DISABLE_THINKING: '' }).disableThinking).toBe(false)
  })
})

describe('requestQwenReport', () => {
  it('returns missing-config without calling fetch when the URL or model is absent', async () => {
    const fetchImpl = vi.fn()
    const attempt = await requestQwenReport(prompt, { systemPrompt: '', tone: '', guidance: '' }, {
      baseUrl: null,
      apiKey: '',
      model: 'm',
      disableThinking: false,
    }, { fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(attempt).toEqual({ ok: false, reason: 'missing-config' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('sends enable_thinking only when the config asks for it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify(VALID)))
    await requestQwenReport(prompt, { systemPrompt: '', tone: '', guidance: '' }, config, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const withKnob = JSON.parse(fetchImpl.mock.calls[0][1].body as string)
    expect(withKnob.enable_thinking).toBe(false)

    const offImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify(VALID)))
    await requestQwenReport(prompt, { systemPrompt: '', tone: '', guidance: '' }, { ...config, disableThinking: false }, {
      fetchImpl: offImpl as unknown as typeof fetch,
    })
    const withoutKnob = JSON.parse(offImpl.mock.calls[0][1].body as string)
    expect('enable_thinking' in withoutKnob).toBe(false)
  })

  it('sends no Authorization header when the key is blank (normal locally)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify(VALID)))
    await requestQwenReport(prompt, { systemPrompt: '', tone: '', guidance: '' }, { ...config, apiKey: '' }, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const headers = fetchImpl.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it('returns the validated report on a clean response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify(VALID)))
    const attempt = await requestQwenReport(prompt, { systemPrompt: '', tone: '', guidance: '' }, config, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(attempt.ok && attempt.report.headline).toBe(VALID.headline as string)
    const headers = fetchImpl.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer secret-key')
  })

  it('accepts fenced JSON from the model', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse('```json\n' + JSON.stringify(VALID) + '\n```'))
    const attempt = await requestQwenReport(prompt, { systemPrompt: '', tone: '', guidance: '' }, config, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(attempt.ok).toBe(true)
  })

  it('retries once on 429 and succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(okResponse(JSON.stringify(VALID)))
    const attempt = await requestQwenReport(prompt, { systemPrompt: '', tone: '', guidance: '' }, config, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryDelayMs: 1,
    })
    expect(attempt.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('does not retry a 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('nope', { status: 401 }))
    const attempt = await requestQwenReport(prompt, { systemPrompt: '', tone: '', guidance: '' }, config, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryDelayMs: 1,
    })
    expect(attempt).toEqual({ ok: false, reason: 'http-401' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('gives up after one retry on persistent 500s', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }))
    const attempt = await requestQwenReport(prompt, { systemPrompt: '', tone: '', guidance: '' }, config, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryDelayMs: 1,
    })
    expect(attempt).toEqual({ ok: false, reason: 'http-500' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('maps a connection failure to network-error after the retry', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    const attempt = await requestQwenReport(prompt, { systemPrompt: '', tone: '', guidance: '' }, config, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryDelayMs: 1,
    })
    expect(attempt).toEqual({ ok: false, reason: 'network-error' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('maps an abort to timeout', async () => {
    const fetchImpl = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError')),
          )
        }),
    )
    const attempt = await requestQwenReport(prompt, { systemPrompt: '', tone: '', guidance: '' }, config, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 10,
      retryDelayMs: 1,
    })
    expect(attempt).toEqual({ ok: false, reason: 'timeout' })
  })

  it('treats unparseable content as malformed-json without retrying', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse('Not JSON at all.'))
    const attempt = await requestQwenReport(prompt, { systemPrompt: '', tone: '', guidance: '' }, config, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryDelayMs: 1,
    })
    expect(attempt).toEqual({ ok: false, reason: 'malformed-json' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('treats a wrong shape as invalid-shape without retrying', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify({ hello: 'world' })))
    const attempt = await requestQwenReport(prompt, { systemPrompt: '', tone: '', guidance: '' }, config, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryDelayMs: 1,
    })
    expect(attempt).toEqual({ ok: false, reason: 'invalid-shape' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('falls back cleanly against a dead endpoint (the default local state)', async () => {
    const attempt = await requestQwenReport(
      prompt,
      { systemPrompt: '', tone: '', guidance: '' },
      { baseUrl: 'http://127.0.0.1:59999/v1', apiKey: '', model: 'none', disableThinking: false },
      { timeoutMs: 2000, retryDelayMs: 1 },
    )
    expect(attempt).toEqual({ ok: false, reason: 'network-error' })
  })
})

describe('prompt messages', () => {
  it('carries the mode system prompt, tone and the output contract', () => {
    const message = buildSystemMessage({ systemPrompt: 'You advise leaders.', tone: 'Direct.', guidance: 'Be brief.' })
    expect(message).toContain('You advise leaders.')
    expect(message).toContain('Tone: Direct.')
    expect(message).toContain('single JSON object')
  })

  it('carries the company, every section and the chosen answer text', () => {
    const message = buildUserMessage({
      companyName: 'Acme',
      industry: 'fintech',
      finalMean: '2.0',
      finalBand: 'average',
      sections: [{ name: 'Archery', mean: '2.0', band: '1-2.9', questions: [{ question: 'Q?', answer: 'A.' }] }],
    })
    expect(message).toContain('Company: Acme')
    expect(message).toContain('Industry: fintech')
    expect(message).toContain('## Archery — mean 2.0 / 4 (band 1-2.9)')
    expect(message).toContain('Q: Q?')
    expect(message).toContain('Answer: A.')
  })
})
