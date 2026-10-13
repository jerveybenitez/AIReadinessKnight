---
name: game-assets
description: Use when adding, naming, sizing, generating or wiring up AI-Ready Knight art — knight sprites and poses, weapons, archery targets, punching bags, training dummies, hit effects, backgrounds, section and ending animations, placeholders. Use when deciding spritesheet layout, canvas resolution, or what a mode should fall back to when an asset slot is empty.
---

# AI-Ready Knight — Art Assets

Every image in this game is a CMS-managed upload with a code-side placeholder fallback. No art is
imported statically into a component. That rule is what makes a new mode a content task rather than
a code task.

## Art direction

- 2D anime-style sprite art, flat Pokémon-era feel. Crisp edges, limited palette, readable at a
  glance.
- The knight is **a girl**, in leather training clothes at the start.
- Background: a simple medieval barracks training yard. Deliberately uncluttered — the targets and
  the knight must read instantly against it.
- Consistency beats detail. A simple set that matches is worth more than a detailed set that doesn't.

`game_concept/Screens/` holds **hand-drawn wireframes, not art**. Read them for layout and
interaction intent only.

## Canonical sizes

Design at a fixed logical stage of **1280×720** and scale the whole stage to fit the viewport.
Never scale individual sprites to fit — it destroys sprite alignment.

| Slot | Logical size | Notes |
| --- | --- | --- |
| Background | 1280×720 | One per section per mode. No important detail in the bottom 180px — the knight sits there. |
| Knight | ~320×420 | Anchored bottom-centre-left. Same anchor across every pose or she jitters between frames. |
| Target (each) | ~160×200 | 5 across the upper band, evenly spaced. |
| Weapon | drawn into the knight poses | Not a separate layer unless the mode swaps weapons independently. |
| Hit effect | ~160×160 | Centred on the struck target. |
| Final knight | ~480×640 | Results screen, larger than in-game. |

Export at 2× for crisp display on HiDPI; serve via Payload/`sharp`, which the scaffold already has.

## Required asset slots per mode

A mode is complete when every row here resolves to an image or an explicit fallback.

**Per section (×3):**

- `background`
- `knight.idle`, `knight.attack`, `knight.celebrate`, `knight.fail`
- `target.idle`, `target.hover`, `target.hit`
- `projectile` (arrow / — / —) and `hitEffect`
- `sectionEnd.low`, `sectionEnd.mid`, `sectionEnd.high`

**Per mode:**

- `title.background`, `logo`
- `results.background`
- `finalKnight.low_average` — still in training clothes, determined look
- `finalKnight.average` — plain metal armour, sword at side, nodding
- `finalKnight.high_average` — flashy gold and silver armour, celebrating
- UI theme: speech bubble skin, button skin, font choice, accent colour

## Naming

```
{mode}/{section}/{slot}[.{state}][@2x].{ext}
default/archery/target.hover@2x.png
default/boxing/knight.attack.png
default/results/finalKnight.high_average.png
```

Lowercase, dots for state, no spaces. The CMS stores the binding; the filename is for humans
auditing an upload set.

## Spritesheets

For multi-frame animation, prefer a horizontal strip with uniform cell width, plus a small JSON
sidecar:

```json
{ "frameWidth": 320, "frameHeight": 420, "frames": 8, "fps": 12, "loop": false }
```

Uniform cells mean the renderer needs no per-frame data and a replaced sheet needs no code change.
Keep attack animations to 6–10 frames; the whole thing plays in under a second.

## Placeholders — build these first

Ship a complete playable placeholder set **before** any real art exists, so M3–M6 aren't blocked on
an artist.

- Flat coloured rectangles/circles with a text label (`TARGET 3`, `KNIGHT idle`).
- Distinct colour per state so hover/hit transitions are visibly firing.
- Generated in code, not committed as files — a missing CMS asset renders the placeholder for that
  slot automatically.

```tsx
// every asset read goes through one resolver — never <img src={staticImport}>
assetFor(mode, section, 'target.hover') // -> CMS url, or placeholder descriptor
```

This resolver is the single point where a missing asset is handled. If a component ever branches on
`asset ? ... : ...` itself, the fallback logic has leaked.

## Generating art

If you generate sprites rather than receiving them:

- Generate a **whole set in one pass** with one consistent prompt and style anchor. Mixed-batch art
  looks wrong together no matter how good each piece is.
- Keep the knight's proportions and palette fixed across all poses; vary only the pose.
- Transparent PNG backgrounds for everything except the backgrounds themselves.
- Keep the source prompts in `docs/art-prompts.md` so the set can be regenerated or extended later.

**Ask the user before committing to generated art as final** — they may have an artist.

## Common failure modes

1. **Static imports of images in components.** Breaks mode swapping entirely. Always go through the
   resolver.
2. **Inconsistent anchor points** between knight poses — she visibly jumps on every attack. Pick one
   anchor (bottom-centre) and compose every pose against it.
3. **Busy backgrounds** that bury the targets. The brief explicitly asks for simple.
4. **Non-uniform spritesheet cells**, which force per-frame offset data and make a replacement sheet
   a code change.
5. **Forgetting the 3 ending poses.** They are the payoff of the whole game; they are not optional
   polish.
6. **Oversized uploads.** Run them through `sharp`; a 4MB background makes the first question screen
   feel broken.
