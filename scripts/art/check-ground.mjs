// Ground-contact gate (M12) — asserts, per art set, that no standing target floats and every
// hanging target is properly hung. Two halves:
//
//   1. Sprite assertions (exact, scene-independent alpha math — the heart of the check):
//        - standing sections (archery, swordsmanship): target.idle AND target.hit alpha-bbox
//          bottom sits at canvas row 395 (= stage Y 395.5, the measured GROUND_BASELINE_Y − 0.5;
//          the pipeline bottom-anchors with margin 4 into the 400-px canvas). Both states share
//          the footprint — the hit state must not jump.
//        - hanging section (boxing): the bag's chain reaches the canvas top (bbox top ≤ row 12),
//          i.e. it hangs from the rail, nothing floating free above it.
//
//   2. Background junction probes: each standing-section background's wall/floor junction must
//      land in the pass band bg px [786, 796] (55% of 1440, GROUND_BASELINE_Y 396 stage). No
//      single detector reads all scenes (proven in M12: colour-match degenerates on dark-on-dark
//      electric art; luminance votes catch fence rails; hue medians catch tree bands), so each
//      image carries a calibrated probe — the method that measured it during M12 — with its
//      measured value in a comment. Degenerate images (boxing interiors: wall ≈ floor colour,
//      bags hang so no junction is required) and screens without a standing target row
//      (title/results) SKIP with a documented reason — never a silent pass.
//
//   node scripts/art/check-ground.mjs [set]     (default: all of default, electric, default16)
// Exit 1 if any assertion FAILs. SKIPs are reported but do not fail the run.

import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const SETS = process.argv[2] ? [process.argv[2]] : ['default', 'electric', 'default16']
const BAND = [786, 796]
const STANDING = ['archery', 'swordsmanship']
const HANGING = ['boxing']

const art = (set, ...p) => path.join(ROOT, 'art', set, ...p)

// ---- calibrated background probes (method = the one that measured this image in M12) ----------
const PROBES = {
  // edgeVote: per-column last strong edge inside [y0,y1), median vote with optional outlier
  // rejection — works when the junction is the dominant edge near the band.
  'default/archery': { method: 'edgeVote', metric: 'lum', threshold: 10, y0: 770, y1: 810, note: 'measured 790 (IQR 788-792)' },
  'default16/archery': { method: 'edgeVote', metric: 'lum', threshold: 10, y0: 730, y1: 870, rejectOutside: [770, 810], note: 'measured 788 (IQR 786-792)' },
  'electric/swordsmanship': { method: 'edgeVote', metric: 'rgb', threshold: 55, y0: 770, y1: 810, note: 'measured 792 (unanimous)' },
  // darkestLine: the junction outline is the darkest sustained row in the window (dark-on-dark
  // scene where edge votes catch panel seams — the M12 hand-probe, automated).
  'electric/archery': { method: 'darkestLine', y0: 770, y1: 815, note: 'measured 793 (lum 8-15, unanimous)' },
  // hueNearestBand: row-median green-dominance candidates in the scan range; the tree band above
  // the fence also reads green, so the candidate NEAREST the band wins (deterministic, documented).
  'default/swordsmanship': { method: 'hueNearestBand', y0: 0.45, y1: 0.65, note: 'measured 784 (lawn start; tree band at 704 rejected by nearest-band rule)' },
  'default16/swordsmanship': { method: 'hueNearestBand', y0: 0.45, y1: 0.65, note: 'measured 787.5 (lawn start after the 13px groundfix)' },
}
const SKIP = {
  'boxing': 'bags hang from the canvas top — no ground junction required (interior wall/floor are near-uniform in every set; degenerate by nature)',
  'title': 'no standing target row on this screen — junction not part of the target contract',
  'results': 'no standing target row on this screen — junction not part of the target contract',
}

// ---- helpers -----------------------------------------------------------------------------------
async function rawOf(file) {
  return sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
}

const lum = (d, w, x, y) => {
  const i = (y * w + x) * 4
  return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
}
const rgbDist = (d, w, x, y) => {
  const a = (y * w + x) * 4
  const b = ((y + 1) * w + x) * 4
  return Math.sqrt((d[a] - d[b]) ** 2 + (d[a + 1] - d[b + 1]) ** 2 + (d[a + 2] - d[b + 2]) ** 2)
}

/** Alpha bbox of a sprite: { top, bottom } row indices of opaque pixels. */
async function bboxRows(file) {
  const { data, info } = await rawOf(file)
  const { width, height } = info
  let top = height
  let bottom = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (y < top) top = y
        if (y > bottom) bottom = y
        break // one opaque pixel per row is enough for row bounds
      }
    }
  }
  return { top, bottom }
}

async function probeJunction(file, probe) {
  const { data, info } = await rawOf(file)
  const { width, height } = info
  if (probe.method === 'edgeVote') {
    const edge = (x, y) =>
      probe.metric === 'rgb' ? rgbDist(data, width, x, y) > probe.threshold : Math.abs(lum(data, width, x, y + 1) - lum(data, width, x, y)) > probe.threshold
    const votes = []
    for (let x = Math.floor(width * 0.15); x <= Math.floor(width * 0.85); x += 25) {
      let last = -1
      for (let y = probe.y0; y < probe.y1; y += 1) if (edge(x, y)) last = y + 1
      if (last > 0) votes.push(last)
    }
    let v = votes
    if (probe.rejectOutside) v = v.filter((y) => y >= probe.rejectOutside[0] && y <= probe.rejectOutside[1])
    if (v.length < 10) return { ok: false, why: `edgeVote degenerate (n=${v.length})` }
    v.sort((a, b) => a - b)
    return { ok: true, y: v[Math.floor(v.length / 2)], n: v.length }
  }
  if (probe.method === 'darkestLine') {
    let best = null
    for (let y = probe.y0; y <= probe.y1; y += 1) {
      let sum = 0
      let n = 0
      for (let x = Math.floor(width * 0.3); x <= Math.floor(width * 0.7); x += 10) {
        sum += lum(data, width, x, y)
        n += 1
      }
      const mean = sum / n
      if (!best || mean < best.mean) best = { y, mean }
    }
    return { ok: true, y: best.y, n: width }
  }
  if (probe.method === 'hueNearestBand') {
    const rowLawn = (y) => {
      let n = 0
      let tot = 0
      for (let x = Math.floor(width * 0.35); x <= Math.floor(width * 0.65); x += 15) {
        const i = (y * width + x) * 4
        if (data[i + 1] > data[i] + 10 && data[i + 1] > data[i + 2] + 20) n += 1
        tot += 1
      }
      return n / tot > 0.6
    }
    const candidates = []
    for (let y = Math.floor(height * probe.y0); y <= Math.floor(height * probe.y1); y += 1) {
      let ok = 0
      for (let k = 0; k < 12; k += 1) if (rowLawn(y + k)) ok += 1
      if (ok >= 10 && !candidates.includes(y)) candidates.push(y)
    }
    if (candidates.length === 0) return { ok: false, why: 'hueNearestBand found no green band' }
    const target = (BAND[0] + BAND[1]) / 2
    const y = candidates.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a))
    return { ok: true, y, n: candidates.length }
  }
  return { ok: false, why: `unknown probe method ${probe.method}` }
}

// ---- run ---------------------------------------------------------------------------------------
let failures = 0
const lines = []

for (const set of SETS) {
  if (!existsSync(art(set))) continue
  lines.push(`${set}:`)
  for (const section of ['archery', 'boxing', 'swordsmanship']) {
    for (const state of ['idle', 'hit']) {
      const file = art(set, section, `target.${state}@2x.png`)
      if (!existsSync(file)) {
        lines.push(`  ${section}/target.${state}  MISSING`)
        failures += 1
        continue
      }
      const { top, bottom } = await bboxRows(file)
      if (STANDING.includes(section)) {
        const pass = bottom === 395
        if (!pass) failures += 1
        lines.push(`  ${section}/target.${state}  feet at row ${bottom} (want 395)  ${pass ? 'ok' : 'FAIL'}`)
      } else if (HANGING.includes(section)) {
        // idle hangs straight — the chain must reach the very top. hit is swung: the chain angles
        // away so its highest drawn pixel sits lower (measured: default idle 4 / hit 9, electric
        // 4 / 11, default16 4 / 20 — all read correctly in their review frames).
        const limit = state === 'idle' ? 12 : 28
        const pass = top <= limit
        if (!pass) failures += 1
        lines.push(`  ${section}/target.${state}  chain from row ${top} (want ≤${limit})  ${pass ? 'ok' : 'FAIL'}`)
      }
    }
    const key = `${set}/${section}`
    const bg = art(set, section, 'background@2x.png')
    if (PROBES[key]) {
      if (!existsSync(bg)) {
        lines.push(`  ${section}/background  MISSING`)
        failures += 1
        continue
      }
      const r = await probeJunction(bg, PROBES[key])
      if (!r.ok) {
        lines.push(`  ${section}/background  PROBE ERROR: ${r.why}  FAIL`)
        failures += 1
      } else {
        const pass = r.y >= BAND[0] && r.y <= BAND[1]
        if (!pass) failures += 1
        lines.push(`  ${section}/background  junction bg ${r.y} (band ${BAND[0]}-${BAND[1]}, ${PROBES[key].method}, ${PROBES[key].note})  ${pass ? 'ok' : 'FAIL'}`)
      }
    } else {
      lines.push(`  ${section}/background  SKIP — ${SKIP[section]}`)
    }
  }
}

console.log(lines.join('\n'))
console.log(failures === 0 ? 'GROUND CHECK: all assertions pass' : `GROUND CHECK: ${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
