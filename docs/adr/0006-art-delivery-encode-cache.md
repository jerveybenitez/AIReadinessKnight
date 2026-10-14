# ADR 0006 — Art delivery: WebP at wire time, content-hashed filenames, immutable caching

Status: accepted (2026-10-14, M14)

## Options

1. **Payload `upload.formats` / `imageSizes`** — let Payload re-encode every upload on the way in
   and serve `filename.webp` alongside the original.
2. **Encode in the art pipeline at wire time** — `src/seed/wire-art.ts` re-encodes each
   `art/<slug>/**` PNG to WebP (sharp) in its staging step and uploads only the WebP.
3. **Both** — Payload formats as a safety net plus pipeline encodes.

## Choice

Option 2. The staged upload is a delivery encode: lossy WebP q80 for `default` and `electric`,
**lossless** WebP for `default16`, and the upload filename carries a content hash
(`archery-background@2x.1a2b3c4d.webp`).

## Why

- **Per-set encode control.** `default16` is pixel art; lossy encoding smears hard edges. Payload
  formats apply collection-wide, so lossless-for-one-set would need a second media collection or
  post-upload surgery. In the pipeline the decision is one line keyed on the set slug, and the
  lossless claim is *proven* — every `default16` file is decoded back and compared bit-for-bit
  against its PNG source before it uploads (wire-art fails loudly on mismatch).
- **`art/` stays the source of record, untouched.** `check-ground.mjs`, `process-set.mjs` and the
  review sheets all read `art/<slug>/**` PNGs; encoding at wire time leaves every one of them
  working on unchanged bytes, which keeps the M12 `GROUND_BASELINE_Y` contract verifiable exactly
  as before. Option 1 would have made the served bytes a function of Payload's resize config, not
  of the pipeline.
- **The game stays decoupled from Payload's sizes API.** Components render `media.url` via plain
  `<img>` (QODER.md M14's diagnosis names next/image optimisation as out of scope). Payload formats
  would add a `sizes` object nobody reads and double the stored bytes.
- **Content-hashed filenames make immutable caching honest.** `art:wire --replace` deletes a media
  doc and creates a new one under the *same* filename; with long-lived `Cache-Control` that is a
  stale-by-construction bug (a browser serves the old bytes for up to a year). With the hash in
  the name, new bytes are a new URL, and an old cached entry keeps serving the old bytes — which
  are still the correct bytes for that URL. Orphan docs of an earlier encode are deleted at the
  end of every wire run, so `media/` does not accumulate dead weight.

## Cache policy (M14(b))

- `/api/media/file/*` — `Cache-Control: public, max-age=31536000, immutable`, set via Payload 3's
  `upload.modifyResponseHeaders` (verified present in the installed `getFileHandler`). Justified
  *only* by the content hash above; media docs are otherwise unversioned.
- `/audio/*` — `Cache-Control: public, max-age=86400` via Next `headers()`. The WAV names are
  stable (a regenerated set keeps its filenames), so `immutable` would be a stale-serving risk;
  one day is plenty for a 2.5 MB shared set that Chrome additionally caches per context.
- Verified before changing anything (M14(b) requirement): media GET responses carried **no** cache
  headers at all; audio carried `max-age=0`.
