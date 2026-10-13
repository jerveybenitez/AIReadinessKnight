// M9 — electric re-skin partial set: turn the two electric raws in vibe_images/ into game-ready
// @2x sprites in art/electric/ (the committed source-of-record for the electric mode's uploads).
//
// Same pixel pipeline as the M8 full-set pass (scripts/art/process-set.mjs): adaptive white-key
// clamp(borderMedian − 7, 236, 248), fringe erosion (224), enclosed-pocket clearing (242 / ≥100px
// / rim 240), trim, then placement on the canonical @2x canvases. Scale discipline matches the
// set: the target idle/hit pair shares one fit factor (the hit pose moves inside the idle
// footprint, never resizes outside it), bottom-centre, margin 4; the hit effect fits centred on
// the 400×400 effect canvas, margin 2. The lightning arcs are saturated cyan on purpose — the
// key never sees them (they sit well below the white threshold).
//
// Run from the repo root:  node scripts/art/process-electric.mjs

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const RAW = path.join(ROOT, 'vibe_images')
const OUT = path.join(ROOT, 'art', 'electric', 'archery')

const TARGET = { w: 400, h: 400, margin: 4 }
const EFFECT = { w: 400, h: 400, margin: 2 }

const FRINGE = 224
const HOLE_WHITE = 242
const HOLE_MIN_AREA = 100
const HOLE_FRINGE = 240

const TARGET_SHEET = 'target-electric-idle-hit_1791880350712_db206bbf.png'
const EFFECT_RAW = 'hiteffect-electric_1791880363163_b5763eb2.png'

// ---- pixel pipeline (identical core to process-set.mjs) ---------------------------------------

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
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
  return { med: [medR, medG, medB], limits: [medR, medG, medB].map((c) => clamp(c - 7, 236, 248)) }
}

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

function keyBackdrop(image, { holes = false } = {}) {
  const { limits } = borderMedian(image)
  const mask = floodBorder(image, limits)
  erodeFringe(image, mask, (_d, i) => image.data[i] >= FRINGE && image.data[i + 1] >= FRINGE && image.data[i + 2] >= FRINGE)
  const cleared = holes ? clearEnclosedWhite(image, mask, HOLE_MIN_AREA) : []
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

const log = (...args) => console.log(...args)

// ---- main -------------------------------------------------------------------------------------

await mkdir(OUT, { recursive: true })

// --- target idle|hit pair: one shared fit factor, bottom-centre, margin 4. ---
const sheet = await loadRgba(path.join(RAW, TARGET_SHEET))
const halfWidth = Math.floor(sheet.width / 2)
log(`target sheet ${sheet.width}×${sheet.height} → halves of ${halfWidth}`)

const states = ['idle', 'hit']
const keyedTargets = []
for (const [index, state] of states.entries()) {
  const part = await extractHalf(sheet, { index, width: halfWidth })
  const sprite = await spriteOf(part, { holes: true })
  keyedTargets.push({ state, sprite })
  log(
    `  target.${state}: ${sprite.width}×${sprite.height} (limits ${sprite.limits.join(',')}` +
      `${sprite.cleared.length > 0 ? `; cleared pockets ${sprite.cleared.join(', ')} px` : ''})`,
  )
}

const targetScale = Math.min(
  ...keyedTargets.map(({ sprite }) =>
    Math.min((TARGET.h - TARGET.margin) / sprite.height, (TARGET.w - 2) / sprite.width),
  ),
)
for (const { state, sprite } of keyedTargets) {
  const placed = await placeScaled(sprite, targetScale, TARGET.w, TARGET.h, path.join(OUT, `target.${state}@2x.png`), {
    bottomMargin: TARGET.margin,
  })
  log(`  → target.${state}@2x.png  ${placed.w}×${placed.h} at (${placed.left},${placed.top})  scale ${targetScale.toFixed(4)}`)
}

// --- hit effect: centred, margin 2, on the 400×400 effect canvas. ---
const effect = await spriteOf(await loadRgba(path.join(RAW, EFFECT_RAW)), {})
log(`hitEffect: ${effect.width}×${effect.height} (limits ${effect.limits.join(',')})`)
const effectScale = Math.min(1, Math.min((EFFECT.w - 2 * EFFECT.margin) / effect.width, (EFFECT.h - 2 * EFFECT.margin) / effect.height))
const placedEffect = await placeScaled(effect, effectScale, EFFECT.w, EFFECT.h, path.join(OUT, 'hitEffect@2x.png'), {
  centered: true,
})
log(`  → hitEffect@2x.png  ${placedEffect.w}×${placedEffect.h} at (${placedEffect.left},${placedEffect.top})  scale ${effectScale.toFixed(4)}`)

log('done — art/electric/archery/')
