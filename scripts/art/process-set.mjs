// M8 full-set pass — turn every raw generation in vibe_images/ into game-ready @2x sprites in
// art/default/** (the committed source-of-record for the default mode's assets).
//
// Pipeline (docs/art-prompts.md): key the flat backdrop with a border-connected flood fill using
// per-file adaptive channel limits (the raws' backdrops sit between 239 and 255, so a fixed 245
// would leave several sheets unkeyed — limits = clamp(border median − 7, 236, 248)); erode the
// anti-aliased halo (fringe 224); punch enclosed backdrop pockets (bow loop, string triangle,
// letter counters) by area; remove the arrow's warm speed-smoke via the tint-based pass; trim to
// the alpha bbox; place on the slot's @2x canvas matching the in-game render box (game.css).
//
// Scale discipline: every knight pose in the set shares one body scale. Raws differ in resolution
// (1536×1024 and 1264×848 halves), so the global constant K = min over poses of (fit × rawHeight)
// is computed first — a per-sheet factor of K / rawHeight reproduces the approved archery sample
// exactly (545/1024 = 0.532) and calibrates every other sheet so the knight renders the same size
// in all three sections. Target idle/hit pairs share their pair's min fit; final knights, beats,
// logo and effects are fitted individually (only one of each ever renders per run).
//
// Also renders 4 review images into docs/art-sample/ (game-geometry frames + pose/state strips).
//
// Run from the repo root:  node scripts/art/process-set.mjs

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const RAW = path.join(ROOT, 'vibe_images')
const OUT = path.join(ROOT, 'art', 'default')
const REVIEW = path.join(ROOT, 'docs', 'art-sample')

const KNIGHT = { w: 600, h: 520, margin: 2 }
const TARGET = { w: 400, h: 400, margin: 4 }
const EFFECT = { w: 400, h: 400, margin: 2 }
const ARROW = { w: 240, h: 68 }
const BEAT = { w: 720, h: 340, margin: 6 }
const FINAL = { w: 264, h: 264, margin: 4 }
const LOGO = { w: 680, h: 240, margin: 4 }

const FRINGE = 224 // soft halo threshold just outside every outline (proven on the sample)
const HOLE_WHITE = 242 // enclosed pockets are slightly darker than the flat backdrop
const HOLE_MIN_AREA = 100 // measured on the sample: real pockets >= 149px, art whites <= 50px
const HOLE_FRINGE = 240
const WARM_MEAN = 215 // ...and the arrow's cream speed-smoke (tint-based; feather whites are cool)
const WARM_TINT = 4

// ---- inputs -----------------------------------------------------------------------------------

const BACKGROUNDS = [
  { dir: 'title', file: 'background-title-golden_1791876808248_984e5c23.png' },
  { dir: 'results', file: 'background-results-evening_1791876818810_3e7b7943.png' },
  { dir: 'archery', file: 'background-sample_1791875999081_445ec048.png' },
  { dir: 'boxing', file: 'background-boxing-v2_1791877934826_b64079b0.png' },
  { dir: 'swordsmanship', file: 'background-sword-v2_1791877946320_66dfa187.png' },
]

const KNIGHT_SHEETS = [
  { section: 'archery', file: 'knight-sheet-sample_1791875982453_3fc7f3a1.png', poses: ['idle', 'attack'] },
  { section: 'archery', file: 'knight-archery-celebrate-fail_1791876638058_097092da.png', poses: ['celebrate', 'fail'] },
  { section: 'boxing', file: 'knight-boxing-idle-attack_1791876647317_6b12764f.png', poses: ['idle', 'attack'] },
  { section: 'boxing', file: 'knight-boxing-celebrate-fail_1791876661992_7dfe5588.png', poses: ['celebrate', 'fail'] },
  { section: 'swordsmanship', file: 'knight-sword-idle-attack_1791876679574_fc9ef0bf.png', poses: ['idle', 'attack'] },
  { section: 'swordsmanship', file: 'knight-sword-celebrate-fail_1791876702039_08dde64a.png', poses: ['celebrate', 'fail'] },
]

const TARGETS = [
  { section: 'archery', parts: [
    { state: 'idle', file: 'target-idle-sample_1791875990527_7c37dd3d.png' },
    { state: 'hit', file: 'target-archery-hit-v2_1791877196318_3358003e.png' },
  ] },
  { section: 'boxing', sheet: 'target-boxing-bag-idle-hit_1791876740355_698c8669.png', states: ['idle', 'hit'] },
  { section: 'swordsmanship', sheet: 'target-sword-dummy-idle-hit_1791876756204_9c5b5805.png', states: ['idle', 'hit'] },
]

const ARROW_RAW = 'arrow-sample_1791876008288_1f8a598c.png'

const EFFECTS = [
  { section: 'archery', file: 'hiteffect-archery_1791876902512_86da61a3.png' },
  { section: 'boxing', file: 'hiteffect-boxing_1791876912203_ed6e3846.png' },
  { section: 'swordsmanship', file: 'hiteffect-sword_1791876928637_2b6f5ef0.png' },
]

const BEATS = [
  { section: 'archery', band: '3-4', file: 'beat-archery-high-v2_1791877213389_142595f1.png' },
  { section: 'archery', band: '1-2.9', file: 'beat-archery-mid-v2_1791877227286_b2d06b3f.png' },
  { section: 'archery', band: '0-0.9', file: 'beat-archery-low-v2_1791877237275_482b7bea.png' },
  { section: 'boxing', band: '3-4', file: 'beat-boxing-high_1791876978731_b752a301.png' },
  { section: 'boxing', band: '1-2.9', file: 'beat-boxing-mid_1791876988776_1ac17f00.png' },
  { section: 'boxing', band: '0-0.9', file: 'beat-boxing-low_1791877009829_fa76e268.png' },
  { section: 'swordsmanship', band: '3-4', file: 'beat-sword-high_1791877027123_9b048e6b.png' },
  { section: 'swordsmanship', band: '1-2.9', file: 'beat-sword-mid_1791877040516_45097560.png' },
  { section: 'swordsmanship', band: '0-0.9', file: 'beat-sword-low_1791877058806_fd84f59d.png' },
]

const FINALS = [
  { slot: 'low_average', file: 'finalknight-low-average_1791876833012_e8995fc1.png' },
  { slot: 'average', file: 'finalknight-average_1791876849622_45614e32.png' },
  { slot: 'high_average', file: 'finalknight-high-average_1791876871718_4296898c.png' },
]

const LOGO_RAW = 'logo-wordmark_1791876889759_80dbc7cf.png'

// ---- pixel pipeline (same core as the approved sample pass) -----------------------------------

async function loadRgba(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

function borderMedian({ data, width, height }) {
  const band = 6
  const rs = []
  const gs = []
  const bs = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= band && x < width - band && y >= band && y < height - band) continue
      const i = (y * width + x) * 4
      rs.push(data[i])
      gs.push(data[i + 1])
      bs.push(data[i + 2])
    }
  }
  const med = (arr) => [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)]
  const medR = med(rs)
  const medG = med(gs)
  const medB = med(bs)
  // The raws' backdrops sit between 239 and 255 — anchor the key just under the measured backdrop.
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
  return { med: [medR, medG, medB], limits: [medR, medG, medB].map((c) => clamp(c - 7, 236, 248)) }
}

/** Border-connected flood fill over pixels at or above the per-channel limits → alpha 0. */
function floodBorder({ data, width, height }, limits) {
  const [lr, lg, lb] = limits
  const mask = new Uint8Array(width * height)
  const stack = []
  for (let x = 0; x < width; x += 1) stack.push(x, 0, x, height - 1)
  for (let y = 0; y < height; y += 1) stack.push(0, y, width - 1, y)
  while (stack.length > 0) {
    const y = stack.pop()
    const x = stack.pop()
    if (x < 0 || y < 0 || x >= width || y >= height) continue
    const p = y * width + x
    if (mask[p]) continue
    const i = p * 4
    if (data[i] < lr || data[i + 1] < lg || data[i + 2] < lb) continue
    mask[p] = 1
    data[i + 3] = 0
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1)
  }
  return mask
}

/** Erode the anti-aliased fringe: pixels matching the predicate and adjacent to keyed transparency become keyed too. */
function erodeFringe({ data, width, height }, mask, matches) {
  let changed = true
  while (changed) {
    changed = false
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const p = y * width + x
        if (mask[p]) continue
        if (!matches(data, p * 4)) continue
        const touching =
          (x > 0 && mask[p - 1]) ||
          (x < width - 1 && mask[p + 1]) ||
          (y > 0 && mask[p - width]) ||
          (y < height - 1 && mask[p + width])
        if (touching) {
          mask[p] = 1
          data[p * 4 + 3] = 0
          changed = true
        }
      }
    }
  }
}

/**
 * Clear near-white regions fully enclosed by art (bow loop, string triangle, letter counters):
 * the border flood never reaches them, so without this they render as opaque holes. Area-gated:
 * real backdrop pockets are big, the artist's own whites (eye highlights, feather cells) are tiny.
 */
function clearEnclosedWhite({ data, width, height }, mask, minArea) {
  const near = (i) => data[i] >= HOLE_WHITE && data[i + 1] >= HOLE_WHITE && data[i + 2] >= HOLE_WHITE
  const seen = new Uint8Array(width * height)
  const cleared = []
  for (let p = 0; p < width * height; p += 1) {
    if (mask[p] || seen[p] || !near(p * 4)) continue
    const component = [p]
    seen[p] = 1
    for (let q = 0; q < component.length; q += 1) {
      const c = component[q]
      const x = c % width
      const y = (c / width) | 0
      const neighbours = [
        x > 0 ? c - 1 : -1,
        x < width - 1 ? c + 1 : -1,
        y > 0 ? c - width : -1,
        y < height - 1 ? c + width : -1,
      ]
      for (const n of neighbours) {
        if (n >= 0 && !mask[n] && !seen[n] && near(n * 4)) {
          seen[n] = 1
          component.push(n)
        }
      }
    }
    if (component.length >= minArea) {
      for (const c of component) {
        mask[c] = 1
        data[c * 4 + 3] = 0
      }
      cleared.push(component.length)
    }
  }
  return cleared
}

function keyBackdrop(image, options = {}) {
  const { holes = false, holeMinArea = HOLE_MIN_AREA, warmSmear = false } = options
  const { limits } = borderMedian(image)
  const mask = floodBorder(image, limits)
  erodeFringe(image, mask, (_d, i) => image.data[i] >= FRINGE && image.data[i + 1] >= FRINGE && image.data[i + 2] >= FRINGE)
  if (warmSmear) {
    erodeFringe(image, mask, (_d, i) => {
      const r = image.data[i]
      const b = image.data[i + 2]
      return r - b >= WARM_TINT && (image.data[i] + image.data[i + 1] + image.data[i + 2]) / 3 >= WARM_MEAN
    })
  }
  const cleared = holes ? clearEnclosedWhite(image, mask, holeMinArea) : []
  if (cleared.length > 0) {
    erodeFringe(image, mask, (_d, i) => image.data[i] >= HOLE_FRINGE && image.data[i + 1] >= HOLE_FRINGE && image.data[i + 2] >= HOLE_FRINGE)
  }
  return { image, cleared, limits }
}

function alphaBbox({ data, width, height }) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

/** Keyed + trimmed sprite (buffer + bbox size). */
async function spriteOf(image, options) {
  const { image: keyed, cleared, limits } = keyBackdrop(image, options)
  const bbox = alphaBbox(keyed)
  const buffer = await sharp(keyed.data, { raw: { width: keyed.width, height: keyed.height, channels: 4 } })
    .extract(bbox)
    .png()
    .toBuffer()
  return { buffer, width: bbox.width, height: bbox.height, cleared, limits }
}

async function extractHalf(image, half) {
  const buf = await sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
    .extract({ left: half.index * half.width, top: 0, width: half.width, height: image.height })
    .raw()
    .toBuffer()
  return { data: buf, width: half.width, height: image.height }
}

/** Place a sprite on a transparent canvas by an explicit raw→canvas factor. */
async function placeScaled(sprite, scale, canvasW, canvasH, outFile, { bottomMargin = 0, centered = false } = {}) {
  const w = Math.max(1, Math.round(sprite.width * scale))
  const h = Math.max(1, Math.round(sprite.height * scale))
  const resized = await sharp(sprite.buffer).resize(w, h).png().toBuffer()
  const left = Math.round((canvasW - w) / 2)
  const top = centered ? Math.round((canvasH - h) / 2) : canvasH - h - bottomMargin
  await sharp({ create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(outFile)
  return { w, h, left, top }
}

/** Fit a sprite fully inside the canvas (never cropped), centred or bottom-centre. */
function fitScale(sprite, canvasW, canvasH, margin) {
  return Math.min((canvasW - 2 * margin) / sprite.width, (canvasH - 2 * margin) / sprite.height)
}

async function fitOnCanvas(sprite, canvasW, canvasH, outFile, { margin = 0, bottomMargin = null } = {}) {
  const scale = Math.min(1, fitScale(sprite, canvasW, canvasH, margin))
  return placeScaled(sprite, scale, canvasW, canvasH, outFile, {
    bottomMargin: bottomMargin ?? margin,
    centered: bottomMargin === null,
  })
}

const log = (...args) => console.log(...args)

// ---- review sheets ----------------------------------------------------------------------------

const label = (text, width = 400) =>
  Buffer.from(
    `<svg width="${width}" height="22"><text x="0" y="16" font-family="Segoe UI, sans-serif" font-size="15" fill="#e8e4d8">${text}</text></svg>`,
  )

async function renderSectionFrame(section) {
  const base = await sharp(path.join(RAW, BACKGROUNDS.find((b) => b.dir === section).file)).resize(1280, 720, { fit: 'cover' })
  const composites = []
  const targetIdle = await sharp(path.join(OUT, section, 'target.idle@2x.png')).resize(200, 200).png().toBuffer()
  for (let i = 0; i < 5; i += 1) {
    composites.push({ input: targetIdle, left: 70 + i * 235, top: 198 })
  }
  // impact mock on the middle target: hit pose + effect + stuck projectile (archery only)
  const hit = await sharp(path.join(OUT, section, 'target.hit@2x.png')).resize(200, 200).png().toBuffer()
  const effect = await sharp(path.join(OUT, section, 'hitEffect@2x.png')).resize(200, 200).png().toBuffer()
  composites.push({ input: hit, left: 70 + 2 * 235, top: 198 }, { input: effect, left: 70 + 2 * 235, top: 198 })
  if (section === 'archery') {
    const projectile = await sharp(path.join(OUT, section, 'projectile@2x.png')).resize({ width: 74 }).png().toBuffer()
    const meta = await sharp(projectile).metadata()
    const cx = 70 + 2 * 235 + 100
    const cy = 198 + 94
    composites.push({ input: projectile, left: Math.round(cx - 37), top: Math.round(cy - meta.height / 2) })
  }
  composites.push({ input: await sharp(path.join(OUT, section, 'knight.idle@2x.png')).resize(300, 260).png().toBuffer(), left: 300, top: 430 })
  if (section === 'archery') {
    composites.push({ input: await sharp(path.join(OUT, section, 'projectile@2x.png')).resize(120, 34).png().toBuffer(), left: 560, top: 300 })
  }
  await base.composite(composites).png().toFile(path.join(REVIEW, `review-${section}.png`))
  log(`review-${section}.png (game geometry)`)
}

async function renderSectionStrip(section) {
  const base = sharp({ create: { width: 1280, height: 720, channels: 4, background: { r: 18, g: 18, b: 30, alpha: 1 } } })
  const composites = []
  const poses = ['idle', 'attack', 'celebrate', 'fail']
  for (const [i, pose] of poses.entries()) {
    composites.push({
      input: await sharp(path.join(OUT, section, `knight.${pose}@2x.png`)).resize(300, 260).png().toBuffer(),
      left: 40 + i * 310,
      top: 16,
    })
  }
  composites.push({ input: label('idle — attack — celebrate — fail (300×260 box, game scale)', 700), left: 40, top: 278 })
  const targets = [
    ['target.idle@2x.png', 'idle'],
    ['target.hit@2x.png', 'hit'],
    ['hitEffect@2x.png', 'effect'],
  ]
  for (const [i, [file]] of targets.entries()) {
    composites.push({ input: await sharp(path.join(OUT, section, file)).resize(200, 200).png().toBuffer(), left: 40 + i * 215, top: 310 })
  }
  composites.push({ input: label('target idle — hit — effect (200×200)', 500), left: 40, top: 516 })
  if (section === 'archery') {
    composites.push({ input: await sharp(path.join(OUT, section, 'projectile@2x.png')).resize(120, 34).png().toBuffer(), left: 700, top: 393 })
    composites.push({ input: label('projectile (120×34 box)', 300), left: 700, top: 440 })
  }
  for (const [i, band] of ['3-4', '1-2.9', '0-0.9'].entries()) {
    composites.push({
      input: await sharp(path.join(OUT, section, `animation.${band}@2x.png`)).resize(360, 170).png().toBuffer(),
      left: 40 + i * 400,
      top: 536,
    })
  }
  composites.push({ input: label('beats 3-4 — 1-2.9 — 0-0.9 (360×170 slot)', 700), left: 40, top: 708 })
  await base.composite(composites).png().toFile(path.join(REVIEW, `review-${section}-poses.png`))
  log(`review-${section}-poses.png (poses/states at game scale)`)
}

async function renderTitleResults() {
  const base = sharp({ create: { width: 1280, height: 720, channels: 4, background: { r: 16, g: 16, b: 32, alpha: 1 } } })
  const composites = [
    { input: Buffer.from(`<svg width="720" height="200"><rect width="720" height="200" rx="18" fill="rgba(16,16,26,0.82)" stroke="rgba(243,240,231,0.22)"/></svg>`), left: 280, top: 40 },
    { input: await sharp(path.join(OUT, 'title', 'logo@2x.png')).resize(340, 120).png().toBuffer(), left: 470, top: 80 },
    { input: label('logo (340×120, on the title card)', 400), left: 470, top: 246 },
  ]
  for (const [i, slot] of ['low_average', 'average', 'high_average'].entries()) {
    composites.push({
      input: await sharp(path.join(OUT, 'results', `finalKnight.${slot}@2x.png`)).resize(132, 132).png().toBuffer(),
      left: 402 + i * 172,
      top: 300,
    })
  }
  composites.push({ input: label('finalKnight low — average — high (132×132)', 500), left: 402, top: 440 })
  const thumbs = [
    ['title', 'background'],
    ['archery', 'background'],
    ['boxing', 'background'],
    ['swordsmanship', 'background'],
    ['results', 'background'],
  ]
  for (const [i, [dir, name]] of thumbs.entries()) {
    composites.push({
      input: await sharp(path.join(OUT, dir, `${name}@2x.png`)).resize(230, 129).png().toBuffer(),
      left: 40 + i * 245,
      top: 520,
    })
  }
  composites.push({ input: label('backgrounds: title — archery — boxing — swordsmanship — results (2560×1440 each)', 900), left: 40, top: 660 })
  await base.composite(composites).png().toFile(path.join(REVIEW, 'review-title-results.png'))
  log('review-title-results.png')
}

// ---- main -------------------------------------------------------------------------------------

async function main() {
  for (const dir of ['title', 'results', 'archery', 'boxing', 'swordsmanship']) {
    await mkdir(path.join(OUT, dir), { recursive: true })
  }
  await mkdir(REVIEW, { recursive: true })

  // --- knight sheets: key all 12 poses first, then one global body scale for the whole set.
  const keyedPoses = []
  for (const sheet of KNIGHT_SHEETS) {
    const image = await loadRgba(path.join(RAW, sheet.file))
    const half = Math.floor(image.width / 2)
    for (const [index, pose] of sheet.poses.entries()) {
      const part = await extractHalf(image, { index, width: half })
      const sprite = await spriteOf(part, { holes: true })
      keyedPoses.push({ ...sheet, pose, sprite, rawHeight: image.height })
      if (sprite.cleared.length > 0) {
        log(`  ${sheet.section}/${pose}: cleared ${sprite.cleared.length} enclosed pockets (${sprite.cleared.join(', ')} px)`)
      }
    }
  }
  const fits = keyedPoses.map(({ sprite, rawHeight }) => Math.min(
    (KNIGHT.h - KNIGHT.margin) / sprite.height,
    (KNIGHT.w - 2) / sprite.width,
  ) * rawHeight)
  const K = Math.floor(Math.min(...fits))
  log(`global knight constant K=${K} (limits per pose: ${keyedPoses.filter((p) => p.pose === 'idle').map((p) => p.sprite.limits.join('/')).join('  ')})`)
  for (const pose of keyedPoses) {
    const scale = K / pose.rawHeight
    const placed = await placeScaled(
      pose.sprite,
      scale,
      KNIGHT.w,
      KNIGHT.h,
      path.join(OUT, pose.section, `knight.${pose.pose}@2x.png`),
      { bottomMargin: KNIGHT.margin },
    )
    log(`  ${pose.section}/knight.${pose.pose}@2x.png  bbox ${pose.sprite.width}×${pose.sprite.height} → ${placed.w}×${placed.h} (scale ${scale.toFixed(3)})`)
  }

  // --- targets: idle and hit share the pair's min fit (no pop between states).
  for (const target of TARGETS) {
    const halves = []
    if (target.parts) {
      for (const part of target.parts) {
        halves.push({ state: part.state, sprite: await spriteOf(await loadRgba(path.join(RAW, part.file))) })
      }
    } else {
      const image = await loadRgba(path.join(RAW, target.sheet))
      const width = Math.floor(image.width / 2)
      for (const [index, state] of target.states.entries()) {
        const part = await extractHalf(image, { index, width })
        halves.push({ state, sprite: await spriteOf(part) })
      }
    }
    const shared = Math.min(...halves.map(({ sprite }) => fitScale(sprite, TARGET.w, TARGET.h, TARGET.margin)))
    for (const { state, sprite } of halves) {
      const placed = await placeScaled(
        sprite,
        shared,
        TARGET.w,
        TARGET.h,
        path.join(OUT, target.section, `target.${state}@2x.png`),
        { bottomMargin: TARGET.margin },
      )
      log(`  ${target.section}/target.${state}@2x.png  bbox ${sprite.width}×${sprite.height} → ${placed.w}×${placed.h} (shared scale ${shared.toFixed(3)})`)
    }
  }

  // --- arrow: warm-smear removes the cream speed-smoke; centred on the 240×68 canvas.
  const arrow = await spriteOf(await loadRgba(path.join(RAW, ARROW_RAW)), { warmSmear: true })
  const arrowPlaced = await fitOnCanvas(arrow, ARROW.w, ARROW.h, path.join(OUT, 'archery', 'projectile@2x.png'), { margin: 0 })
  log(`  archery/projectile@2x.png  bbox ${arrow.width}×${arrow.height} → ${arrowPlaced.w}×${arrowPlaced.h}`)

  // --- hit effects: centred on 400×400 (bursts sit on the impact point at 50%/47% of the box).
  for (const effect of EFFECTS) {
    const sprite = await spriteOf(await loadRgba(path.join(RAW, effect.file)))
    const placed = await fitOnCanvas(sprite, EFFECT.w, EFFECT.h, path.join(OUT, effect.section, 'hitEffect@2x.png'), { margin: EFFECT.margin })
    log(`  ${effect.section}/hitEffect@2x.png  bbox ${sprite.width}×${sprite.height} → ${placed.w}×${placed.h}`)
  }

  // --- section-end beats: fit the prop strip into the 720×340 (360×170 slot) canvas.
  for (const beat of BEATS) {
    const sprite = await spriteOf(await loadRgba(path.join(RAW, beat.file)), { holes: true })
    const placed = await fitOnCanvas(sprite, BEAT.w, BEAT.h, path.join(OUT, beat.section, `animation.${beat.band}@2x.png`), { margin: BEAT.margin })
    log(`  ${beat.section}/animation.${beat.band}@2x.png  bbox ${sprite.width}×${sprite.height} → ${placed.w}×${placed.h}${sprite.cleared.length ? `  (pockets: ${sprite.cleared.join(', ')})` : ''}`)
  }

  // --- final knights: fit each variant to the 264×264 canvas (only one ever shows per run).
  for (const final of FINALS) {
    const sprite = await spriteOf(await loadRgba(path.join(RAW, final.file)), { holes: true })
    const placed = await fitOnCanvas(sprite, FINAL.w, FINAL.h, path.join(OUT, 'results', `finalKnight.${final.slot}@2x.png`), {
      margin: FINAL.margin,
      bottomMargin: FINAL.margin,
    })
    log(`  results/finalKnight.${final.slot}@2x.png  bbox ${sprite.width}×${sprite.height} → ${placed.w}×${placed.h}`)
  }

  // --- logo: enclosed letter counters punched out; fitted on the 680×240 canvas.
  const logo = await spriteOf(await loadRgba(path.join(RAW, LOGO_RAW)), { holes: true })
  const logoPlaced = await fitOnCanvas(logo, LOGO.w, LOGO.h, path.join(OUT, 'title', 'logo@2x.png'), { margin: LOGO.margin })
  log(`  title/logo@2x.png  bbox ${logo.width}×${logo.height} → ${logoPlaced.w}×${logoPlaced.h}${logo.cleared.length ? `  (pockets: ${logo.cleared.join(', ')})` : ''}`)

  // --- backgrounds: 2560×1440 @2x of the 1280×720 stage.
  for (const background of BACKGROUNDS) {
    await sharp(path.join(RAW, background.file)).resize(2560, 1440, { fit: 'cover' }).png().toFile(path.join(OUT, background.dir, 'background@2x.png'))
    log(`  ${background.dir}/background@2x.png  2560×1440`)
  }

  // --- review sheets.
  for (const section of ['archery', 'boxing', 'swordsmanship']) {
    await renderSectionFrame(section)
    await renderSectionStrip(section)
  }
  await renderTitleResults()

  log('done.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
