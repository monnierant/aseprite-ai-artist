# Face bench

Six fixed heads that judge whether the agent builds a face from volumes
([ADR-0013](../adr/0013-volumetric-head-construction.md)). Each brief is drawn
twice — 48 px and 96 px head height — before and after a change to the head
rules or to `draw` op `headArmature`, and the results are laid side by side.
The verdict is a person looking at the sheet, not the `validate` score.

| # | Archetype | View | `headArmature` | Brief |
|---|---|---|---|---|
| 1 | `realistic` | 3/4 | `yaw: -35` | A grey-haired ship captain, square jaw, heavy brow, short beard line, lit from the upper left. |
| 2 | `realistic` | 3/4, seen from below | `yaw: -30, pitch: 20` | The same captain looking up at a mast: the jaw underside shows, the feature lines bow upward. |
| 3 | `adventure` | 3/4 | `yaw: -35` | Remake of MON-574: a young adventurer with a ponytail and a scar over the left brow, bust portrait. |
| 4 | `adventure` | front | `yaw: 0` | The same adventurer, front, neutral expression, for a dialogue box. |
| 5 | `anime` | 3/4 | `yaw: -30` | A cheerful mage girl with long bangs and large decal eyes, slight smile. |
| 6 | `anime` | front | `yaw: 0` | The same mage, front, surprised (brows up, eyes wide, O mouth). |

`chibi` is out of the bench: its construction is a decal on a ball, not a
planar head.

## Running it

1. Canvas: 64×64 for the 48 px head, 128×128 for the 96 px head, RGB, a skin
   ramp of 5, hair ramp of 4, cloth ramp of 3, transparent backdrop.
2. Give the brief as written, plus "bust portrait, head N px tall", to a fresh
   session with no other instruction (`docs/evals/benchmarks.md`, procedure
   1–3). Do not mention the armature: whether the agent reaches for it is part
   of what is measured.
3. Capture `look op="preview"` of the result and the guide layer, if any.
4. Lay the twelve heads out in brief order, before above after, at 4×.

## What passes

Per head, all of:

- The block-in alone (planes or the first flat pass) reads as a head turned
  the way the brief says, at 1×.
- The cranium is one ovoid: in 3/4 the back of the skull shows behind the ear.
- A visible front/side break; the eyes sit in sockets under the brow; in 3/4
  the far eye is narrower.
- Brief 2: the underside of the jaw is its own plane and the eye line bows up.
- Hair sits on the cranium, stops at the ears; the neck goes under the skull.
- The same character reads across its two briefs (1–2, 3–4, 5–6).

## Results

### 2026-10-29 — `gpt-6.1-terra`, Hermes, headless Aseprite

Rows: npm 0.8.2 (before) · the branch with faceted planes (after v1) · the
branch with `values: "masses"` (after v2). One run per cell, no retries.

![48 px](face-bench/2026-10-29-48px.png)
![96 px](face-bench/2026-10-29-96px.png)

- The armature was used in all 24 branch runs, with no mention of it in the
  brief. Before the rule became a gate in `draw` step 1b, the agent read the
  rules and still blocked the head in by hand.
- Construction improves. The 3/4 heads turn instead of sliding, the cranium
  shows behind the ear, and the underside of the jaw shows from below (brief
  2). The far eye is narrower.
- Finish regresses. v1 left the plane facets in the skin, and the result
  reads as a mask. v2 removes most of them but keeps a hard half-tone seam
  down the face. The before row is still the more appealing set.
- `anime` should not carry modelled planes: brief 5 v2 has a block of shadow
  on the lower face where cel shading wants one flat value.

Verdict: **not passed**. ADR-0013 stays *proposed*. Next steps: two values
for `anime`/`chibi`, a softer half-tone edge for `realistic`/`adventure`,
then run the bench again.
