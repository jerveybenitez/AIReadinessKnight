# AI-Ready Knight — Art Prompts

The `default` mode's art set is generated, not hand-drawn. This file keeps every source prompt
keyed by slot so the set can be regenerated, extended or restyled later without guesswork
(game-assets skill). The prompts below are the ones actually used; keep them in sync when
iterating.

## Style anchor (used verbatim in every sprite prompt)

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited
> palette, simple soft shading only, no texture noise, no gradients beyond gentle shading.

## Character anchor — the knight (used verbatim in every knight prompt)

> A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright
> green eyes, calm confident expression. Simple brown leather training gear: fitted leather tunic
> with small rounded shoulder pauldrons, leather bracers on forearms, dark brown trousers, sturdy
> laced boots. No helmet, no cape. She carries a simple wooden training bow.

She is the style anchor: proportions, palette and face are established first and nothing else is
generated until she is approved.

## Ground rules

- **Transparent sprites**: sprites are generated on a perfectly flat uniform pure white background
  (`#FFFFFF`), then keyed to transparent with a border-connected flood fill (interior whites such
  as eye highlights survive), trimmed, and re-anchored **bottom-centre** on the slot's canonical
  @2x canvas (anchor consistency — she must never jump between poses).
- **Multi-pose sheets for consistency**: knight poses are generated two per image (side-by-side,
  same ground line), because independent generations drift in face and outfit. The sheet is split
  after generation.
- **@2x canvases — the game's actual render boxes** (measured from `game.css` / `Question.tsx`,
  which supersede the game-assets skill's indicative sizes): background 2560×1440 · knight
  600×520 (300×260 box) · target 400×400 (200×200 box; `target.hit` and `hitEffect` share this
  canvas) · projectile 240×68 (120×34 flight box) · finalKnight 264×264 (132×132 box) · logo
  680×240 (340×120 box) · scene beats (sectionEnd, title/results backgrounds) full-stage
  2560×1440.
- Backgrounds: no important detail in the bottom quarter (the knight sits there); deliberately
  uncluttered in the target band.
- **Ground contract (M12, measured — `GROUND_BASELINE_Y = 396` in the game-assets skill):**
  standing sprites bottom-anchor with their alpha-bbox feet at stage Y ≈ 395.5, so every section
  background's wall/floor junction must sit at **55% of background height** (bg px 792 of 1440;
  pass band 786–796). Generators miss this (M12 measured 58–68% across regens), so backgrounds are
  **measured after processing and pixel-shifted if they miss** — prompts carry the sentence, the
  pipeline enforces it. Verbatim sentences:
  - Backgrounds: *"The back wall meets the floor at a horizontal line exactly 55% of the image
    height from the top edge (between 54% and 57%); the floor begins immediately below that line
    and continues to the bottom edge of the image."*
  - Standing targets (target/dummy sheets, beats with ground props): *"The legs stand straight and
    the feet are the very lowest part of the drawing — fully grounded, nothing floating."*
  - Hanging targets (boxing bags): *"The chain reaches the very top edge of the image so the bag
    hangs with nothing floating free above it."* (Bags hang from the top edge — no ground contact,
    exempt from the junction check.)

## Slot prompts

### Default / archery (the approved layout — the sample section)

| Slot | Prompt |
| --- | --- |
| `background` | {Style} Simple medieval barracks training yard, empty, no people: a low stone wall and wooden palisade fence behind a beaten dirt ground, a few straw bales and a wooden rack of training spears only at the far left and right edges, soft blue sky with a few flat clouds, wide 16:9 composition, plain uncluttered middle band, completely plain dirt ground in the lower quarter. The back wall meets the floor at a horizontal line exactly 55% of the image height from the top edge (between 54% and 57%); the floor begins immediately below that line and continues to the bottom edge of the image. No text. |
| `knight.idle` + `knight.attack` (one sheet, left→right) | {Style} Two full-body poses of the same character standing side by side on one image, evenly spaced, identical size, feet on the same invisible ground line, clear empty space between them. {Character} LEFT POSE: relaxed idle, standing upright, bow held low at her side, facing three-quarters right. RIGHT POSE: drawing the bow — left arm extended holding the bow toward the right, right hand pulling the string back to her cheek, aiming right. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text. |
| `knight.celebrate` + `knight.fail` (one sheet, left→right) | {Style} Two full-body poses of the same character standing side by side on one image, evenly spaced, identical size, feet on the same invisible ground line, clear empty space between them. {Character} LEFT POSE: celebrating — bow raised high in one hand, fist clenched, big smile, slight upward hop. RIGHT POSE: dejected — bow lowered to the ground, shoulders slumped, sighing, eyes closed. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text. |
| `target.idle` | {Style} Single round straw archery target butt on two simple wooden legs, front view, slightly angled, painted concentric rings — wide outer cream ring, middle red-oxide ring, gold-yellow bullseye — round straw body with subtle weave hints. The legs stand straight and the feet are the very lowest part of the drawing — fully grounded, nothing floating. Isolated on a perfectly flat uniform pure white background, no shadows, full object visible with margin, no text. |
| `target.hover` | Same as `target.idle` — the hover cue is the pointer glow drawn in CSS, not a separate asset. |
| `target.hit` | Same target design as `target.idle`, shown just-struck: the bullseye punched, a few straw flecks flying, the target tilted a few degrees. The legs stand straight and the feet are the very lowest part of the drawing — fully grounded, nothing floating. Same canvas and anchor as `target.idle`. |
| `projectile` | {Style} Single arrow flying horizontally pointing right: wooden shaft, triangular dark-steel head, white feather fletching, faint motion streak. Isolated on a perfectly flat uniform pure white background, no shadow, no text. |
| `hitEffect` | {Style} Small circular impact burst: flat starburst of cream and gold shards with a red-oxide centre, anime impact feel. Isolated on a perfectly flat uniform pure white background, no text. |
| `sectionEnd.0-0.9` | {Style} {Character} Wide 16:9 scene beat for the end-of-section screen: the knight standing in the training yard, bow lowered, shoulders slumped, one arrow stuck in the ground beside her. (Simplified for generation: single knight, plain yard backdrop.) |
| `sectionEnd.1-2.9` | Same composition as `sectionEnd.0-0.9`, knight looking at the target with a determined half-smile, wiping her brow. |
| `sectionEnd.3-4` | Same composition as `sectionEnd.0-0.9`, knight celebrating — bow raised high, big smile. |

### Default / boxing and swordsmanship

Same structure as archery with the section prop changes: boxing = punching bag on a chain, no
projectile (the attack is a punch; the projectile slot stays empty in the CMS and the scene skips
the flying element when the slot is empty), knight in wrapped gloves; swordsmanship = wooden
training dummy, projectile slot empty, knight with a wooden sword. Pose sheets and targets reuse
the archery prompt shapes with the section prop swapped; the knight sheets for these sections were
generated on 848-px-high raws and scaled to the same global body size as archery (see pipeline).
The target prompts carry the ground-contact sentences verbatim from Ground rules: the wooden dummy
*stands* (legs/base as the lowest part of the drawing — fully grounded), the punching bag *hangs*
(the chain reaches the very top edge of the image; no ground contact required).

The two **v2 backgrounds** (superseding the first boxing/sword backgrounds, which had props baked
into the play row where CMS sprites render) were generated with the constraints made explicit:

| Slot | Prompt |
| --- | --- |
| `boxing.background` (v2) | {Style} Simple medieval training hall interior, empty, no people: stone walls, timber ceiling beams, a low horizontal wooden rail high on the wall, wooden floor. Training props only along the far left and right edges (rolled mats, a bench). The middle band of the wall and floor — where five hanging bags are placed later — is completely bare: no bags, no props, no drawings on the wall in that band. The back wall meets the floor at a horizontal line exactly 55% of the image height from the top edge (between 54% and 57%); the floor begins immediately below that line and continues to the bottom edge of the image. No text. |
| `swordsmanship.background` (v2) | {Style} Simple medieval training yard, empty, no people: a wooden palisade fence and low stone wall behind a green lawn strip, half-timbered houses in the far background. Training props only along the far left and right edges (weapon rack, shield stand). The middle band — where five training dummies are placed later — is completely bare: no dummy, no figures, no target on the lawn. The back wall meets the floor at a horizontal line exactly 55% of the image height from the top edge (between 54% and 57%); the floor begins immediately below that line and continues to the bottom edge of the image. No text. |

### Default / title, results

| Slot | Prompt |
| --- | --- |
| `title.background` | {Style} The training yard at golden hour seen through an open wooden gate: stone gatehouse walls left and right, warm evening light on the dirt, the target row and fence visible in the distance beyond the gate, no people. The back wall meets the floor at a horizontal line exactly 55% of the image height from the top edge (between 54% and 57%); the floor begins immediately below that line and continues to the bottom edge of the image. No text. |
| `logo` | {Style} Wordmark "AI-READY KNIGHT" on two lines — flat medieval woodcut lettering, warm gold fill with a darker gold outline, no other decoration, isolated on a perfectly flat uniform pure white background. |
| `results.background` | {Style} The quiet training yard after the session, evening light: stone walls, trees and a timber cabin, targets down on the ground with arrows beside them, no people. The back wall meets the floor at a horizontal line exactly 55% of the image height from the top edge (between 54% and 57%); the floor begins immediately below that line and continues to the bottom edge of the image. No text. |
| `finalKnight.low_average` | {Style} {Character} Full-body results portrait: still in leather training clothes, bow in hand, determined look. |
| `finalKnight.average` | {Style} {Character} Full-body results portrait: plain metal armour over the training tunic, sword at her side, nodding. |
| `finalKnight.high_average` | {Style} {Character} Full-body results portrait: flashy gold-and-silver armour, celebrating, bow and sword crossed behind her. |

## Post-processing pipeline (implemented in `scripts/art/process-set.mjs`)

The full-set pipeline; it keys all 12 knight poses with one shared body scale before anything is
placed. (The sample pass used a predecessor script, `process-sample.mjs`, deleted after the full
pass landed — its measured thresholds survive in the set script's comments.)

1. **Adaptive white-key**: the key limit is measured per file from the outer border ring's median
   colour — per channel `clamp(median − 7, 236, 248)` — then a border-connected flood fill over
   pixels at or above those limits → alpha 0. A fixed 245 would leave several raws partly opaque
   (their paper is warmer/darker); the adaptive limit keys them clean without eating art whites.
2. **Fringe erosion**: light pixels (≥ 224) adjacent to keyed transparency are keyed too — kills
   the anti-aliased halo ring without touching interior whites. Iterates until stable.
3. **Hole clearing** (sprites with enclosures — bow loop, shield, bag chain): large fully-enclosed
   near-white pockets (≥ 242, area ≥ 100 px) that the border fill can never reach are punched to
   transparency, then their rim gets the ≥ 240 fringe treatment. Measured: real pockets run
   149–39 000 px, the artist's own whites (eye highlights, feather cells) are ≤ 50 px.
4. **Warm-smear removal** (projectile): the raw arrow ships with a cream speed-smoke. It is
   warm-tinted (r − b ≥ +5 at mean 227–232) while every feather white is cool (r − b −7…−10), so
   a tint-based pass (r − b ≥ +4, mean ≥ 215, adjacent to keyed transparency) removes it exactly.
   The game animates flight itself, so baked-in smoke is never wanted.
5. **Trim** transparent border (alpha bbox).
6. **Global knight scale**: one factor for all 12 poses across the three sections —
   `K = min over poses of (fitFactor × rawPixelHeight)`, i.e. the largest raw height that fits
   every pose's box; each sheet then scales by `K / rawHeight` so she is exactly the same size in
   every section (545 raw px; the archery sheet's 0.532 reproduces the approved sample layout
   pixel-exactly). Anchor bottom-centre, margin 2 px, on the canonical @2x canvas.
7. **Targets**: idle and hit are a pair on the same canvas — one shared fit factor (`min` of the
   two fits) so the hit pose moves within, never resizes outside, the idle footprint. Margin 4 px.
8. **Beat strips / finals / logo**: beats 720×340 (margins 6, centred) fill the 360×170
   section-end slot; finals 264×264 bottom-anchored (margin 4, per-variant fit — the three results
   knights are deliberately different builds); logo 680×240 centred (margin 4).
9. Backgrounds: resize to 2560×1440 (lanczos), cover-cropped in-game.
10. Export PNG (backgrounds JPG-able later via Payload/sharp if size demands).

## Full-set status (2026-10-13)

The whole `default` set is generated, processed (`art/default/**`, 40 files), wired into the CMS
(`pnpm art:wire` — uploads to `media/`, rebuilds every mode slot, verifies all 43 slots resolve)
and verified in-game by a scripted full playthrough (`scripts/art/verify-in-game.mjs`, screenshots
`docs/art-sample/verify-*.png`): title, intake, all three sections (idle / hover bubble / attack
beat / impact), three section ends on three different bands, results and the fallback report — no
placeholder and no broken image anywhere. Raws for the whole set live in `vibe_images/`; the
superseded first-pass boxing/sword backgrounds and the v1 archery extras stay on disk untouched.

M12(a) ground fix (2026-10-14): the archery background's ground line sat at bg px 834 — +21.5px
above the target feet — so the wired raw is `background-sample-groundfix_…` (same art shifted up
24px, floor strip tiled into the bottom edge; measured junction bg px 789 → stage Y 394.5). The
original raw stays on disk superseded. Every prompt above now carries the ground-contact sentence;
the measured contract lives in the game-assets skill (`GROUND_BASELINE_Y = 396`).

Readability fixes made during that verification (backgrounds became real art, so fixed UI text
lost its dark placeholder backdrop): the bare question banner and the progress line gained a soft
scrim text-shadow, the section chip gained the same dark plate as the score badges, the results
scene now actually renders its `results.background` slot (it was wired but never drawn), and the
question scene skips the flying projectile and stuck-arrow overlay in melee sections instead of
rendering placeholders for the empty slot.

## Electric re-skin (M9 partial set, 2026-10-13)

The M9 proof overrides **only three archery slots** of the duplicated mode (target idle, target
hit, hit effect); everything else is left empty on purpose, so the default set shows through
slot-by-slot (see `docs/modes.md`). Two raws, both generated with the style anchor verbatim:

| Raw | Prompt |
| --- | --- |
| `vibe_images/target-electric-idle-hit_1791880350712_db206bbf.png` (1264×848, idle+hit sheet) | {Style} Two versions of the same round training target standing side by side on one image, evenly spaced, identical size and angle, feet on the same invisible ground line, clear empty space between them. The target: a round straw archery target on two simple wooden tripod legs, front view, slightly angled, painted concentric rings in an electric palette — wide outer ring pale sky blue, middle ring saturated cyan, bullseye bright electric blue — crisp dark outlines, and small crackling saturated-cyan lightning arcs hugging the rim (the arcs are medium cyan, never white, no glow). LEFT POSE: intact and calm, lightning arcs softly crackling on the rim. RIGHT POSE: just struck — the bullseye punched with a crackling saturated-cyan spark burst at the centre, a few straw flecks flying, the target tilted a few degrees. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text. |
| `vibe_images/hiteffect-electric_1791880363163_b5763eb2.png` (1024×1024) | {Style} Small circular impact burst: flat starburst of sharp shards in saturated cyan and electric blue with a deep electric-blue core, a few small lightning-crackle spikes between the shards, crisp dark outlines around every shard, anime impact feel. The burst sits centred in the frame with generous even margin. Isolated on a perfectly flat uniform pure white background, nothing else, no text. |

Processing: `scripts/art/process-electric.mjs` (retired after M11 — `process-set.mjs electric`
superseded it) — the same pipeline and constants as `process-set.mjs` (adaptive per-file white-key,
fringe erosion 224, pocket clearing for the sheet, trim). Scale discipline matches the set: the
target idle/hit pair shares one fit factor (0.6286), bottom-anchored margin 4 on the 400×400
target canvas; the effect fits centred margin 2 on the 400×400 effect canvas. Outputs in
`art/electric/archery/`:

- `target.idle@2x.png` — 323×396 at (39,0)
- `target.hit@2x.png` — 324×392 at (38,4)
- `hitEffect@2x.png` — 396×383 at (2,9)

(Historical M9 outputs — M11 re-processed the idle/hit pair through `process-set.mjs electric`,
which re-placed the content: idle now 320×392 at (40,4), hit 320×388 at (40,8); `hitEffect` is
unchanged. The files on disk are the M11 versions.)

Wiring is **by hand through the admin UI** (that is the milestone): target idle in phase 1,
target hit + hit effect in phase 2 — the exact clicks are `docs/modes.md`. The `target.hover`
slot is deliberately left empty, which is why hovering an electric target shows the default golden
one (the per-slot fallback teaching example). Verified at the time by
`scripts/art/verify-electric.mjs` (`partial` / `full`, screenshots `docs/modes-proof/verify-partial-*`
and `verify-full-*`): every scene asserted the uploads render, the uncovered slots carry default
URLs, and no placeholder is ever visible. M11 inverted that script into the full-set proof and
re-proved the fallback on a scratch mode — see the M11 appendix below.

---

## Electric full set (M11, 2026-10-13)

M11 completed the re-skin: the archery sample passed the side-by-side gate first
(`node scripts/art/compare-sets.mjs archery` renders the default-vs-electric sheet at game scale —
`docs/art-sample/compare-electric-<section>.png`), then the remaining raws were generated in one
consistent pass — an electronic/cyberpunk mirror of the
default set — processed with `node scripts/art/process-set.mjs electric` (same pipeline, render
boxes and global-scale discipline as the default set; the knight constant is capped at the default
set's and lands at K=540), and wired with `pnpm art:wire electric` (media uploads carry the
`electric-` prefix). 40 files over 43 slots. `/electric` is verified to render **zero** `default`
URLs and zero placeholders (`scripts/art/verify-electric.mjs`), and the per-slot fallback rule is
re-proven on a throwaway scratch mode (`pnpm art:verify-fallback`) — see `docs/modes.md`.

Two extra anchors, used verbatim on top of the default style/character anchors:

> **Electric palette** — Dark charcoal, slate and deep navy palette with flat saturated-cyan and
> electric-blue accent shapes — every accent is a flat colour with crisp outlines, no glow, no
> bloom, no light halos.

> **Electric knight** — A young female knight, mid-20s, short auburn hair in a practical ponytail,
> fair skin, bright green eyes (and, on the calm poses, "calm confident expression"). Dark
> charcoal technical training outfit keeping the same silhouette as simple leather training gear:
> a fitted jacket-style tunic with small rounded shoulder pauldrons, bracers on her forearms (boxing
> swaps these for "hands wrapped in dark training hand-wraps with thin saturated-cyan seam lines"),
> dark trousers, sturdy laced boots — with thin saturated-cyan seam lines and small electric-blue
> accent panels, flat colour only. No helmet, no cape. Archery adds "she carries a training bow of
> matte dark material with one thin electric-blue accent stripe"; swordsmanship adds "a matte dark
> training sword with a thin electric-blue line running along the blade and a dark wrapped grip".

Every sprite prompt below is **verbatim as generated** (both anchors included in full, ending with
the pure-white isolation clause). Raws resolve by stem, newest wins — `vibe_images/<stem>_<ts>_<hash>.png`.

**Regeneration history** (only the final prompts are listed below):

- `background-electric-archery` — v2 added the explicit "absolutely no people" clause. M12 (ground
  contract): v3 regenerated with the 55% floor-line sentence; the model still drew the line at 61%
  (v4/v5 re-missed at 68% and were discarded), so the wired raw is v3 corrected by a deterministic
  48px up-shift with the floor strip tiled into the bottom edge — measured junction bg px 793.
  `background-electric-sword` (+11px shift → bg 792) and default `background-sample` (+24px shift
  → bg 789) got the same correction; v2's archery junction had sat at bg 938, +73.5px of float.
- `knight-electric-sword-idle-attack` — drafts 1–2 let the attack pose's blade cross the sheet
  midline, which left a floating blade fragment in the idle half after splitting; the final prompt
  pins each pose and its sword inside its own half, blade horizontal pointing right.
- `beat-electric-sword-mid`, `beat-electric-sword-low`, `finalknight-electric-low-average` — the
  earlier drafts' grey paper / drop shadows would have survived keying as grey smudges; the final
  prompts demand pure white `#FFFFFF`, no vignette, no drop/ground shadows.
- `logo-electric-wordmark` — v1 baked a grey drop shadow behind the letters; the final prompt bans
  shadows, bevel and 3D.


### Electric / archery

**`background`** — raw `background-electric-archery-v3` (M12 — regenerated for ground contact under
the contract; wired file is the 48px groundfix `background-electric-archery-v3_groundfix_…`,
measured junction bg px 793 → stage Y 396.5. v2's junction sat at bg px 938 — +73.5px of float.)

> 2D anime game background in flat cel-shaded style matching a cel-shaded sprite game: crisp clean dark outlines, limited palette, simple shading only, no texture noise. A futuristic tech training bay interior — a completely empty room with absolutely no people: no characters, no figures, no silhouettes, no mannequins, no statues, no animals. Architecture and props only: dark slate metal wall panels with faint recessed cyan circuit lines, a horizontal industrial fence of dark metal posts and rails running behind the target area, dark polished concrete floor with two faint cyan guide lines, thin neon strip lights in pale sky blue and saturated cyan along the ceiling and the far wall; high-tech props only at the far left and right edges (a stack of dark supply crates with small cyan status lights on the left, a rack of plasma training spears on the right). Wide 16:9 composition. The back wall meets the floor at a horizontal line exactly 55% of the image height from the top edge (acceptably between 54% and 57%); the floor begins immediately below that line and continues to the bottom edge of the image. The middle band of the wall and floor — where five training targets will stand — is completely bare: no targets, no figures, no poster, no markings in that band. The lower quarter of the image is completely plain empty dark floor with no detail and no objects — a game character sprite is placed there later. No people, no text, no logo, no watermark.

(v2 for the record — superseded: same scene without the ground sentence; its floor line landed at
bg px 938 and the archery targets floated +73.5px above the floor.)

**`knight.idle` + `knight.attack` (one sheet, left→right)** — raw `knight-electric-archery-idle-attack`

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise, no gradients beyond gentle shading. Dark charcoal, slate and deep navy palette with flat saturated-cyan and electric-blue accent shapes — every accent is a flat colour with crisp outlines, no glow, no bloom, no light halos. A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright green eyes, calm confident expression. Dark charcoal technical training outfit keeping the same silhouette as simple leather training gear: a fitted jacket-style tunic with small rounded shoulder pauldrons, bracers on her forearms, dark trousers, sturdy laced boots — with thin saturated-cyan seam lines and small electric-blue accent panels, flat colour only. No helmet, no cape. She carries a training bow of matte dark material with one thin electric-blue accent stripe. Two full-body poses of the same character standing side by side on one image, evenly spaced, identical size, feet on the same invisible ground line, clear empty space between them. LEFT POSE: relaxed idle, standing upright, bow held low at her side, facing three-quarters right. RIGHT POSE: drawing the bow — left arm extended holding the bow toward the right, right hand pulling the string back to her cheek, aiming right. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`knight.celebrate` + `knight.fail` (one sheet, left→right)** — raw `knight-electric-archery-celebrate-fail`

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise, no gradients beyond gentle shading. Dark charcoal, slate and deep navy palette with flat saturated-cyan and electric-blue accent shapes — every accent is a flat colour with crisp outlines, no glow, no bloom, no light halos. A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright green eyes. Dark charcoal technical training outfit keeping the same silhouette as simple leather training gear: a fitted jacket-style tunic with small rounded shoulder pauldrons, bracers on her forearms, dark trousers, sturdy laced boots — with thin saturated-cyan seam lines and small electric-blue accent panels, flat colour only. No helmet, no cape. She carries a training bow of matte dark material with one thin electric-blue accent stripe. Two full-body poses of the same character standing side by side on one image, evenly spaced, identical size, feet on the same invisible ground line, clear empty space between them. LEFT POSE: celebrating — bow raised high in one hand, fist clenched, big smile, slight upward hop. RIGHT POSE: dejected — bow lowered to the ground, shoulders slumped, sighing, eyes closed. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`target.idle` + `target.hit` (one sheet, left→right)** — raw `target-electric-idle-hit`

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise, no gradients beyond gentle shading. Two versions of the same round training target standing side by side on one image, evenly spaced, identical size and angle, feet on the same invisible ground line, clear empty space between them. The target: a round straw archery target on two simple wooden tripod legs, front view, slightly angled, painted concentric rings in an electric palette — wide outer ring pale sky blue, middle ring saturated cyan, bullseye bright electric blue — crisp dark outlines, and small crackling saturated-cyan lightning arcs hugging the rim (the arcs are medium cyan, never white, no glow). LEFT POSE: intact and calm, lightning arcs softly crackling on the rim. RIGHT POSE: just struck — the bullseye punched with a crackling saturated-cyan spark burst at the centre, a few straw flecks flying, the target tilted a few degrees. The legs stand straight and the feet are the very lowest part of the drawing — fully grounded, nothing floating. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`projectile`** — raw `arrow-electric`

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise. Single arrow flying horizontally pointing right: sleek matte dark shaft with a thin electric-blue line running along it, compact triangular dark-steel head, pale cyan feather fletching, a faint thin cool-toned motion streak behind it. Isolated on a perfectly flat uniform pure white background, no shadow, no other objects, no text.

**`hitEffect`** — raw `hiteffect-electric`

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise, no gradients beyond gentle shading. Small circular impact burst: flat starburst of sharp shards in saturated cyan and electric blue with a deep electric-blue core, a few small lightning-crackle spikes between the shards, crisp dark outlines around every shard, anime impact feel. The burst sits centred in the frame with generous even margin. Isolated on a perfectly flat uniform pure white background, nothing else, no text.

**`animation.3-4` (section end, bullseye)** — raw `beat-electric-archery-high` (regenerated once for flatness)

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise. A round training target on two simple wooden tripod legs, front view, slightly angled, painted concentric rings in an electric palette — wide outer ring pale sky blue, middle ring saturated cyan, bullseye bright electric blue — crisp dark outlines, small crackling saturated-cyan lightning arcs hugging the rim (the arcs are medium cyan colour, never white, no glow). The bullseye is densely shot through with several training arrows — sleek matte dark shafts, pale cyan fletching — forming a tight victorious cluster, and a few small flat electric-blue and pale-cyan four-point sparkle stars float around the rim. Isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`animation.1-2.9`** — raw `beat-electric-archery-mid` (regenerated once for flatness)

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise. A round training target on two simple wooden tripod legs, front view, slightly angled, painted concentric rings in an electric palette — wide outer ring pale sky blue, middle ring saturated cyan, bullseye bright electric blue — crisp dark outlines, small crackling saturated-cyan lightning arcs hugging the rim (the arcs are medium cyan colour, never white, no glow). Two or three training arrows — sleek matte dark shafts, pale cyan fletching, thin electric-blue accent lines — are stuck in the upper and side rings, slightly off-centre; beside the target on the ground lie a dark quiver with a few arrows, the matte dark training bow with one thin electric-blue stripe, and a pair of dark gloves — a tidy gear pile after a middling session. Isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no people, no text.

**`animation.0-0.9`** — raw `beat-electric-archery-low` (regenerated once for flatness)

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise. A round training target on two simple wooden tripod legs, front view, slightly angled, painted concentric rings in an electric palette — wide outer ring pale sky blue, middle ring saturated cyan, bullseye bright electric blue — crisp dark outlines, small crackling saturated-cyan lightning arcs hugging the rim (the arcs are medium cyan colour, never white, no glow). The target stands intact with no arrows stuck in it — a disappointing session; beside it, two training arrows (sleek matte dark shafts, pale cyan fletching) lie flat on the ground where they fell, one crossed over the other. Isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no people, no text.


### Electric / boxing

**`background`** — raw `background-electric-boxing`

> 2D anime game background in flat cel-shaded style matching a cel-shaded sprite game: crisp clean dark outlines, limited palette, simple shading only, no texture noise. A futuristic tech training hall interior — a completely empty room with absolutely no people: no characters, no figures, no silhouettes, no mannequins, no statues, no animals. Architecture and props only: dark slate metal wall panels with faint recessed cyan circuit lines, structural dark ceiling girders, a low horizontal industrial rail running high along the wall, dark polished concrete floor; high-tech training props only at the far left and right edges (a neat stack of rolled dark training mats with a small cyan status light on the left, a simple dark bench on the right). Wide 16:9 composition. The back wall meets the floor at a horizontal line exactly 55% of the image height from the top edge (between 54% and 57%); the floor begins immediately below that line and continues to the bottom edge of the image. The middle band of the wall and floor — where five hanging training bags will be placed later — is completely bare: no bags, no figures, no poster, no markings in that band. The lower quarter of the image is completely plain empty dark floor with no detail and no objects — a game character sprite is placed there later. No people, no text, no logo, no watermark.

**`knight.idle` + `knight.attack` (one sheet, left→right)** — raw `knight-electric-boxing-idle-attack`

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise, no gradients beyond gentle shading. Dark charcoal, slate and deep navy palette with flat saturated-cyan and electric-blue accent shapes — every accent is a flat colour with crisp outlines, no glow, no bloom, no light halos. A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright green eyes, calm confident expression. Dark charcoal technical training outfit keeping the same silhouette as simple leather training gear: a fitted jacket-style tunic with small rounded shoulder pauldrons, dark trousers, sturdy laced boots — with thin saturated-cyan seam lines and small electric-blue accent panels, flat colour only. No helmet, no cape. Her hands are wrapped in dark training hand-wraps with thin saturated-cyan seam lines. Two full-body poses of the same character standing side by side on one image, evenly spaced, identical size, feet on the same invisible ground line, clear empty space between them. LEFT POSE: relaxed idle, standing upright in a light boxing guard, both wrapped fists raised to her chin, facing three-quarters right. RIGHT POSE: throwing a straight right punch — right arm fully extended toward the right, torso twisted, left fist guarding her chin, facing right. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`knight.celebrate` + `knight.fail` (one sheet, left→right)** — raw `knight-electric-boxing-celebrate-fail`

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise, no gradients beyond gentle shading. Dark charcoal, slate and deep navy palette with flat saturated-cyan and electric-blue accent shapes — every accent is a flat colour with crisp outlines, no glow, no bloom, no light halos. A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright green eyes. Dark charcoal technical training outfit keeping the same silhouette as simple leather training gear: a fitted jacket-style tunic with small rounded shoulder pauldrons, dark trousers, sturdy laced boots — with thin saturated-cyan seam lines and small electric-blue accent panels, flat colour only. No helmet, no cape. Her hands are wrapped in dark training hand-wraps with thin saturated-cyan seam lines. Two full-body poses of the same character standing side by side on one image, evenly spaced, identical size, feet on the same invisible ground line, clear empty space between them. LEFT POSE: celebrating — both wrapped fists raised high above her head, big smile, slight upward hop. RIGHT POSE: dejected — shoulders slumped, arms hanging, sighing, eyes closed. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`target.idle` + `target.hit` (one sheet, left→right)** — raw `target-electric-boxing-bag-idle-hit`

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise, no gradients beyond gentle shading. Two versions of the same heavy punching bag shown side by side on one image, evenly spaced, identical size, hanging from the top edge of the image, clear empty space between them. The bag: a dark charcoal heavy training bag with thin saturated-cyan stitched seam lines, one pale sky-blue cloth wrapping band around its middle, hanging from a dark metal chain with a swivel at the top — crisp dark outlines, flat colour only, no glow. LEFT POSE: intact and calm, hanging straight with a slight tilt, chain vertical. RIGHT POSE: just struck — swung sideways with the chain angled, the pale band shifted a little, a few small flat pale-blue impact puff shapes floating at the lower right of the bag. The chain reaches the very top edge of the image so the bag hangs with nothing floating free above it. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`hitEffect`** — raw `hiteffect-electric-boxing`

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise, no gradients beyond gentle shading. Small circular impact burst: flat starburst of sharp shards in saturated cyan and electric blue with a deep electric-blue core, a few small flat pale-blue impact puff cloud shapes floating between the shards, crisp dark outlines around every shard, anime impact feel. The burst sits centred in the frame with generous even margin. Isolated on a perfectly flat uniform pure white background, nothing else, no text.

**`animation.3-4`** — raw `beat-electric-boxing-high`

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise. A dark charcoal heavy training bag swinging wildly, hanging from a dark metal chain entering from the upper left, tilted steeply mid-swing, with a large flat electric-blue and saturated-cyan starburst impact burst at its lower right and thin flat motion swoosh arcs curving around the bag, plus a few small flat electric-blue and pale-cyan four-point sparkle stars floating around — crisp dark outlines, flat colour only, no glow, no bloom. Isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`animation.1-2.9`** — raw `beat-electric-boxing-mid`

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise. A dark charcoal heavy training bag hanging calmly from a dark metal chain, tilted very slightly, with a faint dotted pale-blue swing arc curving to its right, a small flat pale-blue impact puff floating at its lower left, and beside it on the ground below a neatly coiled dark jump rope with thin cyan accents — a tidy boxing corner after a middling session; crisp dark outlines, flat colour only, no glow. Isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no people, no text.

**`animation.0-0.9`** — raw `beat-electric-boxing-low`

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise. A dark charcoal heavy training bag hanging from a long dark metal chain that extends to the top edge of the image, tilted to one side, with a torn rip at its lower right corner spilling pale stuffing foam out into a small mess on the ground below — a disappointing session; crisp dark outlines, flat colour only, no glow. Isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no people, no text.


### Electric / swordsmanship

**`background`** — raw `background-electric-sword` (M12: wired file is the 11px groundfix `background-electric-sword_groundfix_…` — the raw's junction sat at bg px 812, +10.5px of float; corrected junction bg px 792 → stage Y 396)

> 2D anime game background in flat cel-shaded style matching a cel-shaded sprite game: crisp clean dark outlines, limited palette, simple shading only, no texture noise. A futuristic outdoor training yard at dusk — completely empty, absolutely no people: no characters, no figures, no silhouettes, no mannequins, no statues, no animals. Architecture and props only: a dark metal palisade fence and a low dark concrete wall behind a strip of dark green turf, distant faceless industrial facility blocks with faint cyan window strips far in the background, dark paved ground with two faint cyan guide lines; high-tech training props only at the far left and right edges (a rack of matte dark practice swords on the left, a stand with two dark round training shields on the right). Wide 16:9 composition. The back wall meets the floor at a horizontal line exactly 55% of the image height from the top edge (between 54% and 57%); the floor begins immediately below that line and continues to the bottom edge of the image. The middle band — where five training dummies will stand later — is completely bare: no dummies, no figures, no poster, no markings in that band. The lower quarter of the image is completely plain empty dark ground with no detail and no objects — a game character sprite is placed there later. No people, no text, no logo, no watermark.

**`knight.idle` + `knight.attack` (one sheet, left→right)** — raw `knight-electric-sword-idle-attack` (3rd draft — the first two crossed the sheet midline (see history))

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise, no gradients beyond gentle shading. Dark charcoal, slate and deep navy palette with flat saturated-cyan and electric-blue accent shapes — every accent is a flat colour with crisp outlines, no glow, no bloom, no light halos. A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright green eyes, calm confident expression. Dark charcoal technical training outfit keeping the same silhouette as simple leather training gear: a fitted jacket-style tunic with small rounded shoulder pauldrons, leather-style bracers on her forearms, dark trousers, sturdy laced boots — with thin saturated-cyan seam lines and small electric-blue accent panels, flat colour only. No helmet, no cape. She carries a matte dark training sword with a thin electric-blue line running along the blade and a dark wrapped grip. Two full-body poses of the same character standing side by side on one image, evenly spaced, identical size, feet on the same invisible ground line, and a wide clear empty gap between the two poses — each character and her sword must stay fully inside her own half of the image, nothing may cross the middle. LEFT POSE: relaxed idle, standing upright, the training sword resting on her right shoulder, the blade angled up and back over her shoulder, facing three-quarters right. RIGHT POSE: slashing — torso twisted, her sword arm extended and the blade held horizontally pointing straight toward the right edge of the image, the whole sword far away from the middle of the image, a focused expression. Each pose contains only the character and her sword — no other objects, no floating fragments, no extra props. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no text.

**`knight.celebrate` + `knight.fail` (one sheet, left→right)** — raw `knight-electric-sword-celebrate-fail`

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise, no gradients beyond gentle shading. Dark charcoal, slate and deep navy palette with flat saturated-cyan and electric-blue accent shapes — every accent is a flat colour with crisp outlines, no glow, no bloom, no light halos. A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright green eyes. Dark charcoal technical training outfit keeping the same silhouette as simple leather training gear: a fitted jacket-style tunic with small rounded shoulder pauldrons, leather-style bracers on her forearms, dark trousers, sturdy laced boots — with thin saturated-cyan seam lines and small electric-blue accent panels, flat colour only. No helmet, no cape. She carries a matte dark training sword with a thin electric-blue line running along the blade. Two full-body poses of the same character standing side by side on one image, evenly spaced, identical size, feet on the same invisible ground line, clear empty space between them. LEFT POSE: celebrating — the training sword thrust high in one hand, other fist clenched, big smile, slight upward hop. RIGHT POSE: dejected — the sword tip resting on the ground in front of her, head bowed, shoulders slumped, eyes closed. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`target.idle` + `target.hit` (one sheet, left→right)** — raw `target-electric-sword-dummy-idle-hit`

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise, no gradients beyond gentle shading. Two versions of the same dark composite training dummy shown side by side on one image, evenly spaced, identical size, standing on the same invisible ground line, clear empty space between them. The dummy: a blocky character-shaped practice dummy of matte dark material — a simple carved head, stubby crossbar arms, a thick body post standing on a round dark wooden base — wrapped with thin saturated-cyan strap bands around the neck, waist and arm ends, crisp dark outlines, flat colour only, no glow. LEFT POSE: intact and calm, standing perfectly upright. RIGHT POSE: just struck — tilted a few degrees, with a broad pale slash groove carved across its chest, a few flat electric-blue angular flecks and small dark chips flying around it. The round base stands flat and is the very lowest part of the drawing — fully grounded, nothing floating. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`hitEffect`** — raw `hiteffect-electric-sword`

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise, no gradients beyond gentle shading. A flat crescent slash arc sweeping diagonally across the frame: the broad arc in saturated cyan shading to pale sky blue, with a deep electric-blue core line running along the inside of the arc, and a few flat angular shard fragments with crisp dark outlines flying at the upper right — crisp anime slash-impact feel, flat colour only, no glow, no bloom, no light halos. The slash sits centred in the frame with generous even margin. Isolated on a perfectly flat uniform pure white background, nothing else, no text.

**`animation.3-4`** — raw `beat-electric-sword-high`

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise. A dark composite training dummy standing upright — blocky carved head, stubby crossbar arms, thin saturated-cyan strap bands — with a matte dark training sword plunged deep into its chest, the blade sticking out diagonally toward the upper right; big flat electric-blue and pale-cyan four-point sparkle stars float around it and a few flat angular chips fly outward — crisp dark outlines, flat colour only, no glow, no bloom. Isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`animation.1-2.9`** — raw `beat-electric-sword-mid` (final prompt after the pure-white fix)

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise. A dark composite training dummy standing upright — blocky carved head, stubby crossbar arms, thin saturated-cyan strap bands, round dark base — with a matte dark training sword leaning against its side, the blade tip resting on the ground, and a few faint pale scratch marks on its chest — a well-used practice corner after a middling session; crisp dark outlines, flat colour only, no glow. The whole scene sits on a perfectly flat uniform pure white background — the background must be pure white #FFFFFF, not grey, with no vignette; no drop shadow under the dummy, no shadow under the sword, no ground shadow shapes, no floor line, no people, no text.

**`animation.0-0.9`** — raw `beat-electric-sword-low` (final prompt after the pure-white fix)

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise. A dark composite training dummy broken and fallen flat on the ground — the practice post snapped, the carved head, crossbar arms and body sections cracked apart and lying in a small pile with a few snapped dark planks beside it — and the matte dark training sword stuck diagonally into the ground at the right side, with a few flat scratch marks on the ground beneath it; crisp dark outlines, flat colour only, no glow. Everything floats on a perfectly flat uniform pure white background — the background must be pure white #FFFFFF; absolutely no drop shadows under the broken pieces or the sword, no soft ground shadow shapes of any kind, no vignette, no floor line, no people, no text.


### Electric / title and results

**`title.background`** — raw `background-electric-title`

> 2D anime game background in flat cel-shaded style matching a cel-shaded sprite game: crisp clean dark outlines, limited palette, simple shading only, no texture noise. The futuristic tech training bay at neon dusk seen through a large open gate — completely empty, absolutely no people: no characters, no figures, no silhouettes, no mannequins, no statues, no animals. Architecture only: dark gate structure walls on the left and right with thin cyan edge strips, cool pale-blue and cyan neon light pooling on the dark ground in front of the gate, the row of round training targets and the industrial metal fence visible in the distance beyond the gate; wide 16:9 composition, plain empty ground across the lower quarter with no objects — a game sprite sits there later. The back wall meets the floor at a horizontal line exactly 55% of the image height from the top edge (between 54% and 57%); the floor begins immediately below that line and continues to the bottom edge of the image. No people, no text, no logo, no watermark.

**`logo`** — raw `logo-electric-wordmark` (regenerated — v1 baked in a grey drop shadow)

> 2D anime game logo in flat cel-shaded style, crisp clean dark outlines, limited palette, simple shading only. Wordmark "AI-READY KNIGHT" on two lines — flat futuristic stencil lettering with slightly angular cut corners, pale sky-blue flat fill with a saturated electric-blue outline, flat colour only: no drop shadow behind the letters, no grey shadow, no bevel, no 3D effect, no glow, no texture. Thick clean uniform letter shapes, both words complete and correctly spelled. Isolated on a perfectly flat uniform pure white background, nothing else, no other text.

**`results.background`** — raw `background-electric-results`

> 2D anime game background in flat cel-shaded style matching a cel-shaded sprite game: crisp clean dark outlines, limited palette, simple shading only, no texture noise. The quiet futuristic tech training bay after the session, dim evening mood — completely empty, absolutely no people: no characters, no figures, no silhouettes, no mannequins, no statues, no animals. Architecture and props only: dark slate metal wall panels with faintly dimmed recessed cyan circuit lines, a few dark supply crates with small unlit status lights, and the round training targets toppled over on the ground with training arrows lying beside them; wide 16:9 composition, plain uncluttered floor. The back wall meets the floor at a horizontal line exactly 55% of the image height from the top edge (between 54% and 57%); the floor begins immediately below that line and continues to the bottom edge of the image. No text, no logo, no watermark.

**`finalKnight.low_average`** — raw `finalknight-electric-low-average` (final prompt after the pure-white fix)

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise, no gradients beyond gentle shading. Dark charcoal, slate and deep navy palette with flat saturated-cyan and electric-blue accent shapes — every accent is a flat colour with crisp outlines, no glow, no bloom, no light halos. A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright green eyes. Dark charcoal technical training outfit keeping the same silhouette as simple leather training gear: a fitted jacket-style tunic with small rounded shoulder pauldrons, bracers on her forearms, dark trousers, sturdy laced boots — with thin saturated-cyan seam lines and small electric-blue accent panels, flat colour only. No helmet, no cape. Full-body results portrait: still in the dark charcoal technical training outfit, training bow held in her hand, determined look. Isolated on a perfectly flat uniform pure white background — the background must be pure white #FFFFFF with absolutely no grey tone, no vignette, no background gradient, no shadow under her feet, no floor line, no other objects, no text.

**`finalKnight.average`** — raw `finalknight-electric-average`

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise, no gradients beyond gentle shading. Dark charcoal, slate and deep navy palette with flat saturated-cyan and electric-blue accent shapes — every accent is a flat colour with crisp outlines, no glow, no bloom, no light halos. A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright green eyes. Full-body results portrait: plain powered plate armour over the dark technical training tunic — simple matte grey-white armour plates with thin saturated-cyan seam lines, flat colour only — the training sword at her side, nodding, calm confident expression, no helmet, no cape. Isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`finalKnight.high_average`** — raw `finalknight-electric-high-average`

> 2D anime game sprite in flat cel-shaded style, crisp clean dark outlines, Pokémon-era limited palette, simple soft shading only, no texture noise, no gradients beyond gentle shading. Dark charcoal, slate and deep navy palette with flat saturated-cyan and electric-blue accent shapes — every accent is a flat colour with crisp outlines, no glow, no bloom, no light halos. A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright green eyes. Full-body results portrait: flashy white-and-electric-blue powered plate armour with bright saturated-cyan seam accents, flat colour only, celebrating with a big smile, her training bow and training sword crossed behind her, no helmet, no cape. Isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.


**Status (2026-10-13):** all raws above live in `vibe_images/`; the processed outputs are
`art/electric/**` (40 files); every slot was wired by `pnpm art:wire electric`; the full-set
playthrough proof and the scratch-mode fallback re-proof are described in `docs/modes.md`.

M12(a) (2026-10-14): the archery background was regenerated under the ground contract (raw
`background-electric-archery-v3`, then the 48px groundfix — measured junction bg px 793) and the
swordsmanship background ground-fixed by an 11px shift (junction bg px 792); v2's archery junction
had sat at bg px 938. Every prompt above now carries the ground-contact sentence.

---

## Default16 set (M12(c), 2026-10-14)

A full 43-slot 16-bit SNES-era pixel-art re-skin of `default` on slug `default16` — same knight,
same scenes, same questions (byte-identical by contract), rendered as if the game had shipped on a
16-bit console. Like every prior set, the sample went through the side-by-side gate first
(`node scripts/art/compare-sets.mjs archery` — sheet at `docs/art-sample/compare-default16-archery.png`
plus review frames `review-default16-*.png`), then the remaining raws were generated in one
consistent pass (31 raws total over both passes), processed with
`node scripts/art/process-set.mjs default16` and wired onto a freshly duplicated mode:
`pnpm mode:dup default16` (new scripted equivalent of the admin "duplicate" — copies
theme/title/questions/ai, never asset relations) + `pnpm art:wire default16` (media uploads carry
the `default16-` prefix). 40 files over 43 slots; `/default` and `/electric` untouched except the
M12(a) ground fixes.

**Style anchor (verbatim, every prompt):**

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no
> anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional
> 2-pixel dithering, no texture noise, no gradients beyond dithering, no glow, no bloom.

Backgrounds swap "game sprite" for "game background in the style of a 16-bit console RPG battle
backdrop" (and drop the gradients clause); projectile and hit effects drop the dithering clause.
The default **character anchor** (above) is used verbatim — same knight, same palette.

**Pixel-art pipeline deltas** (`process-set.mjs`, identical otherwise): all resampling is
nearest-neighbour — sharp's default lanczos blurs pixel art into mush (this was called out in the
M12 brief). The white-key/fringe/pocket passes are unchanged and key even cleaner on flat pixel
regions. The global knight constant landed at **K=533** (vs 545 for `default` — the pixel-art
raws draw her ~2% smaller; logged as an imperceptible drift and accepted). All ground-contact
numbers land exactly on the M12 contract: every standing sprite's alpha-bbox feet at canvas row
395, every background junction in the 786–796 band, measured by `scripts/art/check-ground.mjs`
(archery bg 788 via an edgeVote probe; swordsmanship bg 787.5 via the hue probe after the fix
below; boxing/title/results SKIP with documented reasons).

**Regeneration history:**

- `background-default16-sword` — the ground sentence alone did not survive the pixel-art style:
  v1 drew the lawn from 40.6% of height, v2 (explicit "lawn fills the entire lower half… from the
  vertical middle") landed at 34.9%, regen3 (cloudless-sky clause + "the top of the green lawn
  meets the base of the stone wall") at 53.1% — close, but it baked a practice dummy, a target
  butt and a shield stand into the right target band (raw x≈1195–1376) plus a shield stand on the
  left (raw x≈185–310). Fix, no regen: the props were painted out with same-row flat wall/lawn
  rectangle blits (pixel-art flat colour makes the patches invisible), then the whole image
  shifted down 13px with the vacated sky strip filled flat from the row-10 sky colour. Measured
  junction bg px **787.5** → wired raw `background-default16-sword_groundfix_…`. The rejected
  v1/regen2/regen3 raws were deleted (M12(a) precedent — disk keeps only the wired raw).
- `background-default16-archery` / `-boxing` / `-title` / `-results` measured in-band (or SKIP)
  on the first try — no fix pass needed.
- Everything else generated clean on the first try; the pocket-clearing pass mattered on the
  bow loop and bag chains as usual.

Raws resolve by stem, newest wins — `vibe_images/<stem>_<ts>_<hash>.png`. Every prompt below is
**verbatim as generated**.

### Default16 / archery (sample section)

**`background`** — raw `background-default16-archery_1791952745221_0f54f242.png` (wired directly —
measured junction bg px 788, in band, no shift)

> 16-bit SNES-era pixel-art game background in the style of a 16-bit console RPG battle backdrop: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no glow. A simple medieval barracks training yard, empty, no people: a low stone wall and wooden palisade fence behind a beaten dirt ground, a few straw bales and a wooden rack of training spears only at the far left and right edges, soft blue sky with a few flat pixel clouds, wide 16:9 composition, plain uncluttered middle band, completely plain dirt ground in the lower quarter. The back wall meets the floor at a horizontal line exactly 55% of the image height from the top edge (between 54% and 57%); the floor begins immediately below that line and continues to the bottom edge of the image. No text.

**`knight.idle` + `knight.attack` (one sheet, left→right)** — raw `knight-default16-archery-idle-attack_1791952723978_b1a218ed.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no gradients beyond dithering, no glow, no bloom. A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright green eyes, calm confident expression. Simple brown leather training gear: fitted leather tunic with small rounded shoulder pauldrons, leather bracers on her forearms, dark brown trousers, sturdy laced boots. No helmet, no cape. She carries a simple wooden training bow. Two full-body poses of the same character standing side by side on one image, evenly spaced, identical size, feet on the same invisible ground line, clear empty space between them. LEFT POSE: relaxed idle, standing upright, bow held low at her side, facing three-quarters right. RIGHT POSE: drawing the bow — left arm extended holding the bow toward the right, right hand pulling the string back to her cheek, aiming right. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`knight.celebrate` + `knight.fail` (one sheet, left→right)** — raw `knight-default16-archery-celebrate-fail_1791952733909_c16d3dee.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no gradients beyond dithering, no glow, no bloom. A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright green eyes. Simple brown leather training gear: fitted leather tunic with small rounded shoulder pauldrons, leather bracers on her forearms, dark brown trousers, sturdy laced boots. No helmet, no cape. She carries a simple wooden training bow. Two full-body poses of the same character standing side by side on one image, evenly spaced, identical size, feet on the same invisible ground line, clear empty space between them. LEFT POSE: celebrating — bow raised high in one hand, fist clenched, big smile, slight upward hop. RIGHT POSE: dejected — bow lowered to the ground, shoulders slumped, sighing, eyes closed. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`target.idle` + `target.hit` (one sheet, left→right)** — raw `target-default16-idle-hit_1791952755443_dc28a30a.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no gradients beyond dithering, no glow, no bloom. Two versions of the same round straw archery target standing side by side on one image, evenly spaced, identical size and angle, feet on the same invisible ground line, clear empty space between them. The target: a round straw archery target butt on two simple wooden tripod legs, front view, slightly angled, painted concentric rings — wide outer cream ring, middle red-oxide ring, gold-yellow bullseye — visible straw pixel weave. LEFT POSE: intact and calm. RIGHT POSE: just struck — the bullseye punched, a few straw flecks flying, the target tilted a few degrees. The legs stand straight and the feet are the very lowest part of the drawing — fully grounded, nothing floating. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`projectile`** — raw `arrow-default16_1791952782695_5f36b261.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, no texture noise, no glow. Single arrow flying horizontally pointing right: wooden shaft, triangular dark-steel head, white feather fletching, faint pixel motion streak behind it. Isolated on a perfectly flat uniform pure white background, no shadow, no text.

**`hitEffect`** — raw `hiteffect-default16_1791952794710_a2083149.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, no texture noise, no glow. Small circular impact burst: flat pixel starburst of cream and gold shards with a red-oxide centre, anime impact feel, the burst centred in the frame with generous even margin. Isolated on a perfectly flat uniform pure white background, no shadow, no text.

**`animation.3-4`** — raw `beat-default16-archery-high_1791952805567_5a2dab31.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no gradients beyond dithering, no glow, no bloom. A round straw archery target on two simple wooden tripod legs, front view, slightly angled, painted concentric rings — wide outer cream ring, middle red-oxide ring, gold-yellow bullseye — the bullseye densely shot through with several wooden training arrows forming a tight victorious cluster, a few small flat gold four-point pixel sparkle stars floating around the rim. The legs stand straight and the feet are the very lowest part of the drawing — fully grounded, nothing floating. Isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no people, no text.

**`animation.1-2.9`** — raw `beat-default16-archery-mid_1791954282810_7ec1caae.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no glow. A round straw archery target on two simple wooden tripod legs, front view, slightly angled, painted concentric rings — wide outer cream ring, middle red-oxide ring, gold-yellow bullseye — visible straw pixel weave. Two or three wooden training arrows are stuck in the upper and side rings, slightly off-centre; beside the target on the ground lie a brown quiver with a few arrows, the simple wooden training bow, and a pair of brown leather gloves — a tidy gear pile after a middling session. The legs stand straight and the feet are the very lowest part of the drawing — fully grounded, nothing floating. Isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no people, no text.

**`animation.0-0.9`** — raw `beat-default16-archery-low_1791954292440_5edc2f35.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no glow. A round straw archery target on two simple wooden tripod legs, front view, slightly angled, painted concentric rings — wide outer cream ring, middle red-oxide ring, gold-yellow bullseye — visible straw pixel weave. The target stands intact with no arrows stuck in it — a disappointing session; beside it, two wooden training arrows lie flat on the ground where they fell, one crossed over the other. The legs stand straight and the feet are the very lowest part of the drawing — fully grounded, nothing floating. Isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no people, no text.

### Default16 / boxing

**`background`** — raw `background-default16-boxing_1791954471217_71ec902c.png` (wired directly —
interior wall/floor are near-uniform, junction check SKIP with reason)

> 16-bit SNES-era pixel-art game background in the style of a 16-bit console RPG battle backdrop: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no glow. A simple medieval training hall interior, empty, no people: stone walls, timber ceiling beams, a low horizontal wooden rail high on the wall, wooden plank floor. Training props only along the far left and right edges (rolled mats, a bench). The middle band of the wall and floor — where five hanging bags are placed later — is completely bare: no bags, no props, no drawings on the wall in that band. The back wall meets the floor at a horizontal line exactly 55% of the image height from the top edge (between 54% and 57%); the floor begins immediately below that line and continues to the bottom edge of the image. No text.

**`knight.idle` + `knight.attack` (one sheet, left→right)** — raw `knight-default16-boxing-idle-attack_1791954142446_4af98a35.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no gradients beyond dithering, no glow, no bloom. A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright green eyes, calm confident expression. Simple brown leather training gear: fitted leather tunic with small rounded shoulder pauldrons, leather bracers on forearms, dark brown trousers, sturdy laced boots. No helmet, no cape. Her hands are wrapped in long white cloth boxing bandages. Two full-body poses of the same character standing side by side on one image, evenly spaced, identical size, feet on the same invisible ground line, and a wide clear empty gap between the two poses — each character must stay fully inside her own half of the image, nothing may cross the middle. LEFT POSE: relaxed idle, standing upright in a light boxing guard, both wrapped fists raised to her chin, facing three-quarters right. RIGHT POSE: throwing a straight right punch — right arm fully extended toward the right, torso twisted, left fist guarding her chin, facing right. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`knight.celebrate` + `knight.fail` (one sheet, left→right)** — raw `knight-default16-boxing-celebrate-fail_1791954152986_9153d979.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no gradients beyond dithering, no glow, no bloom. A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright green eyes. Simple brown leather training gear: fitted leather tunic with small rounded shoulder pauldrons, leather bracers on forearms, dark brown trousers, sturdy laced boots. No helmet, no cape. Her hands are wrapped in long white cloth boxing bandages. Two full-body poses of the same character standing side by side on one image, evenly spaced, identical size, feet on the same invisible ground line, and a wide clear empty gap between the two poses — each character must stay fully inside her own half of the image, nothing may cross the middle. LEFT POSE: celebrating — both wrapped fists raised high above her head, big smile, slight upward hop. RIGHT POSE: dejected — shoulders slumped, arms hanging, sighing, eyes closed. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`target.idle` + `target.hit` (one sheet, left→right)** — raw `target-default16-boxing-bag-idle-hit_1791954202265_27b2c9b7.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no glow. Two versions of the same heavy punching bag shown side by side on one image, evenly spaced, identical size, hanging from the top edge of the image, clear empty space between them. The bag: a heavy brown leather training bag with stitched seam lines and one pale cloth wrapping band around its middle, hanging from a dark metal chain with a swivel at the top — crisp pixel outlines, flat colour only, no glow. LEFT POSE: intact and calm, hanging straight with a slight tilt, chain vertical. RIGHT POSE: just struck — swung sideways with the chain angled, the pale band shifted a little, a few small flat cream impact puff shapes floating at the lower right of the bag. The chain reaches the very top edge of the image so the bag hangs with nothing floating free above it. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`hitEffect`** — raw `hiteffect-default16-boxing_1791954250160_b4493b60.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, no texture noise, no glow. Small circular impact burst: flat pixel starburst of cream and gold shards with a red-oxide centre, a few small flat cream impact puff cloud shapes floating between the shards, anime impact feel, the burst centred in the frame with generous even margin. Isolated on a perfectly flat uniform pure white background, nothing else, no text.

**`animation.3-4`** — raw `beat-default16-boxing-high_1791954302599_73e7ede4.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, no texture noise, no glow. A heavy brown leather training bag with stitched seam lines and one pale cloth wrapping band swinging wildly, hanging from a dark metal chain entering from the upper left, tilted steeply mid-swing, with a large flat cream and gold starburst impact burst at its lower right and thin flat pixel motion swoosh arcs curving around the bag, plus a few small flat gold four-point sparkle stars floating around — crisp pixel outlines, flat colour only, no glow. Isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`animation.1-2.9`** — raw `beat-default16-boxing-mid_1791954311422_a21c222b.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, no texture noise, no glow. A heavy brown leather training bag with stitched seam lines and one pale cloth wrapping band hanging calmly from a dark metal chain, tilted very slightly, with a faint dotted pixel swing arc curving to its right, a small flat cream impact puff floating at its lower left, and beside it on the ground below a neatly coiled brown jump rope — a tidy boxing corner after a middling session; crisp pixel outlines, flat colour only. Isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no people, no text.

**`animation.0-0.9`** — raw `beat-default16-boxing-low_1791954351556_fedaf477.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, no texture noise, no glow. A heavy brown leather training bag with stitched seam lines hanging from a long dark metal chain that extends to the top edge of the image, tilted to one side, with a torn rip at its lower right corner spilling pale cream stuffing out into a small mess on the ground below — a disappointing session; crisp pixel outlines, flat colour only. Isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no people, no text.

### Default16 / swordsmanship

**`background`** — wired raw `background-default16-sword_groundfix_1791955122400_2754aeed.png`
(regen3 `background-default16-sword_regen3_…` painted + 13px shift — see the regeneration
history above; measured junction bg px 787.5)

> 16-bit SNES-era pixel-art game background in the style of a 16-bit console RPG battle backdrop: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no glow. A simple medieval training yard, empty, no people: green lawn filling the lower half of the image, a low stone wall and wooden palisade fence behind the lawn, half-timbered houses in the far background. A clear completely cloudless flat blue sky across the entire top of the image with no clouds at all. Training props only along the far left and right edges (weapon rack, shield stand). The middle band — where five training dummies will stand later — is completely bare lawn: no dummy, no figures, no target on the lawn. The top of the green lawn meets the base of the stone wall at a horizontal line exactly 55% of the image height from the top edge (between 54% and 57%); the lawn fills everything below that line to the bottom edge. No text.

**`knight.idle` + `knight.attack` (one sheet, left→right)** — raw `knight-default16-sword-idle-attack_1791954161644_3ac20a4a.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no gradients beyond dithering, no glow, no bloom. A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright green eyes, calm confident expression. Simple brown leather training gear: fitted leather tunic with small rounded shoulder pauldrons, leather bracers on forearms, dark brown trousers, sturdy laced boots. No helmet, no cape. She carries a simple wooden training sword with a dark wrapped grip. Two full-body poses of the same character standing side by side on one image, evenly spaced, identical size, feet on the same invisible ground line, and a wide clear empty gap between the two poses — each character and her sword must stay fully inside her own half of the image, nothing may cross the middle. LEFT POSE: relaxed idle, standing upright, the wooden training sword resting on her right shoulder, the blade angled up and back over her shoulder, facing three-quarters right. RIGHT POSE: slashing — torso twisted, her sword arm extended and the blade held horizontally pointing straight toward the right edge of the image, the whole sword far away from the middle of the image, a focused expression. Each pose contains only the character and her sword — no other objects, no floating fragments, no extra props. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no text.

**`knight.celebrate` + `knight.fail` (one sheet, left→right)** — raw `knight-default16-sword-celebrate-fail_1791954180872_ad13eccb.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no gradients beyond dithering, no glow, no bloom. A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright green eyes. Simple brown leather training gear: fitted leather tunic with small rounded shoulder pauldrons, leather bracers on forearms, dark brown trousers, sturdy laced boots. No helmet, no cape. She carries a simple wooden training sword with a dark wrapped grip. Two full-body poses of the same character standing side by side on one image, evenly spaced, identical size, feet on the same invisible ground line, and a wide clear empty gap between the two poses — each character and her sword must stay fully inside her own half of the image, nothing may cross the middle. LEFT POSE: celebrating — the wooden training sword thrust high in one hand, other fist clenched, big smile, slight upward hop. RIGHT POSE: dejected — the sword tip resting on the ground in front of her, head bowed, shoulders slumped, eyes closed. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`target.idle` + `target.hit` (one sheet, left→right)** — raw `target-default16-sword-dummy-idle-hit_1791954212046_35812c88.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no glow. Two versions of the same wooden practice training dummy shown side by side on one image, evenly spaced, identical size, standing on the same invisible ground line, clear empty space between them. The dummy: a blocky character-shaped practice dummy of carved wood — a simple carved head, stubby crossbar arms, a thick body post standing on a round wooden base — with dark strap bands around the neck, waist and arm ends, crisp pixel outlines, flat colour only. LEFT POSE: intact and calm, standing perfectly upright. RIGHT POSE: just struck — tilted a few degrees, with a broad pale slash groove carved across its chest, a few flat cream angular flecks and small wood chips flying around it. The round base stands flat and is the very lowest part of the drawing — fully grounded, nothing floating. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`hitEffect`** — raw `hiteffect-default16-sword_1791954263925_34867bd1.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, no texture noise, no glow. A flat crescent slash arc sweeping diagonally across the frame: the broad arc in cream and gold shading to pale yellow, with a deep red-oxide core line running along the inside of the arc, and a few flat angular shard fragments with crisp pixel outlines flying at the upper right — anime slash-impact feel. The slash sits centred in the frame with generous even margin. Isolated on a perfectly flat uniform pure white background, nothing else, no text.

**`animation.3-4`** — raw `beat-default16-sword-high_1791954360821_66d36477.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no glow. A wooden practice training dummy standing upright — blocky carved head, stubby crossbar arms, dark strap bands around the neck, waist and arm ends — with a simple wooden training sword plunged deep into its chest, the blade sticking out diagonally toward the upper right; big flat gold four-point sparkle stars float around it and a few flat angular wood chips fly outward — crisp pixel outlines, flat colour only. Isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`animation.1-2.9`** — raw `beat-default16-sword-mid_1791954369943_a559d663.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no glow. A wooden practice training dummy standing upright — blocky carved head, stubby crossbar arms, dark strap bands, round wooden base — with a simple wooden training sword leaning against its side, the blade tip resting on the ground, and a few faint pale scratch marks on its chest — a well-used practice corner after a middling session; crisp pixel outlines, flat colour only. The whole scene sits on a perfectly flat uniform pure white background — the background must be pure white #FFFFFF, not grey, with no vignette; no drop shadow under the dummy, no shadow under the sword, no ground shadow shapes, no floor line, no people, no text.

**`animation.0-0.9`** — raw `beat-default16-sword-low_1791954378901_8dbcb69c.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no glow. A wooden practice training dummy broken and fallen flat on the ground — the practice post snapped, the carved head, crossbar arms and body sections cracked apart and lying in a small pile with a few snapped wooden planks beside it — and a simple wooden training sword stuck diagonally into the ground at the right side, with a few flat scratch marks on the ground beneath it; crisp pixel outlines, flat colour only. Everything floats on a perfectly flat uniform pure white background — the background must be pure white #FFFFFF; absolutely no drop shadows under the broken pieces or the sword, no soft ground shadow shapes of any kind, no vignette, no floor line, no people, no text.

### Default16 / title and results

**`title.background`** — raw `background-default16-title_1791954503821_48a07c73.png` (wired directly)

> 16-bit SNES-era pixel-art game background in the style of a 16-bit console RPG battle backdrop: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no glow. The training yard at golden hour seen through an open wooden gate: stone gatehouse walls left and right, warm evening light on the dirt, the target row and fence visible in the distance beyond the gate, no people. The back wall meets the floor at a horizontal line exactly 55% of the image height from the top edge (between 54% and 57%); the floor begins immediately below that line and continues to the bottom edge of the image. No text.

**`logo`** — raw `logo-default16-wordmark_1791954452197_7a1c7d7f.png`

> 16-bit SNES-era pixel-art game logo in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, no texture noise, no glow. Wordmark "AI-READY KNIGHT" on two lines — flat chunky pixel lettering in a medieval woodcut feel, warm gold pixel fill with a darker gold pixel outline, flat colour only: no drop shadow behind the letters, no grey shadow, no bevel, no 3D effect, no glow, no texture. Thick clean uniform letter shapes, both words complete and correctly spelled. Isolated on a perfectly flat uniform pure white background, nothing else, no other text.

**`results.background`** — raw `background-default16-results_1791954524258_e538c4cd.png` (wired directly)

> 16-bit SNES-era pixel-art game background in the style of a 16-bit console RPG battle backdrop: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no glow. The quiet training yard after the session, evening light: stone walls, trees and a timber cabin, targets down on the ground with arrows beside them, no people. The back wall meets the floor at a horizontal line exactly 55% of the image height from the top edge (between 54% and 57%); the floor begins immediately below that line and continues to the bottom edge of the image. No text.

**`finalKnight.low_average`** — raw `finalknight-default16-low-average_1791954395737_beceeb26.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no gradients beyond dithering, no glow, no bloom. A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright green eyes. Simple brown leather training gear: fitted leather tunic with small rounded shoulder pauldrons, leather bracers on forearms, dark brown trousers, sturdy laced boots. No helmet, no cape. Full-body results portrait: still in the leather training clothes, bow in hand, determined look. Isolated on a perfectly flat uniform pure white background — the background must be pure white #FFFFFF with absolutely no grey tone, no vignette, no background gradient, no shadow under her feet, no floor line, no other objects, no text.

**`finalKnight.average`** — raw `finalknight-default16-average_1791954405380_af0f7dd5.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no gradients beyond dithering, no glow, no bloom. A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright green eyes. Full-body results portrait: plain grey metal armour over the training tunic, sword at her side, nodding, calm confident expression, no helmet, no cape. Isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**`finalKnight.high_average`** — raw `finalknight-default16-high-average_1791954443540_054a7264.png`

> 16-bit SNES-era pixel-art game sprite in flat colour: hard square pixels, crisp pixel edges, no anti-aliasing, limited 32-colour palette, simple shading as flat pixel bands with occasional 2-pixel dithering, no texture noise, no gradients beyond dithering, no glow, no bloom. A young female knight, mid-20s, short auburn hair in a practical ponytail, fair skin, bright green eyes. Full-body results portrait: flashy gold-and-silver armour, celebrating with a big smile, bow and sword crossed behind her, no helmet, no cape. Isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text.

**Status (2026-10-14):** all raws above live in `vibe_images/`; the processed outputs are
`art/default16/**` (40 files over 43 slots); the mode was seeded from a **clean state** as proof
(the `default16` mode and all 40 `default16-*` media docs were deleted, then `pnpm mode:dup
default16` + `pnpm art:wire default16` re-wired all 43 slots). `/default16` is verified end to
end by `scripts/art/verify-default16.mjs` (screenshots `docs/modes-proof/verify-m12-*.png`):
every rendered art slot resolves to a `default16-*` URL, **no** `default` or `electric` URL is
reachable in any scene (asserted against the union of both foreign sets), zero placeholders,
questions byte-identical to `default`, duplicated gold theme live, dead-QWEN fallback report
arrives. The permanent asserted ground check is `scripts/art/check-ground.mjs`.
