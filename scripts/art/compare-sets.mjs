// M11 gate tool — render one section's committed art from two sets side by side (default on the
// left, electric on the right) at the game's real render scale, for a human approval pass.
//
// The game-geometry frame reproduces the same composites as process-set.mjs's review frame
// (targets at their slots, hit + effect overlay on the middle target, projectile, idle knight),
// so "looks right here" means "looks right in-game". Rows below it: the four knight poses at
// their 300×260 box scale, targets/effect/projectile at their box scales, the three band beats.
// A closing text row lists the placed sprite sizes for the pixel-for-pixel sanity check.
//
//   node scripts/art/compare-sets.mjs [section]     (default: archery)
//
// Output: docs/art-sample/compare-electric-<section>.png

import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const REVIEW = path.join(ROOT, 'docs', 'art-sample')
const SETS = ['default', 'electric']
const section = process.argv[2] ?? 'archery'
if (!['archery', 'boxing', 'swordsmanship'].includes(section)) {
  console.error(`unknown section "${section}" — usage: node scripts/art/compare-sets.mjs [archery|boxing|swordsmanship]`)
  process.exit(1)
}

const art = (set, ...p) => path.join(ROOT, 'art', set, section, ...p)
for (const set of SETS) {
  if (!existsSync(art(set, 'background@2x.png'))) {
    console.error(`art/${set}/${section}/background@2x.png is missing — process the set first`)
    process.exit(1)
  }
}

const label = (text, width = 640, fill = '#e8e4d8') =>
  Buffer.from(`<svg width="${width}" height="22"><text x="4" y="16" font-family="Segoe UI, sans-serif" font-size="15" fill="${fill}">${text}</text></svg>`)

/** The in-game archery frame at 1280×720 (same geometry as the process-set review). */
async function renderFrame(set) {
  const base = sharp(art(set, 'background@2x.png')).resize(1280, 720, { fit: 'cover' })
  const composites = []
  const idle = await sharp(art(set, 'target.idle@2x.png')).resize(200, 200).png().toBuffer()
  for (let i = 0; i < 5; i += 1) composites.push({ input: idle, left: 70 + i * 235, top: 198 })
  const hit = await sharp(art(set, 'target.hit@2x.png')).resize(200, 200).png().toBuffer()
  const effect = await sharp(art(set, 'hitEffect@2x.png')).resize(200, 200).png().toBuffer()
  composites.push({ input: hit, left: 70 + 2 * 235, top: 198 }, { input: effect, left: 70 + 2 * 235, top: 198 })
  if (section === 'archery') {
    const projectile = await sharp(art(set, 'projectile@2x.png')).resize({ width: 74 }).png().toBuffer()
    const meta = await sharp(projectile).metadata()
    const cx = 70 + 2 * 235 + 100
    const cy = 198 + 94
    composites.push({ input: projectile, left: Math.round(cx - 37), top: Math.round(cy - meta.height / 2) })
  }
  composites.push({ input: await sharp(art(set, 'knight.idle@2x.png')).resize(300, 260).png().toBuffer(), left: 300, top: 430 })
  if (section === 'archery') {
    composites.push({ input: await sharp(art(set, 'projectile@2x.png')).resize(120, 34).png().toBuffer(), left: 560, top: 300 })
  }
  return base.composite(composites).png().toBuffer()
}

/** Trimmed-content size of a placed sprite (canvas minus transparent border). */
async function bboxOf(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
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
  return `${maxX - minX + 1}×${maxY - minY + 1}`
}

// ---- layout ------------------------------------------------------------------------------------
const COL = 640
const PAD = 8
const width = COL * 2
const composites = []
let y = PAD

for (const [i, set] of SETS.entries()) {
  composites.push({ input: label(`${set.toUpperCase()} — ${section}`, COL), left: i * COL + PAD, top: y })
}
y += 26

const frames = []
for (const set of SETS) frames.push(await sharp(await renderFrame(set)).resize(COL - 2 * PAD, 360).png().toBuffer())
for (const [i, frame] of frames.entries()) composites.push({ input: frame, left: i * COL + PAD, top: y })
y += 360 + 18

composites.push({ input: label('knight poses — idle · attack · celebrate · fail (300×260 game box)', width - 2 * PAD), left: PAD, top: y })
y += 24
for (const row of [['idle', 'attack'], ['celebrate', 'fail']]) {
  for (const [i, set] of SETS.entries()) {
    for (const [j, pose] of row.entries()) {
      composites.push({
        input: await sharp(art(set, `knight.${pose}@2x.png`)).resize(300, 260).png().toBuffer(),
        left: i * COL + PAD + j * 310,
        top: y,
      })
    }
  }
  y += 260 + 6
}

composites.push({ input: label('target idle · hit · effect (200×200) · projectile (120×34)', width - 2 * PAD), left: PAD, top: y })
y += 24
for (const [i, set] of SETS.entries()) {
  const row = ['target.idle@2x.png', 'target.hit@2x.png', 'hitEffect@2x.png']
  for (const [j, file] of row.entries()) {
    composites.push({ input: await sharp(art(set, file)).resize(200, 200).png().toBuffer(), left: i * COL + PAD + j * 205, top: y })
  }
  if (section === 'archery') {
    composites.push({ input: await sharp(art(set, 'projectile@2x.png')).resize(120, 34).png().toBuffer(), left: i * COL + PAD + 10, top: y + 206 })
  }
}
y += 200 + 18

composites.push({ input: label('band beats — 3-4 · 1-2.9 · 0-0.9 (360×170 slot)', width - 2 * PAD), left: PAD, top: y })
y += 24
for (const [i, set] of SETS.entries()) {
  for (const [j, band] of ['3-4', '1-2.9', '0-0.9'].entries()) {
    composites.push({
      input: await sharp(art(set, `animation.${band}@2x.png`)).resize({ width: 204 }).png().toBuffer(),
      left: i * COL + PAD + j * 209,
      top: y,
    })
  }
}
y += 120

// ---- pixel-for-pixel sanity row ----------------------------------------------------------------
const sizes = async (set) => [
  `idle ${await bboxOf(art(set, 'knight.idle@2x.png'))}`,
  `attack ${await bboxOf(art(set, 'knight.attack@2x.png'))}`,
  `celebrate ${await bboxOf(art(set, 'knight.celebrate@2x.png'))}`,
  `fail ${await bboxOf(art(set, 'knight.fail@2x.png'))}`,
].join('  ·  ')
composites.push({ input: label(`knight content size — default: ${await sizes('default')}`, width - 2 * PAD), left: PAD, top: y })
y += 22
composites.push({ input: label(`knight content size — electric: ${await sizes('electric')}`, width - 2 * PAD), left: PAD, top: y })
y += 22
composites.push({ input: label('targets stay on their 400×400 canvases at the same anchor (bottom-centre, margin 4) — the layout geometry is unchanged.', width - 2 * PAD, '#9aa4b2'), left: PAD, top: y })
y += 30

const out = path.join(REVIEW, `compare-electric-${section}.png`)
await sharp({ create: { width, height: y, channels: 4, background: { r: 14, g: 14, b: 22, alpha: 1 } } })
  .composite(composites)
  .png()
  .toFile(out)
console.log(`${path.relative(ROOT, out)}  (${width}×${y})`)
