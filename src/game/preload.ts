import type { ResolvedMode, ResolvedSection } from './types'

/**
 * M14 asset loading — one module owns every "fetch art before it is needed" decision.
 *
 * Two beats, per QODER.md §3.8:
 *
 * - `blocking` — title + intake + section 1. The loading screen gates on these URLs completing
 *   (successfully or not), with a hard timeout that starts the game anyway (GameShell).
 * - The rest of the mode prefetches *during* play (`prefetchFromSection`): the current section's
 *   end-screen extras and every later section fire while the player answers; results fire during
 *   the last section. A scene transition never waits on the network.
 *
 * All requests go through one module-level Set, so the gate, the prefetch batches and the browser
 * itself can never double-fetch: the first requester wins, everyone else reuses the in-flight
 * image. Music is deliberately NOT here (M14: loops stay out of the blocking preload).
 *
 * Progress is honest (§3.8): the gate counts real completions — both `load` and `error` settle a
 * URL, so a dead asset advances the bar and the timeout only covers assets that never answer.
 */

export interface PreloadPlan {
  /** URLs behind the loading screen: title art + section 1's question scene. */
  blocking: string[]
  /** Every non-blocking URL per section (end-beat extras + later scenes' slots), canonical order. */
  sectionRest: string[][]
  /** Results screen: background + all three final knights. */
  results: string[]
}

const planCache = new WeakMap<ResolvedMode, PreloadPlan>()

const push = (list: string[], url: string | null) => {
  if (url) list.push(url)
}

function sectionUrls(section: ResolvedSection): string[] {
  const urls: string[] = []
  push(urls, section.assets.background)
  for (const pose of ['idle', 'attack', 'celebrate', 'fail'] as const) push(urls, section.assets.knight[pose])
  // target.hover reuses target.idle — one URL covers both.
  push(urls, section.assets.target.idle)
  push(urls, section.assets.target.hit)
  push(urls, section.assets.projectile)
  push(urls, section.assets.hitEffect)
  for (const band of Object.values(section.sectionAnimation)) push(urls, band.asset)
  return urls
}

export function preloadPlan(mode: ResolvedMode): PreloadPlan {
  const cached = planCache.get(mode)
  if (cached) return cached

  const first = mode.sections[0]
  const blocking: string[] = []
  if (first) {
    // The first question scene, exactly what QuestionScene renders for section 1 (the attack beat
    // sprites included — the first answer fires within seconds of the gate opening).
    push(blocking, first.assets.background)
    push(blocking, first.assets.knight.idle)
    push(blocking, first.assets.knight.attack)
    push(blocking, first.assets.target.idle)
    push(blocking, first.assets.target.hit)
    push(blocking, first.assets.projectile)
    push(blocking, first.assets.hitEffect)
  }
  push(blocking, mode.titleScreen.background)
  push(blocking, mode.titleScreen.logo)

  // sectionRest keeps canonical section order and drops anything already blocking.
  const seen = new Set(blocking)
  const sectionRest = mode.sections.map((section) => {
    const urls = sectionUrls(section).filter((url) => !seen.has(url) && !seen.add(url))
    return urls
  })
  const results = [mode.results.background, ...Object.values(mode.results.finalKnight)].filter(
    (url): url is string => typeof url === 'string' && !seen.has(url) && !seen.add(url),
  )

  const plan: PreloadPlan = { blocking, sectionRest, results }
  planCache.set(mode, plan)
  return plan
}

// ---- fetching -----------------------------------------------------------------------------------

// One shared in-flight request per URL. React strict mode double-runs the GameShell effect in
// dev: a boolean "already asked" Set would let the second run resolve instantly while the first
// run's images are still streaming — the gate would open early and the pop-in M14 exists to
// prevent would come back. Awaiting the SAME promise keeps every caller honest.
const inflight = new Map<string, Promise<void>>()

function loadImage(url: string): Promise<void> {
  const existing = inflight.get(url)
  if (existing) return existing
  const promise = new Promise<void>((resolve) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = url
  })
  inflight.set(url, promise)
  return promise
}

/** Fire-and-forget warm of a URL via the same code path the scenes use (`new Image()`). */
function fetchImage(url: string): void {
  void loadImage(url)
}

/**
 * The blocking preload behind the loading screen. `onProgress` fires after EVERY completion
 * (success or error) with the running count — the bar reflects real request completions, never a
 * timer. Resolves when all URLs have actually settled.
 */
export function preloadBlocking(plan: PreloadPlan, onProgress: (done: number, total: number) => void): Promise<void> {
  const urls = [...new Set(plan.blocking)]
  let done = 0
  onProgress(0, urls.length)
  return Promise.all(
    urls.map((url) =>
      loadImage(url).then(() => {
        done += 1
        onProgress(done, urls.length)
      }),
    ),
  ).then(() => {})
}

/**
 * Everything the player will need from `sectionIndex` onward, nearest-first: this section's
 * end-screen extras, then each later section in canonical order, then results when the last
 * section is in flight (QODER.md M14(d)). Idempotent — safe on every question mount.
 */
export function prefetchFromSection(mode: ResolvedMode, sectionIndex: number): void {
  const plan = preloadPlan(mode)
  const queue: string[] = []
  for (let i = sectionIndex; i < plan.sectionRest.length; i += 1) queue.push(...plan.sectionRest[i])
  if (sectionIndex >= mode.sections.length - 1) queue.push(...plan.results)
  for (const url of queue) fetchImage(url)
}
