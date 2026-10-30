# Heads and faces

Heads fail at sprite scale in three ways: a flat cranium (an egg with features stuck on), eyes
laid on the surface instead of sunk under the brow, and a turned head drawn as a front head with
its features slid sideways. All three come from placing features by percentages on a flat
outline. From 32 px a head is **built as volumes and planes, then turned**: an ovoid cranium, a
wedge-shaped facial block hung under its front, simplified planes on both, eyeballs in sockets,
a hair shell and a neck. `draw` op `headArmature` does the 3D for you; this file says how to use
it and what the pixels must keep. Under 28 px a head is pixel placement: the tables and
templates below. Eyes, brows and emotion: `rules://33-eyes-and-expressions`. Bust portraits:
`rules://38-portraits`. Head size against the body: `rules://30-proportions-by-size`.

## Rules

1. **Volume before features.** Cranium, facial block, planes, then features — never a filled
   outline with features placed on it. From 28 px start with `draw` op `headArmature` on a guide
   layer; below that block one filled egg or rounded square and read rows off the table.
2. **The cranium is an ovoid seen whole.** It is wider at the back than the face, its top is
   one curve, and in 3/4 and profile the back of the skull stays visible behind the ear. A
   cranium cut off flat behind the ear is the commonest tell.
3. **The face is a wedge hung under the front of the cranium** (Bridgman, Vilppu): brow ridge
   across the top, cheekbones at the widest point, a tapered jaw down to the chin box. Its
   front/side break runs temple → cheekbone → jaw corner; that line, not the outline, says
   which way the head turns.
4. **Planes are value clusters.** One plane = one flat value = one cluster of pixels (Asaro's
   simplified head). Use the level the size affords: ≥80 px nine planes (forehead, side of
   cranium, orbit, nose, front cheek, side cheek, muzzle, chin box, underside of jaw); 40–79 px
   six plus the underside (forehead, side, orbit, nose, cheek, jaw); 28–39 px three plus the
   orbit (face, side, orbit). More planes than that turn into noise; fewer flatten the head.
5. **Eyes sit in the orbit, under the brow.** The orbit is a hollow: the brow ridge overhangs
   the upper lid and casts the darkest skin value on the face — from 64 px. Below 64 px the
   orbit is one mid-shadow row under the brow; the darkest dark belongs to the lid line and
   the pupil only, or the eye reads half-closed. Realistic and adventure eyes are
   spheres — the lids wrap them, and in a turn the far eye foreshortens against the far
   contour. Anime and chibi eyes are flat decals laid on the face plane: they turn with the
   face but keep their drawn shape.
6. **Feature lines wrap the volume.** Brow, eye, nose-base and mouth lines are contours on the
   surface, not horizontals: in a turn they curve around the facial block; seen from below
   (pitch up) they bow upward in the middle, from above they bow down. A straight eye line on a
   tilted head flattens it.
7. **Turning is a rotation, not a slide.** In a turn the axis moves toward the turn and
   curves, the far eye narrows then hides behind the nose and brow (yaw ≈ 70–80°), the near
   cheek and side plane widen, the far ear disappears, the near ear moves toward the centre of
   the side plane. Use `yaw`/`pitch`/`roll` on the armature rather than editing a front head.
8. **Hair is a shell, not a helmet.** It is the cranium grown 1–3 px, with the hairline wrapped
   over the forehead (high at the temples, lowest at the centre). It stops at the ears and
   never wraps the jaw. Draw it over the cranium, not instead of it.
9. **The neck goes under the cranium, behind the jaw** — a cylinder inserted under the skull,
   leaning forward, its front starting under the chin, its back at the nape well above the
   chin line. A neck hung from the chin is a puppet's.
10. **Character comes from the volumes.** Jaw width, face length, brow ridge, cheekbones, chin
    and age are the `sliders`: square jaw = jaw held near cranium width; long face = lower
    chin; strong brow = deeper orbit; young = big cranium, eyes low, small face; old = eyes a
    notch higher, heavier nose and ears (`rules://36-character-design`).
11. **Rhythms for tension (Reilly).** The armature returns 3–4 rhythm curves (brow → nose,
    cheekbone → chin, cranium → nape, jaw → neck). Use them when the contour goes soft or
    statue-stiff: push the outline along them by 1 px. They are never drawn.
12. **Proportions are an outcome, not a recipe.** On a front adventure head the eye line falls
    at 50–56% of hair top to chin, brow 38–42%, nose base 63–74%, mouth 77–83%, cute heads
    56–65%. Check these on a front view; on turned or tilted heads trust the armature.
13. **Features never touch.** ≥1 px skin between mouth and nose/chin, brow and eye, eye and
    contour; ≥2 px between the eyes. Odd width has a centre column (1-px nose, 1- or 3-px
    mouth); even width has none.
14. **Nose.** None at ≤16 px. 24 px: 1 px one skin step darker. ≥32 px: it is a wedge — the
    lit flank, the shadow flank and the base plane, never an outline-dark mark. In profile it
    is the silhouette bump.
15. **A profile needs a profile:** forehead out, eye in, nose out, lips, chin — ≥3 bumps on the
    front contour; the eye is a wedge 1–3 px behind it; the back of the cranium extends well
    behind the ear (Bancroft).
16. **Skin: values from planes, hue from temperature.** Plane values come from the light; hue
    shift the shadows 10–22° toward red and cooler, 15–25% darker
    (`rules://20-color-for-pixel-art`). Eyes the highest contrast on the head. A mirrored head
    flips its light: re-shade.
17. **When pixels run out cut:** ears → nose → brow → mouth → jaw planes → hair silhouette. Eyes
    and the cranium shape are never cut.

## Construction with `headArmature`

- `rect` is the head box, hair shell included, neck excluded; its height chooses the plane
  level. Under 28 px the op refuses with `too_small` and points here.
- `archetype`: `realistic` (narrow cranium, long face, small eyes), `adventure` (game default,
  slightly bigger cranium and eyes), `anime` (big cranium, short face, decal eyes), `chibi`
  (cranium ≈ 2/3 of the head, decal eyes). Then `sliders`, each −1…1.
- `yaw` positive turns the face toward the viewer's right; `pitch` positive raises it (seen
  from below); `roll` positive tilts clockwise. A portrait three-quarter is yaw ±20–25°: the nose sits about a quarter of the head width
  from the far contour and a sliver of far cheek shows beyond it. ±35° and more is a strong
  turn, the nose against the far contour — choose it on purpose, not as the default 3/4.
- Output: the guide (silhouette, curved axis, wrapped feature lines, plane borders, eyeballs
  and lids, ears, hair shell, hairline, neck) on `guideLayer`, and with `planes` the lit
  block-in on its own layer, in one undo step. The JSON returns every landmark in canvas
  pixels: `landmarks` (brow, eyeLine, noseBase, mouth, chin, hairline), `eyes` (centre,
  footprint, lids, brow overhang, visible, near), `planes` (type, side, value, colour, area,
  bounds), `ears`, `hairShell`, `neck`, `rhythm`.
- Guide colours default to the two palette entries furthest from the skin ramp; pass
  `guideColor`/`featureColor` when the palette has none.
- The guide is a construction, not line art: paint over it on its own layer, then hide or
  delete it.

## By size

Under 28 px (and as feature-size references up to 32 px). Rows count from 0 at the top (outline row); x from 0 at the template's left edge. Front:

| | 8 px | 12 px | 16 px | 24 px | 32 px |
|---|---|---|---|---|---|
| Head W×H | 8×8 | 11×12 | 14×16 | 21×24 (+ears: 23) | 27×32 (+ears: 31) |
| Hair rows | 1–2 | 1–4 | 1–5 | 1–7 | 1–10 |
| Brow | — | — | row 6 | row 9, 3 px | row 13, 5 px |
| Eyes | 1×1, row 4, x 2, 5 | 1×2, rows 5–6, x 3, 7 | 2×2, rows 8–9, x 3–4, 9–10 | 3×3, rows 11–13, x 6–8, 14–16 | 5×4, rows 15–18, x 7–11, 19–23 |
| Nose | — | 1 px, row 8 | — | 1 px, row 15 | bridge + 3 px, rows 19–21 |
| Mouth | 2 px, row 6 | 3 px, row 9 | 2 px, row 12 | 3 px, row 18 | 7 px, row 25, lip row 26 |
| Chin row | 7 | 11 | 15 | 23 | 31 |

3/4 and side, both facing right:

| | 12 px | 16 px | 24 px | 32 px |
|---|---|---|---|---|
| 3/4 eyes near / far | 1×2 / 1×2, front x | 2×2 x 4–5 / 1×2 x 10 | 3×3 x 7–9 / 2×3 x 15–16 | 5×4 x 9–13 / 3×4 x 21–23 |
| 3/4 nose bump, mouth | +1 row 7; x 6–7 row 8 | +1 row 10; x 8–9 row 12 | +2 row 15; x 11–14 row 18 | +2–3 rows 19–22; x 14–21 row 25 |
| 3/4 near ear | 1 px x 1 | 2×2 x 1–2 | 2×2 x 0–1 | 3×4 x 0–2 |
| Side eye | 1×2 x 7 | wedge x 10–11 | 3×4 x 16–18 | 4×3 x 24–27, rows 15–17 |
| Side nose tip, mouth | +1 row 7; x 7–8 row 8 | +1 row 10; x 11–12 row 12 | +2 rows 14–16; x 17–20 row 18 | nose +3 rows 19–22; mouth x 27–30 rows 24–25 |
| Side ear | 2×2 x 4–5 | 2×3 x 5–6 | 4×5 x 8–11 | 5×6 x 13–17, rows 14–19 |

From 28 px build with `headArmature` instead; the 32 px columns stay as finished-feature sizes
(eye, mouth, nose) to paint into the armature's footprints. Below 8 px there is no face: two
dark pixels or one shadow row.

## Templates

### Armature block-ins (32 and 48 px)

Generated by `headArmature` (`scripts/armature-templates.ts`, checked by `tests/rules.test.ts`):
plane values only, no hair or neck, ramp darkest `1` to lightest `5`. Map the ramp onto your
own skin ramp; they show what each turn must look like before any feature.

32 px, `adventure`, front (level 3: face, side, orbit). Light upper-left; `E` marks the eyeball under the brow.

```grid armature-32-front
2 = skin-shadow #7a4040
3 = skin #b8705a
4 = skin-light #e0a07a
5 = skin-highlight #f6d2b0
E = eye-socket #2b1d2e
---
.........444444.........
.......4444444444.......
.....44444444444444.....
....4444455555544444....
...444455555555552222...
...444555555555555222...
..44455555555555555222..
..44455555555555555222..
.4445555555555555555222.
.4455555555555555555522.
.4455555555555555555522.
.4455555555555555555522.
444555555555555555555222
444555555555555555555222
.4455555555555555555522.
.44554EEEE5555EEEE35522.
44444EEEEE5555EEEEE22233
4444EEEEEEE53EEEEEEE2233
.44444EEEE5533EEEE22223.
.4444455555533333322223.
..44445555553333332222..
...444555555333333222...
...444555555333333222...
...444555555555333222...
...444555555555333222...
...444555555555333222...
....4455555555533322....
.....45555555553332.....
.....45555555553332.....
......555555553333......
........55555533........
..........5555..........
```

32 px, `adventure`, yaw −25° (turned toward the light). The far eye is narrower, a sliver of far cheek beyond it; the near cheek and side plane carry the turn.

```grid armature-32-tq
2 = skin-shadow #7a4040
3 = skin #b8705a
4 = skin-light #e0a07a
5 = skin-highlight #f6d2b0
E = eye-socket #2b1d2e
---
.........444444.........
.......4444444444.......
.....44444444444444.....
....4455555444444444....
...555555555533334444...
..5555555555553333333...
..55555555555553333333..
.5555555555555533333333.
.5555555555555553333333.
.5555555555555555333333.
55555555555555555333333.
555555555555555553333333
555555555555555553333333
555555555555555553333333
555555555555555553333333
3EEE55555EEE335553333333
EEEEE5555EEEEE3333333322
.EEEEE444EEEEE3333333322
.EEEE4444EEE333333333322
.4444444444443333333322.
..444444444443333333322.
..44444444444333333332..
...444444444443333333...
...455555444443333333...
...45555544444333333....
...45555554444333333....
....4555554444333333....
....45555544443333......
....455554444433........
.....5555444444.........
.....55554444...........
......5555..............
```

48 px, `adventure`, front (level 6: forehead, side, orbit, nose, cheek, jaw + underside). Ears sit between brow and nose base.

```grid armature-48-front
2 = skin-shadow #7a4040
3 = skin #b8705a
4 = skin-light #e0a07a
5 = skin-highlight #f6d2b0
E = eye-socket #2b1d2e
---
..............44444444..............
...........44444444444444...........
..........4444444444444444..........
........44444444444444444444........
.......4444444444444444444444.......
......444444445555555544444444......
.....44555555555555555555222244.....
....5555555555555555555555222222....
....5555555555555555555555552222....
...555555555555555555555555522222...
...555555555555555555555555552222...
..55555555555555555555555555522222..
..55555555555555555555555555555222..
..55555555555555555555555555555222..
.5555555555555555555555555555552222.
.5555555555555555555555555555552222.
.5555555555555555555555555555552222.
.5555555555555555555555555555552222.
.5555555555555555555555555555552222.
.5555555555555555555555555555555222.
.5555555555555555555555555555555222.
.5555555555555555555555555555552222.
.5555555555555555555555555555552222.
555555443EEEEE55555555EEEEE222222444
55544444EEEEEEE555555EEEEEEE22222444
.554444EEEEEEEE555555EEEEEEEE222244.
.554444EEEEEEEEE5533EEEEEEEEE222244.
.55444445EEEEE55553333EEEEE22222244.
.5544444455555555533333333322222244.
..54444445555555553333333332222224..
...444444555555555333333333222222...
....4444455555555533333333322222....
....4444455555555533333333322222....
....4444455555555533333333322222....
....4444455555555533333333322222....
....4444455555555533333333322222....
....4444455555555533333333322222....
.....44445555555553333333332222.....
.....44445555555553333333332222.....
.....44445555555553333333332222.....
......444555554445322233333222......
.......4455555444422223333322.......
........44555544442222333322........
.........455554444222233332.........
..........5555444422223333..........
...........55544442222333...........
.............4444422222.............
...............444222...............
```

48 px, `adventure`, yaw −25°. The nose wedge sits inside the far contour; the front/side break runs down the near temple, cheekbone and jaw corner.

```grid armature-48-tq
2 = skin-shadow #7a4040
3 = skin #b8705a
4 = skin-light #e0a07a
5 = skin-highlight #f6d2b0
E = eye-socket #2b1d2e
---
..............33333333..............
...........33333333333333...........
.........33333333333333333..........
........33333333333333333333........
.......3333333333333333333333.......
......333555555533333333333333......
.....33555555555555222222233333.....
....5555555555555555522222222222....
...55555555555555555552222222222....
...555555555555555555522222222222...
..5555555555555555555552222222222...
..55555555555555555555522222222222..
..55555555555555555555555222222222..
.5555555555555555555555552222222222.
.5555555555555555555555552222222222.
.5555555555555555555555552222222222.
.5555555555555555555555552222222222.
35555555555555555555555552222222222.
35555555555555555555555552222222222.
355555555555555555555555522222222222
355555555555555555555555522222222222
35555555555555555555555552222222222.
35555555555555225555555552222222222.
.3EEEEE5555555EEEE222222222222222222
3EEEEEEE55555EEEEEEE2222222222222222
.EEEEEEE54455EEEEEEEE222222222222222
.EEEEEEE44444EEEEEEEE222222222222222
.3EEEEE4444444EEEE222222222222222222
.33444444444444444442222222222222222
..344444444444444444222222222222222.
..34444444444444444422222222222222..
...444444444444444442222222222222...
...44444444444444444222222222222....
....4444444444444444222222222222....
....444444444444444422222222222.....
....444444444444444442222222222.....
.....44444444444444442222222222.....
.....44444444444444442222222222.....
.....44444444444444442222222222.....
.....4444444444444444222222222......
......4334422244444442222222........
......433322224444444422222.........
......4333222244444444222...........
.......3332222444444442.............
.......333222244444444..............
.......3333222444444................
........333222222...................
.........332222.....................
```

48 px, `realistic`, yaw −25°, pitch 20° (seen from below). The feature lines bow upward and the underside of the jaw shows as its own dark plane.

```grid armature-48-tq-up
1 = skin-deep #3b2027
3 = skin #b8705a
4 = skin-light #e0a07a
5 = skin-highlight #f6d2b0
E = eye-socket #2b1d2e
---
...............33333333...............
............55555553333333............
..........555555555533333333..........
.........55555555555553333333.........
.......55555555555555555333333........
......55555555555555555553333333......
.....555555555555555555555333333......
.....5555555555555555555553333333.....
....555555555555555555555533333333....
...55555555555555555555555333333333...
...55555555555555555555555533333333...
...555555555555555555555555333333333..
..5555555555555555555555555553333333..
..55555555555555555555555555533333333.
..55555555555555555555555555533333333.
.555555555555555555555555555533333333.
.555555555555555333333555555533333333.
.5555555555555533EEE334445555333333333
.554445555555553EEEEEE4444443333333333
.544EEE55555553EEEEEEEE444444433333333
.4EEEEEE4444443EEEEEEE4444444443333333
.EEEEEEEE444444EEEE3334444444444333333
4EEEEEEEE44444444333444444444444433333
4EEEEEE5544444444444444444444444443333
44444455544444444444444444444444444333
44555555444444444444444444444444444333
44555555444444444444444444444444444333
44455555444444444444444444444444444333
44455555444444444444444444444444444333
.4455555444444444444444444444444444333
.445555544444444444444444444444444433.
.44555555544444444444444444444444443..
..445555554444444444444444444444444...
..445555554444444444444444444444444...
..445555554444444444444444444444444...
...45555554444444444444444444444444...
...4555555444444444444444444444444....
....555555444444444444444444444444....
....555444444444444444444444444444....
....555444444444444444444444444444....
.....55444444444444444444444444444....
.....5554444444444444444444444444.....
.....55544444444444444444444444.......
......554444444444444444444111........
......5544444444444444441111..........
......554444444444444111111...........
......54444444444411111...............
........444441111111..................
```

### Finished heads (8–32 px)

Lit from the upper left; hair is a short cap so hairline and brow rows stay visible — swap
the hair, keep the rows. Each strip holds self-contained heads side by side.

Front 8 / 12 / 16 px (left edges x = 0, 9, 21). 8 px: dots only; 12 px: odd width, centre nose; 16 px: catch-lit 2×2 eyes, blush.

```grid heads-front-small
O = outline #2b1d2e
S = skin #e8a77c
L = skin-light #f7d2ac
D = skin-shadow #b9695a
h = hair-light #9a6238
H = hair-mid #6b3f2a
E = eye-dark #2b1d2e
W = eye-white #dfe2ea
M = lip #a14a52
N = nose-shade #c47a5a
R = blush #d9826f
---
..OOOO......OOOOO........OOOOOO....
.OHHHHO...OOHHHHHOO....OOHHHHHHOO..
OHhHHHHO.OHHhhHHHHHO..OHHhhHHHHHHO.
OLLSSSDO.OHHHHHHHHHO.OHHhhHHHHHHHHO
OSESSEDO.OHHHDDDHHHO.OHHHHHHHHHHHHO
OSSSSSDO.OSSESSSESSO.OHHDDDDDDDDHHO
.OSMMDO..OSSESSSESDO.OHSLLLSSSSSDHO
..OOOO...OSLSSSSSSDO.OSSLSSSSSSSDDO
..........OSSSNSSSO..OSSWESSSSWEDDO
..........OSSMMMSSO..OSSEESSSSEEDDO
...........OSDDDDO....OSSSSSSSSSDO.
............OOOOO.....OSRSSSSSSRDO.
.......................OSSSMMSSSO..
.......................OSSSSSSSSO..
........................OSDDDDSO...
.........................OOOOOO....
```

Front 24 / 32 px (x = 0, 24). 24 px: brows, 3×3 eyes, 1-px nose; 32 px: full features, ears, bridge shade.

```grid heads-front-large
O = outline #2b1d2e
S = skin #e8a77c
L = skin-light #f7d2ac
D = skin-shadow #b9695a
k = hair-dark #3d2318
h = hair-light #9a6238
H = hair-mid #6b3f2a
E = eye-dark #2b1d2e
W = eye-white #dfe2ea
I = iris #4f86b8
M = lip #a14a52
N = nose-shade #c47a5a
w = highlight #ffffff
e = ear-shade #c47a5a
R = blush #d9826f
---
.......OOOOOOOOO..................OOOOOOOOOOO..........
.....OOHHHHHHHHHOO..............OOHHHHHHHHHHHOO........
...OOHHHhhhhHHHHHHOO..........OOHHHhhhhhhhHHHHHOO......
..OHHHhhhHHHHHHHHHHHO........OHHhhhHhhhHHHHHHHHHHO.....
.OHHHhhHHHHHHHHHHHHHHO......OHHhhhhHHHHHHHHHHHHHHHO....
.OHHhHHHHHHHHHHHHHHHHO.....OHHhhHHHHHHHHHHHHHHHHHHHO...
.OHHHHHHHHHHHHHHHHHHHO.....OHhhHHHHHHHHHHHHHHHHHHHHO...
.OHHHHHHHDDDDDDDDHHHHO....OHHhHHHHHHHHHHHHHHHHHHHHHHO..
.OHSSSSSSSSSSSSSSSSSHO....OHHHHHHHHHHHHHHHHHHHHHHHHHO..
.OHSSSkkkSSSSSkkkSSSHO....OHHHHHHHHHHHHHHHHHHHHHHHHHO..
.OHSSSSSSSSSSSSSSSSSHO....OHHHHHHHDDDDDDDDDDDHHHHHHHO..
.OSSSSOOOSSSSSOOOSSSDO....OHHHHSSSLLSSSSSSSSSSSSHHHHO..
OeSSSSwEESSSSSwEESSDDeO...OHSSSSSSLLLSSSSSSSSSSSSSSHO..
OeSSLLWEESSSSSWEESSDDeO...OHSSSkkkkkSSSSSSSkkkkkSSSHO..
.OOSLLSSSSSSSSSSSSSDOO....OHSSSSSSSSSSSSSSSSSSSSSSSHO..
..OSSSSSSSSNSSSSSSSDO....OOHSSSOOOOOSSSSSSSOOOOOSSSHOO.
...OSRRSSSSSSSSSRRSO....OeSSSSSWwEIWSSSSSSSWwEIWSSDDSeO
...OSSSSSDSSSDSSSSSO....OeSSSSSWIEIWSSSSSSSWIEIWSSDDSeO
....OSSSSSMMMSSSSSO.....OeSSSSSSWWWSSSSSSSSSWWWSSSDDSeO
....OSSSSSSSSSSSSSO.....OeSSSSSSSSSSSSSSNSSSSSSSSSDDSeO
.....OSSSSSSSSSSSO.......O.OSSSSLLSSSSSSNSSSSSSSSSDO.O.
......OSSDDDDDSSO..........OSSSLLSSSSSNNNSSSSSSSSDDO...
.......OSSSSSSSO............OSSSRRRSSSSSSSSSRRRSSDO....
........OOOOOOO.............OSSSSSSSSSSSSSSSSSSSSDO....
.............................OSSSSSDSSSSSSSDSSSSSO.....
.............................OSSSSSSMMMMMMMSSSSSSO.....
..............................OSSSSSSRRRRRSSSSSSO......
...............................OSSSSSSSSSSSSSSSO.......
................................OSSSSSSSSSSSSSO........
.................................OSSDDDDDDDSSO.........
..................................OSSSSSSSSSO..........
...................................OOOOOOOOO...........
```

3/4 right 12 / 16 px (x = 0, 12). 12 px: only nose, mouth and ear move; 16 px: near eye 2 px, far eye 1 px.

```grid heads-tq-small
O = outline #2b1d2e
S = skin #e8a77c
L = skin-light #f7d2ac
D = skin-shadow #b9695a
h = hair-light #9a6238
H = hair-mid #6b3f2a
E = eye-dark #2b1d2e
W = eye-white #dfe2ea
M = lip #a14a52
N = nose-shade #c47a5a
e = ear-shade #c47a5a
R = blush #d9826f
---
...OOOOOO.......OOOOOO....
.OOHHHHHHO....OOHHHHHHOO..
OHHhhHHHHHO..OHHhhHHHHHHO.
OHHHHHHHHHO.OHHhhhHHHHHHHO
OHHHDDDHHHO.OHHHHHHHHHHHHO
OHSESSSESO..OHHHHHDDDDDHHO
OHSESSSESO..OHHSSSSSSSSHSO
OeLSSSSSNDO.OHSSSSSSSSSDO.
.OSSSSMMSO..OeeSWESSSSEDO.
.OSSDDDSSO..OeeSEESSSSEDO.
..OOSSSOO....OSSSSSSSSSDNO
....OOO......OSRSSSSSSSDO.
..............OSSSSSMMSO..
...............OSSSSSSSO..
................OSDDDDO...
.................OOOOO....
```

3/4 right 24 / 32 px (x = 0, 25). Far eye narrower, nose breaks the far contour, chin shifted toward the turn.

```grid heads-tq-large
O = outline #2b1d2e
S = skin #e8a77c
L = skin-light #f7d2ac
D = skin-shadow #b9695a
k = hair-dark #3d2318
h = hair-light #9a6238
H = hair-mid #6b3f2a
E = eye-dark #2b1d2e
W = eye-white #dfe2ea
I = iris #4f86b8
M = lip #a14a52
N = nose-shade #c47a5a
w = highlight #ffffff
e = ear-shade #c47a5a
R = blush #d9826f
---
.......OOOOOOOOO...................OOOOOOOOOOO...........
.....OOHHHHHHHHHOO...............OOHHHHHHHHHHHOO.........
...OOHHHhhhhHHHHHHOO...........OOHHHhhhhhHHHHHHHOO.......
..OHHHhhhHHHHHHHHHHHO.........OHHhhhhHHHHHHHHHHHHHO......
.OHHHhhHHHHHHHHHHHHHHO.......OHHhhhHHHHHHHHHHHHHHHHO.....
.OHHhHHHHHHHHHHHHHHHHO......OHHhhHHHHHHHHHHHHHHHHHHHO....
.OHHHHHHHHHHHHHHHHHHHO......OHhhHHHHHHHHHHHHHHHHHHHHO....
.OHHHHHHHDDDDDDDDDHHO......OHHhHHHHHHHHHHHHHHHHHHHHHHO...
.OHSSSSSSSSSSSSSSSSHO......OHHHHHHHHHHHHHHHHHHHHHHHHOO...
.OHSSSSkkkSSSSSkkkSHO......OHHHHHHHHHHHHHHHHHHHHHHHO.....
.OHSSSSSSSSSSSSSSSSDO......OHHHHHHHHHDDDDDDDDDDDDHHO.....
.OSSSSSOOOSSSSSOOSSDO......OHHHHHSSSSSSSSSSSSSSSSSSO.....
OeSSSSSwEESSSSSEESSDO......OHSSSSSSSLLLSSSSSSSSSSSSO.....
OeSSLLSWEESSSSSEESDDO......OHSSSSSkkkkkSSSSSSSkkkkSO.....
.OOSLSSSSSSSSSSSSSDDO......OHSSSSSSSSSSSSSSSSSSSSSDO.....
..OSSSSSSSSSSNSSSSDOOO....OOSSSSSSOOOOOSSSSSSSOOOSDO.....
...OSRRSSSSSSSSRRSO......OeSSSSSSSWwEIWSSSSSSSWIESDO.....
....OSSSSSDSSSSDSSDO.....OeSSSSSSSWIEIWSSSSSSSWIESDO.....
.....OSSSSSMMMMSSSO......OeSSSSSSSSWWWSSSSSSSSSWSDDO.....
.....OSSSSSSSSSSSSO......OeSSSSSSLLSSSSSSSSNSSSSSDDO.....
......OSSSSSSSSSSO........O.OSSSLLSSSSSSSSSNSSSSSDDO.....
.......OSSDDDDDSO...........OSSSSSSSSSSSSSNNSSSSSDDSO....
........OSSSSSSO.............OSSSSRRRSSSSSSSSSSRRRDO.....
.........OOOOOO..............OSSSSSSSSSSSSSSSSSSSOO......
..............................OSSSSSSSDSSSSSSSSDO........
..............................OOOSSSSSSMMMMMMMMSO........
.................................OSSSSSSRRRRRRSSSO.......
..................................OSSSSSSSSSSSSSO........
...................................OSSSSSSSSSSSO.........
....................................OSSDDDDDDDO..........
.....................................OSSSSSSSO...........
......................................OOOOOOO............
```

Profile right 12 / 16 px (x = 0, 12). One wedge eye, 1-px nose bump, ear behind the midline.

```grid heads-side-small
O = outline #2b1d2e
S = skin #e8a77c
D = skin-shadow #b9695a
h = hair-light #9a6238
H = hair-mid #6b3f2a
E = eye-dark #2b1d2e
W = eye-white #dfe2ea
M = lip #a14a52
N = nose-shade #c47a5a
e = ear-shade #c47a5a
R = blush #d9826f
---
...OOOOO........OOOOOO.....
.OOHHHHHOO....OOHHHHHHOO...
OHHhhHHHHO...OHHhhhHHHHHO..
OHhHHHHHHO..OHHhhHHHHHHHHO.
OHHHHHHHHO..OHhHHHHHHHHHHO.
OHHHDDDESO..OHHHHHHHHHHHHO.
OHHHeeSESO..OHHHHDDDDDHHHO.
OSSSeSSSNSO.OHHHHSSSSSSSSO.
.OSSSSSMMO..OHHHHeeSSSWESO.
..OSSSSSO...OSSSSeOSSSEESO.
...OSSSOO....OSSSeeSSRSSNSO
....OOO......OSSSSSSSSSSSO.
..............OSSSSSSSSMMO.
...............OSSSDDDSSO..
................OOSSSSSOO..
..................OOOOO....
```

Profile right 24 / 32 px (x = 0, 25). Hair swept back off the forehead, 2–3 px nose, lips and chin on the contour.

```grid heads-side-large
O = outline #2b1d2e
S = skin #e8a77c
L = skin-light #f7d2ac
D = skin-shadow #b9695a
k = hair-dark #3d2318
h = hair-light #9a6238
H = hair-mid #6b3f2a
E = eye-dark #2b1d2e
W = eye-white #dfe2ea
I = iris #4f86b8
M = lip #a14a52
N = nose-shade #c47a5a
w = highlight #ffffff
e = ear-shade #c47a5a
R = blush #d9826f
---
.......OOOOOOOO......................OOOOOOO................
....OOOHHHHHHHHOOO...............OOOOHHHHHHHOOOO............
...OHHhhhhHHHHHHHHOO...........OOHHHHhhhhhhHHHHHOOO.........
..OHhhhHHHHHHHHHHHHHO........OOHHhhhhhhhhhhHHHHHHHHOO.......
.OHhhHHHHHHHHHHHHHHHHO......OHHHhhhhhhhhHHHHHHHHHHHHHO......
OHhhHHHHHHHHHHHHHHHHHO......OHHhhhhhhHHHHHHHHHHHHHHHHO......
OHHHHHHHHHHHHHHHHHHHHO.....OHhhhhhhHHHHHHHHHHHHHHHHHHHO.....
OHHHHHHHHHHHHHHHHHHHHO.....OHHhhhhHHHHHHHHHHHHHHHHHHHHHO....
OHHHHHHHHHHHHHHHHHHHHO.....OHHHhhHHHHHHHHHHHHHHHHHHHHHHO....
OHHHHHHDDDDDDDDDDDHHHO....OHHHHHHHHHHHHHHHHHHHHHHHHHHHHO....
OHHHHHHSSSSSHSSSSSSSSO....OHHHHHHHHHHHHHHHHHHHSSSSSSSSSSO...
OHHHHHHSSeeSHSSSkkkkSO....OHHHHHHHHHHHHHHHHSSSSSSSSSSSSSO...
OHHHHHHSeeeeSSSSOOOSSO....OHHHHHHHHHHHHHHSSSSSSSSSSSSSSSO...
OHHHHHHSeOOeSSSSWwESSO.....OHHHHHHHHHHHHSSSSSSSkkkkkkkSSO...
.OSSSSSSeeOeSSSSWIESSSO....OkHHHHHHHHHHSSSSSSSSSSSSSSSSSO...
.OSSSSSSSeeSSSSSSWRRSSSO...OkkHHHHHHHHSSSSSSSSSSSwWEESSO....
.OSSSSSSSSSSSSSSSSSSSNO.....OkkHHHHHSSSeeSSSSSSSSWIEESSOO...
..OSSSSSSSSSDDSSSSSSSN......OSkkHHHHSSSeeSSSSSSSSSWWSSSSSO..
..OSSSSSSSSSSSSSSMMMMO.......OSkkHHSSSSeeSSSSSSSLLLSSSSSSO..
...OSSSSSSSSSSSSSSSSSO........OSSkSSSSSSSSSSSSSSLLLLLSSNSSO.
....OSSSSSSSSSSSSSSSO..........OSSSSSSSSSSSSSSSRRRLLSSSSSLSO
.....OOSSSSSSDDDDDOO............OSSSSSSSSSDDSSSSSSSSSSSSNSO.
.......OOSSSSSSOOO...............OSSSSSSSSDDSSSSSSSSSSSNSO..
.........OOOOOO...................OSSSSSSSSSSSSSSSSSSSSSSO..
..................................OSSSDSSSSSSSSSSSSSMMMMO...
...................................OSDDDDSSSSSSSSSSSMMMSO...
....................................OSSDDDSSSSSSSSSSSSSSO...
.....................................OOSDDDDDSSSSSSSSDDSO...
.......................................OSSDDDDDDDDDDSSSSO...
........................................OOSSSSSDDDDDDSSSO...
..........................................OOOOSSSSSSSOOO....
..............................................OOOOOOO.......
```

## Procedure

1. `sprite_info`; fix H from the heads-tall plan (`rules://30-proportions-by-size`) and the
   facing. Under 28 px skip to step 8.
2. `palette` op `ramp` for skin (4–5 steps for 48 px and up, 3 at 32 px).
3. `draw` op `headArmature` with `rect`, `archetype`, `yaw`/`pitch`/`roll`, `sliders` and
   `planes: { ramp, light }`. Read the returned landmarks; `look` op `preview` at 1×: the block-in
   alone must read as a turned head (`rules://03-silhouette-and-form`). Wrong turn or shape:
   undo and change the parameters — never fix a cranium by pushing pixels.
4. On a new "head" layer over the block-in, merge planes that read as noise and smooth the
   outline along the rhythm curves; keep the front/side break, the orbit shadow and the
   underside of the jaw.
5. Eyes into the returned `eyes` footprints (lids from `upperLid`/`lowerLid`, brow over
   `browOverhang`; far eye only if `visible`), then mouth on the `mouth` line, nose on its
   planes, ears from `ears` (`rules://33-eyes-and-expressions`). `look` op `ascii` with a
   `region` to check gaps and parity.
6. Hair on its own layer: `hairShell` is its inner limit, never its outline — the
   silhouette breaks it with locks, a part and volume on top; hairline on `landmarks.hairline`
   (`rules://35-hair-and-clothing`); neck on `neck`.
7. Shade with hue shifts, outline the silhouette only (`rules://04-outlines-and-edges`), hide
   the guide; `look` op `preview`, then `validate`.
8. Under 28 px: block one filled egg or the nearest template (`draw` op `grid`), features from
   the table, turns from the 3/4 and side templates; for the opposite facing `transform` op
   `flip` a copy and re-shade (`rules://37-views-and-directions`).

## Mistakes

| Symptom | Cause | Fix |
|---|---|---|
| Head reads as an egg with a face printed on | Features placed on a flat outline | Rebuild from `headArmature`; planes before features |
| Flat back of the head in 3/4 or profile | Cranium cut behind the ear | The ovoid stays whole; back of skull past the ear |
| Eyes look pasted on | No orbit, brow not overhanging | Orbit shadow under the brow; lids wrap the eye |
| 3/4 head = front head plus a nose | Features slid, eyes equal | Turn the armature (`yaw`); far eye narrows |
| Tilted head looks like a level one | Straight feature lines | Bow the lines (pitch); show the jaw underside |
| Helmet hair | Hair drawn instead of the cranium | Shell 1–3 px off the cranium, hairline wrapped |
| Puppet neck | Neck hung from the chin | Cylinder under the skull, nape above the chin |
| Noisy face | More planes than the size affords | Use the level for the height; merge planes |
| Soft, statue-like contour | No rhythm | Push the outline 1 px along the rhythm curves |
| Old, alien, "all forehead" (front) | Eye line above 50% | Lower the eyes or use `age` < 0 |
| Wrong light after a flip | Mirrored copy kept its shading | Re-shade |

## Review

- ≥ 28 px: the head was built from `headArmature` (a guide or plane layer exists, or the
  block-in matches one); the block-in alone reads as a turned head at 1×.
- The cranium is one ovoid; in 3/4 and profile the back of the skull shows behind the ear.
- A visible front/side break; the orbit is the darkest skin value; brow overhangs the lids.
- Feature lines curve with the turn and the pitch; far eye narrower in a turn.
- Hair sits 1–3 px off the cranium and breaks the shell's outline (no swim cap); neck under
  the skull, not the chin.
- Plane count fits the size; one light direction; eyes the highest contrast on the head.
- Front view landmarks inside the ranges in rule 12; ≥2 px between eyes; parity respected.
- One deliberate asymmetry on an otherwise symmetric face.

## Sources

- Bridgman, *Constructive Anatomy* — the head as cranium and wedge, planes of the face.
- Vilppu, *The Vilppu Drawing Manual* — head construction from the ball and the facial
  wedge, rotation.
- Asaro, "Planes of the Head" (simplified planar head) — plane sets used at each level.
- Frank Reilly, as taught in Jack Faragasso, *Mastering Drawing the Human Figure* — head
  rhythms (used as an outline pass only).
- Hampton, *Figure Drawing: Design and Invention* — head as volumes, pp. 57–82.
- Bancroft, *Creating Characters with Personality* — view line-up pp. 55–57, 3/4 p. 135.
- Blair, *Advanced Animation* — Construction of the Head; the cute head, p. 15.
- Solarski, *Drawing Basics and Video Game Art* — Massing the Head.
- Dawe, *Make Your Own Pixel Art* pp. 118–123; Silber, *Pixel Art for Game Developers* pp. 31–34.
- *Pixel Logic* — spacing p. 106, hair p. 108, faces pp. 168–169, no sub-pixel faces p. 205.
- Saint11 "Portrait"/"Cuteness"; Slynyrd Pixelblog 17 and 29; st0ven fighter faces (2006);
  Tsu tutorials 7–9; art-pia small-canvas guide; Derek Yu's pixel art tutorial.
- Small-head landmark rows were first derived by fitting the Loomis/Hampton/Slynyrd divisions
  to the grid; they are kept for heads under 28 px, where there is no volume to build.
