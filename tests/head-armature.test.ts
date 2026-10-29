import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  ARCHETYPE_NAMES,
  LEVEL_PLANES,
  buildHeadArmature,
  headPlaneLevel,
  mergedPlane,
  orientVector,
  projectPoint,
  type ArmatureInput,
  type Point,
} from "../dist/lib/head-armature.js";
import { compileHeadArmature, contrastingColors, headArmatureOp } from "../dist/tools/draw.js";

const neutral = { yaw: 0, pitch: 0, roll: 0 };
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
const RAMP = ["#3b2027", "#7a4040", "#b8705a", "#e0a07a", "#f6d2b0"];
const rect = (h: number) => ({ x: 4, y: 4, width: h, height: h });
const build = (extra: Partial<ArmatureInput> = {}) => buildHeadArmature({ rect: rect(64), ramp: RAMP, ...extra });

const xs = (pts: readonly Point[]) => pts.map((p) => p[0]);
const ys = (pts: readonly Point[]) => pts.map((p) => p[1]);
const minmax = (a: number[]) => [Math.min(...a), Math.max(...a)] as const;
const width = (pts: readonly Point[]) => { const [lo, hi] = minmax(xs(pts)); return hi - lo + 1; };
const meanX = (pts: readonly Point[]) => xs(pts).reduce((a, b) => a + b, 0) / pts.length;

// --- orientation primitives -------------------------------------------------

test("plane levels switch at the specified head heights", () => {
  assert.throws(() => headPlaneLevel(27), /too_small.*rules:\/\/32/);
  assert.equal(headPlaneLevel(28), 3);
  assert.equal(headPlaneLevel(39), 3);
  assert.equal(headPlaneLevel(40), 6);
  assert.equal(headPlaneLevel(79), 6);
  assert.equal(headPlaneLevel(80), 9);
});

test("positive yaw turns the front right and preserves depth", () => {
  const rotated = orientVector({ x: 0, y: 0, z: 1 }, { ...neutral, yaw: 90 });
  close(rotated.x, 1); close(rotated.y, 0); close(rotated.z, 0);
});

test("positive pitch raises the front of the head", () => {
  const rotated = orientVector({ x: 0, y: 0, z: 1 }, { ...neutral, pitch: 45 });
  close(rotated.y, -Math.SQRT1_2); close(rotated.z, Math.SQRT1_2);
});

test("positive roll rotates clockwise around the head center", () => {
  const r = { x: 10, y: 20, width: 21, height: 21 };
  assert.deepEqual(projectPoint({ x: 5, y: 0, z: 0 }, { ...neutral, roll: 90 }, r), [20, 35]);
  assert.deepEqual(projectPoint({ x: 5, y: 0, z: 0 }, neutral, r), [25, 30]);
});

test("combined orientation preserves vector length", () => {
  const point = { x: 2, y: -3, z: 4 };
  const rotated = orientVector(point, { yaw: 41, pitch: -17, roll: 23 });
  close(Math.hypot(rotated.x, rotated.y, rotated.z), Math.hypot(point.x, point.y, point.z));
});

// --- the armature -------------------------------------------------------------

test("front view is symmetric within one pixel", () => {
  const { armature: a } = build({ yaw: 0 });
  const [lo, hi] = minmax(xs(a.silhouette));
  const mid = (lo + hi) / 2;
  const axisMean = meanX(a.axis);
  assert.ok(Math.abs(axisMean - mid) <= 1, `axis ${axisMean} vs silhouette centre ${mid}`);
  const [left, right] = [a.eyes.find((e) => e.side === "left")!, a.eyes.find((e) => e.side === "right")!];
  assert.ok(Math.abs((mid - left.center[0]) - (right.center[0] - mid)) <= 1, "eyes mirror around the axis");
  assert.equal(left.center[1], right.center[1], "eyes on one row");
  assert.ok(Math.abs(width(left.footprint) - width(right.footprint)) <= 1, "eye footprints match");
  const brow = a.landmarks.brow;
  assert.ok(Math.abs(meanX(brow) - mid) <= 1, "brow line centred");
});

test("increasing yaw shrinks the far eye, moves the axis toward the turn, and hides the far eye before 90°", () => {
  const widths: number[] = [];
  const axes: number[] = [];
  let hiddenAt: number | null = null;
  for (const yaw of [0, 20, 40, 60, 80]) {
    const { armature: a } = build({ yaw });
    const far = a.eyes.find((e) => !e.near) ?? a.eyes.find((e) => e.side === "left")!;
    widths.push(far.visible ? width(far.footprint) : 0);
    const [lo, hi] = minmax(xs(a.silhouette));
    axes.push(meanX(a.axis) - (lo + hi) / 2);
    if (!far.visible && hiddenAt === null) hiddenAt = yaw;
  }
  for (let i = 1; i < widths.length; i++) assert.ok(widths[i]! <= widths[i - 1]!, `far eye width not shrinking: ${widths}`);
  for (let i = 1; i < axes.length; i++) assert.ok(axes[i]! > axes[i - 1]!, `axis not moving toward the turn: ${axes}`);
  assert.ok(hiddenAt !== null && hiddenAt < 90, `far eye never hidden: ${widths}`);
  const { armature: turned } = build({ yaw: 40 });
  assert.equal(turned.eyes.find((e) => e.side === "right")!.near, false, "positive yaw turns the viewer-right eye away");
});

test("positive pitch curves the eye line upward at the centre and shows the underside of the jaw", () => {
  const level = build({ pitch: 0 }).armature;
  const up = build({ pitch: 30 }).armature;
  const bow = (line: readonly Point[]) => {
    const [lo, hi] = minmax(xs(line));
    const centre = line.filter((p) => Math.abs(p[0] - (lo + hi) / 2) <= 1);
    const ends = line.filter((p) => p[0] <= lo + 1 || p[0] >= hi - 1);
    const avg = (pts: Point[]) => pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return avg(ends) - avg(centre); // > 0 when the centre is higher than the ends
  };
  assert.ok(bow(up.landmarks.eyeLine) > bow(level.landmarks.eyeLine) + 0.5, "eye line arcs up from below");
  const under = (a: typeof level) => a.planes.filter((p) => p.type === "under" || p.name.startsWith("under")).reduce((s, p) => s + p.area, 0);
  assert.ok(under(up) > under(level), `under-jaw area ${under(up)} should exceed ${under(level)}`);
});

test("roll rotates the landmarks around the head centre", () => {
  const { armature: a } = build({ roll: 20 });
  const left = a.eyes.find((e) => e.side === "left")!.center;
  const right = a.eyes.find((e) => e.side === "right")!.center;
  assert.ok(right[1] > left[1], "clockwise roll lowers the viewer-right eye");
  const { armature: b } = build({ roll: -20 });
  assert.ok(b.eyes.find((e) => e.side === "right")!.center[1] < b.eyes.find((e) => e.side === "left")!.center[1]);
});

test("plane level follows the head height and refuses heads under 28 px", () => {
  assert.equal(buildHeadArmature({ rect: rect(32) }).armature.level, 3);
  assert.equal(buildHeadArmature({ rect: rect(48) }).armature.level, 6);
  assert.equal(buildHeadArmature({ rect: rect(96) }).armature.level, 9);
  assert.throws(() => buildHeadArmature({ rect: rect(24) }), (err: Error & { code?: string }) => err.code === "too_small" && /rules:\/\/32/.test(err.message));
  for (const [h, level] of [[32, 3], [48, 6], [96, 9]] as const) {
    const names = new Set(buildHeadArmature({ rect: rect(h), yaw: 30, pitch: 15 }).armature.planes.map((p) => p.type));
    for (const n of names) {
      assert.ok(n === "ear" || n === "neck" || LEVEL_PLANES[level].includes(n), `${n} is not a level-${level} plane`);
    }
  }
  assert.equal(mergedPlane("cheekFront", 3), "face");
  assert.equal(mergedPlane("cheekFront", 6), "cheek");
  assert.equal(mergedPlane("cheekFront", 9), "cheekFront");
});

test("the guide stays inside the head rect, hair shell included and neck excluded", () => {
  for (const archetype of ARCHETYPE_NAMES) {
    for (const yaw of [0, 45, 90]) {
      const r = rect(64);
      const { armature: a } = buildHeadArmature({ rect: r, archetype, yaw });
      const all = [...a.silhouette, ...a.hairShell];
      const [x0, x1] = minmax(xs(all));
      const [y0, y1] = minmax(ys(all));
      assert.ok(x0 >= r.x - 1 && x1 <= r.x + r.width && y0 >= r.y - 1 && y1 <= r.y + r.height, `${archetype} yaw ${yaw}: ${x0},${y0}–${x1},${y1}`);
      assert.ok(Math.max(...ys(a.neck)) > y1 - 2, `${archetype}: the neck hangs below the head`);
    }
  }
});

test("the hair shell sits outside the cranium by 1–3 px and never wraps the face", () => {
  const { armature: a } = build();
  const top = (pts: readonly Point[]) => Math.min(...ys(pts));
  const gap = top(a.silhouette) - top(a.hairShell);
  assert.ok(gap >= 1 && gap <= 3, `shell offset ${gap}`);
  assert.ok(Math.max(...ys(a.hairShell)) < a.landmarks.chin![1], "hair shell stops above the chin");
  const none = buildHeadArmature({ rect: rect(64), hair: false }).armature;
  assert.equal(none.hairShell.length, 0);
  assert.equal(none.landmarks.hairline.length, 0);
});

test("the neck is a cylinder under the cranium, behind the chin", () => {
  const { armature: a } = build({ yaw: 90 });
  const chin = a.landmarks.chin!;
  const neckTop = a.neck.filter((p) => p[1] <= chin[1] + 2);
  assert.ok(neckTop.length > 0, "the neck reaches up behind the jaw");
  assert.ok(meanX(a.neck) < chin[0], "in right profile the neck sits behind (left of) the chin");
  assert.equal(buildHeadArmature({ rect: rect(64), neck: false }).armature.neck.length, 0);
});

test("eyes are eyeballs for realistic/adventure and decals for anime/chibi", () => {
  for (const archetype of ARCHETYPE_NAMES) {
    const { armature: a } = build({ archetype });
    const kind = archetype === "anime" || archetype === "chibi" ? "decal" : "sphere";
    for (const e of a.eyes) {
      assert.equal(e.kind, kind, archetype);
      assert.ok(e.upperLid.length > 1 && e.lowerLid.length > 1 && e.browOverhang.length > 1, `${archetype} eye curves`);
      assert.ok(Math.max(...ys(e.browOverhang)) <= Math.min(...ys(e.upperLid)) + 1, `${archetype}: the brow overhangs the lid`);
    }
  }
  const anime = build({ archetype: "anime" }).armature.eyes[0]!;
  const real = build({ archetype: "realistic" }).armature.eyes[0]!;
  assert.ok(width(anime.footprint) > width(real.footprint), "anime eyes are larger");
});

test("sliders change the facial block", () => {
  const jaw = (v: number) => {
    const { armature: a } = build({ sliders: { jawWidth: v } });
    const lowRows = a.silhouette.filter((p) => p[1] === a.landmarks.mouth[0]![1]);
    return width(lowRows);
  };
  assert.ok(jaw(1) > jaw(-1), "jawWidth widens the jaw");
  const chinY = (v: number) => {
    const { armature: a } = build({ sliders: { faceLength: v }, hair: false, neck: false });
    return a.landmarks.chin![1] - a.eyes[0]!.center[1];
  };
  assert.ok(chinY(1) > chinY(-1), "faceLength lengthens eye-to-chin");
  const eyeRatio = (v: number) => {
    const { armature: a } = build({ sliders: { age: v }, hair: false, neck: false });
    const [top, bottom] = minmax(ys(a.silhouette));
    return (a.eyes[0]!.center[1] - top) / (bottom - top);
  };
  assert.ok(eyeRatio(-1) > eyeRatio(1), "younger heads carry the eyes lower");
  const brow = (v: number) => build({ yaw: 90, sliders: { browRidge: v } }).armature.silhouette;
  assert.ok(Math.max(...xs(brow(1))) >= Math.max(...xs(brow(-1))), "browRidge pushes the brow forward");
  const cheek = (v: number) => width(build({ sliders: { cheekbones: v }, hair: false }).armature.silhouette.filter((p) => p[1] === build().armature.eyes[0]!.center[1] + 3));
  assert.ok(cheek(1) >= cheek(-1), "cheekbones widen the face");
  const chinW = (v: number) => {
    const { armature: a } = build({ sliders: { chin: v } });
    const bottom = Math.max(...ys(a.silhouette.filter((p) => p[1] <= a.landmarks.chin![1])));
    return width(a.silhouette.filter((p) => p[1] === bottom - 2));
  };
  assert.ok(chinW(1) > chinW(-1), "chin widens the chin");
});

test("planes are coloured from the ramp, brightest on the lit side", () => {
  for (const light of ["upper-left", "upper-right"] as const) {
    const { armature: a, raster } = build({ yaw: 0, light });
    for (const p of a.planes) assert.ok(RAMP.includes(p.color!), `${p.name} colour ${p.color}`);
    for (const p of raster.planes) assert.ok(p.rampIndex >= 0 && p.rampIndex < RAMP.length);
    const sides = a.planes.filter((p) => p.type === "side");
    const l = sides.find((p) => p.side === "left")!, r = sides.find((p) => p.side === "right")!;
    if (light === "upper-left") assert.ok(l.value > r.value, `left ${l.value} vs right ${r.value}`);
    else assert.ok(r.value > l.value, `right ${r.value} vs left ${l.value}`);
  }
});

test("rhythm curves are returned but never drawn", () => {
  const { armature: a, raster } = build({ yaw: 30 });
  assert.ok(a.rhythm.length >= 3 && a.rhythm.length <= 4);
  const drawn = new Set([...raster.structure, ...raster.features].map(([x, y]) => `${x},${y}`));
  const nape = a.rhythm.find((r) => r.name === "cranium-nape")!;
  const inside = nape.points.filter(([x, y]) => drawn.has(`${x},${y}`)).length;
  assert.ok(inside < nape.points.length, "rhythm points are not all guide pixels");
});

// --- the draw op ----------------------------------------------------------------

test("headArmature op compiles to a plane pass under a guide pass with palette-picked colours", () => {
  const op = headArmatureOp.parse({ kind: "headArmature", rect: rect(48), yaw: 30, planes: { ramp: RAMP } });
  const palette = ["#000000", ...RAMP, "#29adff", "#00e436"];
  const { passes, guideColor, featureColor, armature } = compileHeadArmature(op, palette);
  assert.deepEqual(passes.map((p) => p.layer), ["head-planes", "guide"]);
  assert.ok(passes.every((p) => p.create));
  assert.ok(!RAMP.includes(guideColor) && !RAMP.includes(featureColor) && guideColor !== featureColor);
  const planeColours = new Set(passes[0]!.ops.map((o) => o.color as string));
  for (const c of planeColours) assert.ok(RAMP.includes(c));
  assert.equal(armature.level, 6);
  const noPlanes = compileHeadArmature(headArmatureOp.parse({ kind: "headArmature", rect: rect(48), guideLayer: "g", guideColor: "#ffffff", featureColor: "#ff004d" }));
  assert.deepEqual(noPlanes.passes.map((p) => p.layer), ["g"]);
  assert.deepEqual(noPlanes.passes[0]!.ops.map((o) => o.color), ["#ffffff", "#ff004d"]);
});

test("contrastingColors puts the colour furthest from the ramp first", () => {
  assert.equal(contrastingColors(["#e0a07a", "#29adff", "#b8705a"], RAMP)[0], "#29adff");
});

test("the plane block-in has no specks: every value cluster reaches the minimum area", () => {
  const height = 48;
  const { raster } = buildHeadArmature({ rect: { x: 0, y: 0, width: height, height }, yaw: -35, ramp: ["#000000", "#555555", "#999999", "#cccccc", "#ffffff"] });
  const value = new Map(raster.planes.map((p) => [`${p.x},${p.y}`, p.rampIndex]));
  const seen = new Set<string>();
  const minArea = Math.max(2, Math.round((height * height) / 400));
  for (const start of value.keys()) {
    if (seen.has(start)) continue;
    const v0 = value.get(start);
    const stack = [start];
    let area = 0;
    seen.add(start);
    while (stack.length) {
      const [x, y] = stack.pop()!.split(",").map(Number) as [number, number];
      area++;
      for (const n of [`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]) {
        if (!seen.has(n) && value.get(n) === v0) { seen.add(n); stack.push(n); }
      }
    }
    assert.ok(area >= minArea, `cluster of ${area} px at ${start} is below ${minArea}`);
  }
});

test("front ears hug the head instead of sticking out as wings", () => {
  const height = 96;
  const { armature } = buildHeadArmature({ rect: { x: 0, y: 0, width: height, height }, yaw: 0, ramp: ["#000000", "#ffffff"] });
  const head = armature.planes.filter((p) => p.type !== "ear" && !p.type.startsWith("neck"));
  const left = Math.min(...head.map((p) => p.bounds.x));
  const right = Math.max(...head.map((p) => p.bounds.x + p.bounds.width - 1));
  const ears = armature.planes.filter((p) => p.type === "ear");
  assert.equal(ears.length, 2, "both ears show from the front");
  for (const ear of ears) {
    const out = ear.side === "left" ? left - ear.bounds.x : ear.bounds.x + ear.bounds.width - 1 - right;
    assert.ok(out <= Math.round(height * 0.03), `${ear.name} sticks out ${out} px past the cranium`);
    assert.ok(ear.bounds.height <= Math.round(height * 0.18), `${ear.name} is ${ear.bounds.height} px tall`);
  }
});

test("masses group the planes into three skin values; planes keep one step each", () => {
  const ramp = ["#3b2027", "#7a4040", "#b8705a", "#e0a07a", "#f6d2b0"];
  const base = { rect: { x: 0, y: 0, width: 96, height: 96 }, yaw: -35, ramp };
  const distinct = (values: "masses" | "planes") =>
    new Set(buildHeadArmature({ ...base, values }).raster.planes.map((p) => p.rampIndex));
  const masses = distinct("masses");
  assert.ok(masses.size <= 3, `masses use ${[...masses]}`);
  assert.ok(!masses.has(0) && !masses.has(4), "the darkest and lightest steps stay free for accents");
  assert.ok(distinct("planes").size > 3, "planes show the construction");
});

test("the headArmature op paints masses by default", () => {
  const op = headArmatureOp.parse({ kind: "headArmature", rect: { x: 0, y: 0, width: 64, height: 64 }, planes: { ramp: ["#000000", "#444444", "#888888", "#bbbbbb", "#ffffff"] } });
  assert.equal(op.planes?.values, "masses");
});

test("cel-shaded archetypes get two skin values and no orbit in masses", () => {
  const ramp = ["#3b2027", "#7a4040", "#b8705a", "#e0a07a", "#f6d2b0"];
  for (const archetype of ["anime", "chibi"] as const) {
    const { armature, raster } = buildHeadArmature({ rect: { x: 0, y: 0, width: 96, height: 96 }, archetype, yaw: 0, ramp, values: "masses" });
    assert.ok(new Set(raster.planes.map((p) => p.rampIndex)).size <= 2, `${archetype} uses more than two values`);
    for (const p of armature.planes.filter((q) => q.type === "socket" || q.type === "cheekFront" || q.type === "front")) {
      assert.equal(p.rampIndex, 3, `${archetype} ${p.name} is shaded`);
    }
  }
});

test("a front head in masses keeps the face out of the shadow step", () => {
  const ramp = ["#3b2027", "#7a4040", "#b8705a", "#e0a07a", "#f6d2b0"];
  const { armature } = buildHeadArmature({ rect: { x: 0, y: 0, width: 96, height: 96 }, yaw: 0, ramp, values: "masses" });
  for (const p of armature.planes.filter((q) => ["front", "cheekFront", "muzzle", "chin"].includes(q.type))) {
    assert.ok(p.rampIndex >= 2, `${p.name} fell into the shadow`);
  }
});

test("modelled masses bend the terminator instead of following plane edges", () => {
  const ramp = ["#3b2027", "#7a4040", "#b8705a", "#e0a07a", "#f6d2b0"];
  const { raster } = buildHeadArmature({ rect: { x: 0, y: 0, width: 96, height: 96 }, yaw: -35, ramp, values: "masses" });
  const at = new Map(raster.planes.map((p) => [`${p.x},${p.y}`, p.rampIndex]));
  // Follow the light/half-tone boundary row by row: a plane edge keeps the
  // same x for long stretches, a curved terminator keeps moving.
  let rows = 0, unchanged = 0, prev: number | undefined;
  for (const y of [...new Set(raster.planes.map((p) => p.y))].sort((a, b) => a - b)) {
    const xs = raster.planes.filter((p) => p.y === y).map((p) => p.x).sort((a, b) => a - b);
    const bx = xs.find((x) => { const a = at.get(`${x},${y}`), b = at.get(`${x + 1},${y}`); return (a === 3 && b === 2) || (a === 2 && b === 3); });
    if (bx === undefined) { prev = undefined; continue; }
    rows++;
    if (prev === bx) unchanged++;
    prev = bx;
  }
  assert.ok(rows >= 40, `the terminator spans only ${rows} rows`);
  assert.ok(unchanged / rows <= 0.6, `the terminator stays straight on ${unchanged}/${rows} rows`);
});

test("a front realistic head is about two thirds as wide as it is tall", () => {
  const { armature } = buildHeadArmature({ rect: { x: 0, y: 0, width: 96, height: 96 }, archetype: "realistic", yaw: 0, ramp: ["#000000", "#ffffff"] });
  const xs = armature.silhouette.map((p) => p[0]), ys = armature.silhouette.map((p) => p[1]);
  const ratio = (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
  assert.ok(ratio >= 0.66 && ratio <= 0.78, `width/height ${ratio.toFixed(2)} reads as an egg`);
});

test("a 48 px eye opens to about 7x5 with a skin row under the brow", () => {
  const { armature } = buildHeadArmature({ rect: { x: 0, y: 0, width: 48, height: 48 }, archetype: "adventure", yaw: -25, ramp: ["#000000", "#ffffff"] });
  for (const e of armature.eyes) {
    const xs = e.footprint.map((p) => p[0]), ys = e.footprint.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs) + 1, h = Math.max(...ys) - Math.min(...ys) + 1;
    assert.ok(w >= 6 && h >= 5, `${e.side} eye opens ${w}x${h}, a slit`);
    assert.ok(Math.min(...ys) - Math.max(...e.browOverhang.map((p) => p[1])) >= 2, `${e.side} brow rests on the lid`);
  }
});

test("a cel-shaded head turned from the light keeps its cheek out of the shadow", () => {
  const ramp = ["#3b2027", "#7a4040", "#b8705a", "#e0a07a", "#f6d2b0"];
  const { armature } = buildHeadArmature({ rect: { x: 0, y: 0, width: 96, height: 96 }, archetype: "anime", yaw: -25, ramp, values: "masses" });
  for (const p of armature.planes.filter((q) => q.type !== "under" && q.type !== "neck")) {
    assert.equal(p.rampIndex, 3, `${p.name} falls into the cel shadow`);
  }
});

test("a portrait key light keeps most of the face lit and the far side in half-tone", () => {
  const ramp = ["#3b2027", "#7a4040", "#b8705a", "#e0a07a", "#f6d2b0"];
  for (const [archetype, yaw] of [["adventure", 0], ["adventure", 25], ["adventure", -25], ["realistic", 25]] as const) {
    const { raster } = buildHeadArmature({ rect: { x: 0, y: 0, width: 96, height: 96 }, archetype, yaw, ramp, values: "masses" });
    const face = raster.planes.filter((p) => p.y >= 36 && p.y <= 78);
    const lit = face.filter((p) => p.rampIndex >= 3).length / face.length;
    assert.ok(lit >= 0.6, `${archetype} yaw ${yaw}: only ${lit.toFixed(2)} of the face is lit, it reads half in shadow`);
    assert.ok(lit <= 0.9, `${archetype} yaw ${yaw}: ${lit.toFixed(2)} of the face is lit, no turn left`);
  }
});
