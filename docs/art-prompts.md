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

## Slot prompts

### Default / archery (the approved layout — the sample section)

| Slot | Prompt |
| --- | --- |
| `background` | {Style} Simple medieval barracks training yard, empty, no people: a low stone wall and wooden palisade fence behind a beaten dirt ground, a few straw bales and a wooden rack of training spears only at the far left and right edges, soft blue sky with a few flat clouds, wide 16:9 composition, plain uncluttered middle band, completely plain dirt ground in the lower quarter, no text. |
| `knight.idle` + `knight.attack` (one sheet, left→right) | {Style} Two full-body poses of the same character standing side by side on one image, evenly spaced, identical size, feet on the same invisible ground line, clear empty space between them. {Character} LEFT POSE: relaxed idle, standing upright, bow held low at her side, facing three-quarters right. RIGHT POSE: drawing the bow — left arm extended holding the bow toward the right, right hand pulling the string back to her cheek, aiming right. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text. |
| `knight.celebrate` + `knight.fail` (one sheet, left→right) | {Style} Two full-body poses of the same character standing side by side on one image, evenly spaced, identical size, feet on the same invisible ground line, clear empty space between them. {Character} LEFT POSE: celebrating — bow raised high in one hand, fist clenched, big smile, slight upward hop. RIGHT POSE: dejected — bow lowered to the ground, shoulders slumped, sighing, eyes closed. Both isolated on a perfectly flat uniform pure white background, no shadows, no floor line, no other objects, no text. |
| `target.idle` | {Style} Single round straw archery target butt on two simple wooden legs, front view, slightly angled, painted concentric rings — wide outer cream ring, middle red-oxide ring, gold-yellow bullseye — round straw body with subtle weave hints. Isolated on a perfectly flat uniform pure white background, no shadows, full object visible with margin, no text. |
| `target.hover` | Same as `target.idle` — the hover cue is the pointer glow drawn in CSS, not a separate asset. |
| `target.hit` | Same target design as `target.idle`, shown just-struck: the bullseye punched, a few straw flecks flying, the target tilted a few degrees. Same canvas and anchor as `target.idle`. |
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

The two **v2 backgrounds** (superseding the first boxing/sword backgrounds, which had props baked
into the play row where CMS sprites render) were generated with the constraints made explicit:

| Slot | Prompt |
| --- | --- |
| `boxing.background` (v2) | {Style} Simple medieval training hall interior, empty, no people: stone walls, timber ceiling beams, a low horizontal wooden rail high on the wall, wooden floor. Training props only along the far left and right edges (rolled mats, a bench). The middle band of the wall and floor — where five hanging bags are placed later — is completely bare: no bags, no props, no drawings on the wall in that band, no text. |
| `swordsmanship.background` (v2) | {Style} Simple medieval training yard, empty, no people: a wooden palisade fence and low stone wall behind a green lawn strip, half-timbered houses in the far background. Training props only along the far left and right edges (weapon rack, shield stand). The middle band — where five training dummies are placed later — is completely bare: no dummy, no figures, no target on the lawn, no text. |

### Default / title, results

| Slot | Prompt |
| --- | --- |
| `title.background` | {Style} The training yard at golden hour seen through an open wooden gate: stone gatehouse walls left and right, warm evening light on the dirt, the target row and fence visible in the distance beyond the gate, no people, no text. |
| `logo` | {Style} Wordmark "AI-READY KNIGHT" on two lines — flat medieval woodcut lettering, warm gold fill with a darker gold outline, no other decoration, isolated on a perfectly flat uniform pure white background. |
| `results.background` | {Style} The quiet training yard after the session, evening light: stone walls, trees and a timber cabin, targets down on the ground with arrows beside them, no people, no text. |
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

Processing: `scripts/art/process-electric.mjs` — the same pipeline and constants as
`process-set.mjs` (adaptive per-file white-key, fringe erosion 224, pocket clearing for the sheet,
trim). Scale discipline matches the set: the target idle/hit pair shares one fit factor
(0.6286), bottom-anchored margin 4 on the 400×400 target canvas; the effect fits centred margin 2
on the 400×400 effect canvas. Outputs in `art/electric/archery/`:

- `target.idle@2x.png` — 323×396 at (39,0)
- `target.hit@2x.png` — 324×392 at (38,4)
- `hitEffect@2x.png` — 396×383 at (2,9)

Wiring is **by hand through the admin UI** (that is the milestone): target idle in phase 1,
target hit + hit effect in phase 2 — the exact clicks are `docs/modes.md`. The `target.hover`
slot is deliberately left empty, which is why hovering an electric target shows the default golden
one (the per-slot fallback teaching example). Verified by `scripts/art/verify-electric.mjs`
(`partial` / `full`): every scene asserts the uploads render, the uncovered slots carry default
URLs, and no placeholder is ever visible.
