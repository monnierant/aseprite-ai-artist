/**
 * Head armature — a volumetric head model (ovoid cranium + wedge facial block
 * cut into simplified Asaro planes) oriented by yaw/pitch/roll, rasterised
 * with a z-buffer and expanded into plain pixels. See ADR-0013 and
 * docs/specs/head-armature.md.
 *
 * Coordinates are head-local: x points to the viewer's right in a front view,
 * y down and z toward the viewer. One unit is the realistic head height
 * (cranium top -0.5 to chin 0.5); the result is scaled to fit `rect`.
 */

export type Vector3 = { x: number; y: number; z: number };
export type Orientation = { yaw: number; pitch: number; roll: number };
export type HeadRect = { x: number; y: number; width: number; height: number };
export type Archetype = "realistic" | "adventure" | "anime" | "chibi";
export type PlaneLevel = 3 | 6 | 9;
export type Point = [number, number];

export interface Sliders {
  jawWidth?: number;
  faceLength?: number;
  browRidge?: number;
  cheekbones?: number;
  age?: number;
  chin?: number;
}

export type LightPreset = "upper-left" | "upper-right" | "front" | "left" | "right" | "top";

export interface ArmatureInput {
  rect: HeadRect;
  archetype?: Archetype;
  yaw?: number;
  pitch?: number;
  roll?: number;
  sliders?: Sliders;
  hair?: boolean;
  neck?: boolean;
  light?: LightPreset | Vector3;
  ramp?: readonly string[];
  /**
   * "planes": every plane gets its own step — the construction study.
   * "masses": planes are grouped into light, half-tone and shadow masses and
   * cavities join the shadow — the start of a finished skin. Default "planes".
   */
  values?: "planes" | "masses";
}

export interface ArmatureEye {
  side: "left" | "right";
  near: boolean;
  kind: "sphere" | "decal";
  center: Point;
  footprint: Point[];
  upperLid: Point[];
  lowerLid: Point[];
  browOverhang: Point[];
  visible: boolean;
}

export interface ArmaturePlane {
  name: string;
  type: string;
  side: "left" | "right" | "center";
  area: number;
  bounds: { x: number; y: number; width: number; height: number };
  centroid: Point;
  value: number;
  rampIndex: number;
  color?: string;
}

export interface Armature {
  level: PlaneLevel;
  archetype: Archetype;
  orientation: Orientation;
  scale: number;
  silhouette: Point[];
  axis: Point[];
  landmarks: {
    brow: Point[];
    eyeLine: Point[];
    noseBase: Point | null;
    mouth: Point[];
    chin: Point | null;
    hairline: Point[];
  };
  eyes: ArmatureEye[];
  planes: ArmaturePlane[];
  ears: { side: "left" | "right"; near: boolean; polygon: Point[]; visible: boolean }[];
  hairShell: Point[];
  neck: Point[];
  rhythm: { name: string; points: Point[] }[];
}

export interface RasterLayers {
  /** Pixel coordinates of the structural guide: silhouette, plane borders, hair shell, neck. */
  structure: Point[];
  /** Pixel coordinates of feature guides: axis, landmark lines, eyes, hairline, ears. */
  features: Point[];
  /** Pixel → ramp index for the plane block-in (head, ears, neck). */
  planes: { x: number; y: number; rampIndex: number }[];
}

export class ArmatureError extends Error {
  constructor(readonly code: "too_small" | "invalid_args", message: string) {
    super(message);
    this.name = "ArmatureError";
  }
}

// ---------------------------------------------------------------------------
// Orientation and projection
// ---------------------------------------------------------------------------

/** Rotate a head-local vector into camera space, before orthographic projection. */
export function orientVector(point: Vector3, orientation: Orientation): Vector3 {
  const radians = Math.PI / 180;
  const yaw = orientation.yaw * radians;
  const pitch = orientation.pitch * radians;
  const roll = orientation.roll * radians;
  // Positive yaw moves the front of the face to the viewer's right.
  const x = point.x * Math.cos(yaw) + point.z * Math.sin(yaw);
  const z = -point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
  // Positive pitch raises the front of the face on the screen.
  const y = point.y * Math.cos(pitch) - z * Math.sin(pitch);
  const depth = point.y * Math.sin(pitch) + z * Math.cos(pitch);
  return {
    x: x * Math.cos(roll) - y * Math.sin(roll),
    y: x * Math.sin(roll) + y * Math.cos(roll),
    z: depth,
  };
}

/** Project an already-sized head-local point into integer canvas coordinates. */
export function projectPoint(point: Vector3, orientation: Orientation, rect: HeadRect): [number, number] {
  const rotated = orientVector(point, orientation);
  return [
    Math.round(rect.x + (rect.width - 1) / 2 + rotated.x),
    Math.round(rect.y + (rect.height - 1) / 2 + rotated.y),
  ];
}

/** Choose the prescribed level of detail; callers must reject heads below 28 px. */
export function headPlaneLevel(height: number): PlaneLevel {
  if (height < 28) throw new RangeError("too_small: utiliser les tables de pose de pixels rules://32");
  return height >= 80 ? 9 : height >= 40 ? 6 : 3;
}

// ---------------------------------------------------------------------------
// Small vector helpers
// ---------------------------------------------------------------------------

const v = (x: number, y: number, z: number): Vector3 => ({ x, y, z });
const sub = (a: Vector3, b: Vector3): Vector3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
const add = (a: Vector3, b: Vector3): Vector3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
const mul = (a: Vector3, k: number): Vector3 => v(a.x * k, a.y * k, a.z * k);
const dot = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vector3, b: Vector3): Vector3 =>
  v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const len = (a: Vector3): number => Math.hypot(a.x, a.y, a.z);
const norm = (a: Vector3): Vector3 => {
  const l = len(a);
  return l === 0 ? v(0, 0, 0) : mul(a, 1 / l);
};
const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// Archetypes and sliders
// ---------------------------------------------------------------------------

interface Proportions {
  cranium: Vector3; // scale of the cranium ovoid radii (x, y, z)
  faceLength: number; // vertical scale of everything below the brow
  faceWidth: number;
  jawWidth: number; // width multiplier reached at the chin
  chinWidth: number;
  nose: number; // protrusion of the nose beyond the face
  browRidge: number; // extra forward z on the brow ridge
  cheekbones: number; // extra width/forward on the zygomatic points
  chinDrop: number; // extra length of a pointed chin
  eye: { kind: "sphere" | "decal"; radius: number; width: number; height: number; separation: number };
}

const ARCHETYPES: Record<Archetype, Proportions> = {
  realistic: {
    cranium: v(1, 1, 1), faceLength: 1, faceWidth: 1.08, jawWidth: 1, chinWidth: 1, nose: 1,
    browRidge: 0, cheekbones: 0, chinDrop: 0,
    eye: { kind: "sphere", radius: 0.058, width: 0, height: 0, separation: 0.13 },
  },
  adventure: {
    cranium: v(1.06, 1.06, 1.02), faceLength: 0.9, faceWidth: 1.05, jawWidth: 0.94, chinWidth: 0.95, nose: 0.75,
    browRidge: 0, cheekbones: 0, chinDrop: 0,
    eye: { kind: "sphere", radius: 0.066, width: 0, height: 0, separation: 0.13 },
  },
  anime: {
    cranium: v(1.1, 1.12, 1.04), faceLength: 0.8, faceWidth: 0.92, jawWidth: 0.78, chinWidth: 0.55, nose: 0.45,
    browRidge: -0.012, cheekbones: -0.01, chinDrop: 0.015,
    eye: { kind: "decal", radius: 0, width: 0.15, height: 0.17, separation: 0.125 },
  },
  chibi: {
    cranium: v(1.3, 1.35, 1.2), faceLength: 0.55, faceWidth: 1.0, jawWidth: 0.95, chinWidth: 1.15, nose: 0.2,
    browRidge: -0.02, cheekbones: -0.015, chinDrop: 0,
    eye: { kind: "decal", radius: 0, width: 0.17, height: 0.19, separation: 0.14 },
  },
};

export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES) as Archetype[];
export const SLIDER_NAMES = ["jawWidth", "faceLength", "browRidge", "cheekbones", "age", "chin"] as const;

function proportions(archetype: Archetype, sliders: Sliders): Proportions {
  const base = ARCHETYPES[archetype];
  const s = (k: keyof Sliders) => clamp(sliders[k] ?? 0, -1, 1);
  const p: Proportions = { ...base, cranium: { ...base.cranium }, eye: { ...base.eye } };
  p.jawWidth *= 1 + 0.25 * s("jawWidth");
  p.faceLength *= 1 + 0.15 * s("faceLength");
  p.browRidge += 0.02 * s("browRidge");
  p.cheekbones += 0.025 * s("cheekbones");
  const age = s("age");
  if (age < 0) {
    // Younger: bigger cranium, shorter face, smaller nose.
    p.cranium = mul(p.cranium, 1 - 0.08 * age);
    p.faceLength *= 1 + 0.2 * age;
    p.nose *= 1 + 0.35 * age;
  } else {
    p.faceLength *= 1 + 0.08 * age;
    p.nose *= 1 + 0.25 * age;
    p.browRidge += 0.01 * age;
  }
  const chin = s("chin");
  p.chinWidth *= 1 + 0.45 * chin;
  if (chin < 0) p.chinDrop += 0.025 * -chin;
  return p;
}

// ---------------------------------------------------------------------------
// The base rig (realistic proportions, right half: x >= 0)
// ---------------------------------------------------------------------------

const BROW_Y = -0.06;
const CHIN_Y = 0.5;
const CRANIUM_CENTER = v(0, -0.12, -0.04);
const CRANIUM_RADII = v(0.33, 0.38, 0.38);

type Tag = "brow" | "nose" | "cheekbone" | "chin";
interface RigPoint { p: Vector3; tags?: Tag[] }

const RIG: Record<string, RigPoint> = {
  G: { p: v(0, -0.06, 0.36), tags: ["brow"] },
  Br1: { p: v(0.1, -0.075, 0.345), tags: ["brow"] },
  Br2: { p: v(0.2, -0.06, 0.29), tags: ["brow"] },
  Tm: { p: v(0.28, -0.04, 0.16) },
  Si: { p: v(0.05, 0.0, 0.31) },
  Sc: { p: v(0.115, 0.0, 0.25) },
  So: { p: v(0.21, 0.01, 0.255) },
  Sb: { p: v(0.12, 0.065, 0.29) },
  Nr: { p: v(0, -0.02, 0.345), tags: ["nose"] },
  Ns1: { p: v(0.03, 0.0, 0.325), tags: ["nose"] },
  Nt: { p: v(0, 0.17, 0.45), tags: ["nose"] },
  Nw: { p: v(0.055, 0.19, 0.35), tags: ["nose"] },
  Nbc: { p: v(0, 0.215, 0.38), tags: ["nose"] },
  Cz: { p: v(0.18, 0.08, 0.27), tags: ["cheekbone"] },
  Cn: { p: v(0.075, 0.15, 0.31) },
  Cs: { p: v(0.285, 0.06, 0.11), tags: ["cheekbone"] },
  Mn: { p: v(0.08, 0.21, 0.32) },
  Mc: { p: v(0.085, 0.31, 0.3) },
  Ml: { p: v(0, 0.34, 0.355) },
  Kt: { p: v(0, 0.4, 0.33), tags: ["chin"] },
  Kc: { p: v(0.07, 0.46, 0.29), tags: ["chin"] },
  Kb: { p: v(0, 0.5, 0.25), tags: ["chin"] },
  Kbc: { p: v(0.07, 0.49, 0.235), tags: ["chin"] },
  Jm: { p: v(0.17, 0.42, 0.12) },
  Ja: { p: v(0.26, 0.3, -0.08) },
  Eb: { p: v(0.29, 0.0, -0.05) },
  U1: { p: v(0, 0.43, 0.02) },
  U2: { p: v(0.12, 0.38, -0.06) },
};

/** Canonical plane types (CONTEXT.md, « Jeu de plans »). */
type PlaneType =
  | "front" | "top" | "back" | "temple" | "socket" | "nose" | "cheekFront" | "cheekSide" | "muzzle" | "chin" | "under"
  | "ear" | "neck";

/** Polygons of the right half; mirrored for the left. Fans from the first vertex unless `center` is set. */
const FACE_POLYGONS: { type: PlaneType; ring: string[]; center?: string }[] = [
  { type: "socket", ring: ["Si", "Br1", "Br2", "So", "Sb"], center: "Sc" },
  { type: "front", ring: ["G", "Br1", "Si", "Nr"] },
  { type: "nose", ring: ["Nr", "Ns1", "Nw", "Nt"] },
  { type: "nose", ring: ["Nt", "Nw", "Nbc"] },
  { type: "cheekFront", ring: ["Si", "Sb", "Cn", "Nw", "Ns1"] },
  { type: "cheekFront", ring: ["Sb", "So", "Cz", "Cn"] },
  { type: "cheekFront", ring: ["Cn", "Cz", "Mc", "Mn"] },
  { type: "cheekFront", ring: ["Nw", "Cn", "Mn"] },
  { type: "cheekFront", ring: ["Cz", "Jm", "Kc", "Mc"] },
  { type: "muzzle", ring: ["Nbc", "Nw", "Mn", "Mc", "Ml"] },
  { type: "chin", ring: ["Ml", "Mc", "Kc", "Kt"] },
  { type: "chin", ring: ["Kt", "Kc", "Kbc", "Kb"] },
  { type: "chin", ring: ["Jm", "Kbc", "Kc"] },
  { type: "cheekSide", ring: ["Br2", "Tm", "Cs", "Cz", "So"] },
  { type: "cheekSide", ring: ["Cz", "Cs", "Ja", "Jm"] },
  { type: "cheekSide", ring: ["Tm", "Eb", "Ja", "Cs"] },
  { type: "under", ring: ["Kb", "Kbc", "Jm", "Ja", "U2", "U1"] },
];

const EAR_RING: Vector3[] = [
  v(0.3, -0.045, -0.04), v(0.325, -0.055, -0.11), v(0.325, 0.06, -0.165),
  v(0.305, 0.19, -0.13), v(0.29, 0.215, -0.07), v(0.295, 0.09, -0.035),
];

// ---------------------------------------------------------------------------
// Model construction
// ---------------------------------------------------------------------------

interface Triangle {
  a: Vector3; b: Vector3; c: Vector3;
  type: PlaneType;
  side: "left" | "right" | "center";
  lr: "left" | "right"; // side of the triangle's centroid, for planes split per side
  normal: Vector3; // outward, head-local
  neckT?: number; // 0 at the neck top, 1 at the bottom — the neck untwists toward the body
}

interface Model {
  props: Proportions;
  triangles: Triangle[];
  cranium: { center: Vector3; radii: Vector3 };
  points: Record<string, Vector3>; // deformed rig, right half
  mirror: (p: Vector3) => Vector3;
  y: { brow: number; eye: number; noseBase: number; mouth: number; chin: number; hairline: number; top: number };
  faceWidthAt: (y: number) => number;
  eyeCenters: { left: Vector3; right: Vector3 };
  ears: { left: Vector3[]; right: Vector3[] };
}

function buildModel(archetype: Archetype, sliders: Sliders, withNeck: boolean): Model {
  const props = proportions(archetype, sliders);
  const craniumRadii = v(CRANIUM_RADII.x * props.cranium.x, CRANIUM_RADII.y * props.cranium.y, CRANIUM_RADII.z * props.cranium.z);
  // Grow the cranium from the brow line, so the brow stays where the face hangs from it.
  const craniumCenter = v(0, BROW_Y + (CRANIUM_CENTER.y - BROW_Y) * props.cranium.y, CRANIUM_CENTER.z);
  const frontZ = (c: Vector3, r: Vector3, y: number) => c.z + r.z * Math.sqrt(Math.max(0, 1 - ((y - c.y) / r.y) ** 2));
  const dz = frontZ(craniumCenter, craniumRadii, BROW_Y) - frontZ(CRANIUM_CENTER, CRANIUM_RADII, BROW_Y);

  const mapY = (y: number) => (y <= BROW_Y ? y : BROW_Y + (y - BROW_Y) * props.faceLength);
  const widthAt = (baseY: number) => {
    const t = clamp((baseY - BROW_Y) / (CHIN_Y - BROW_Y), 0, 1);
    return props.faceWidth * lerp(1, props.jawWidth, smooth(0.3, 1, t));
  };

  const deform = (rp: RigPoint): Vector3 => {
    let { x, y, z } = rp.p;
    const tags = rp.tags ?? [];
    if (tags.includes("nose")) z = 0.32 + (z - 0.32) * props.nose;
    if (tags.includes("brow")) z += props.browRidge;
    if (tags.includes("cheekbone")) { x *= 1 + props.cheekbones * 3; z += props.cheekbones; }
    if (tags.includes("chin")) {
      x *= props.chinWidth;
      if (y > 0.45) y += props.chinDrop;
    }
    x *= widthAt(y);
    return v(x, mapY(y), z + dz);
  };

  const points: Record<string, Vector3> = {};
  for (const [name, rp] of Object.entries(RIG)) points[name] = deform(rp);
  const mirror = (p: Vector3) => v(-p.x, p.y, p.z);

  const triangles: Triangle[] = [];
  const centroidOf = (pts: Vector3[]) => mul(pts.reduce(add, v(0, 0, 0)), 1 / pts.length);
  const interior = v(0, 0.05, -0.05);
  const pushTri = (a: Vector3, b: Vector3, c: Vector3, type: PlaneType, side: Triangle["side"], outwardFrom = interior, neckT?: number) => {
    let n = norm(cross(sub(b, a), sub(c, a)));
    if (len(n) === 0) return;
    const cen = centroidOf([a, b, c]);
    if (dot(n, sub(cen, outwardFrom)) < 0) n = mul(n, -1);
    triangles.push({ a, b, c, type, side, lr: cen.x >= 0 ? "right" : "left", normal: n, neckT });
  };
  const sideOf = (pts: Vector3[], type: PlaneType): Triangle["side"] => {
    if (type === "front" || type === "muzzle" || type === "chin" || type === "under") return "center";
    const cx = centroidOf(pts).x;
    return cx >= 0 ? "right" : "left";
  };

  for (const poly of FACE_POLYGONS) {
    for (const flip of [false, true]) {
      const ring = poly.ring.map((k) => (flip ? mirror(points[k]!) : points[k]!));
      const side = sideOf(ring, poly.type);
      if (poly.center) {
        const c = flip ? mirror(points[poly.center]!) : points[poly.center]!;
        for (let i = 0; i < ring.length; i++) pushTri(c, ring[i]!, ring[(i + 1) % ring.length]!, poly.type, side);
      } else {
        for (let i = 1; i < ring.length - 1; i++) pushTri(ring[0]!, ring[i]!, ring[i + 1]!, poly.type, side);
      }
    }
  }

  // Ears: a slab hung on the side of the cranium, double-sided.
  const earRight = EAR_RING.map((p) => {
    const y = mapY(p.y);
    const k = Math.sqrt(Math.max(0.05, 1 - ((y - craniumCenter.y) / craniumRadii.y) ** 2));
    const sideX = craniumRadii.x * k;
    return v(sideX + (p.x - 0.29) * 0.6, y, p.z);
  });
  const earLeft = earRight.map(mirror);
  // The ear is a wedge rooted inside the head, not a flat card: seen from the
  // front a card is edge-on and floats as a thin arc beside the cheek.
  const earRoot = (ring: Vector3[]) => ring.map((p) => v(p.x * 0.72, p.y, p.z));
  for (const [ring, side] of [[earRight, "right"], [earLeft, "left"]] as const) {
    const root = earRoot(ring);
    const c = centroidOf(ring);
    const solidCenter = centroidOf([...ring, ...root]);
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      pushTri(c, ring[i]!, ring[j]!, "ear", side, solidCenter);
      pushTri(ring[i]!, root[i]!, root[j]!, "ear", side, solidCenter);
      pushTri(ring[i]!, root[j]!, ring[j]!, "ear", side, solidCenter);
    }
  }

  // Cranium ovoid.
  const browFront = frontZ(craniumCenter, craniumRadii, BROW_Y);
  const lat = 36, lon = 56;
  const cr = (i: number, j: number) => {
    const theta = (Math.PI * i) / lat; // 0 top, pi bottom
    const phi = (2 * Math.PI * j) / lon; // 0 front
    return v(
      craniumCenter.x + craniumRadii.x * Math.sin(theta) * Math.sin(phi),
      craniumCenter.y - craniumRadii.y * Math.cos(theta),
      craniumCenter.z + craniumRadii.z * Math.sin(theta) * Math.cos(phi),
    );
  };
  for (let i = 0; i < lat; i++) {
    for (let j = 0; j < lon; j++) {
      const a = cr(i, j), b = cr(i + 1, j), c = cr(i + 1, j + 1), d = cr(i, j + 1);
      const cen = centroidOf([a, b, c, d]);
      const n = norm(sub(cen, craniumCenter));
      // The facial block replaces the cranium's lower front: without this cut
      // the ovoid bulges through the eye sockets and cheeks.
      if (cen.y > BROW_Y - 0.01 && n.z > 0.15) continue;
      const type: PlaneType =
        n.z > 0.62 && cen.y < BROW_Y + 0.01 && cen.z > browFront - 0.2 ? "front"
          : n.y < -0.72 ? "top"
            : n.z < -0.45 ? "back"
              : "temple";
      const side: Triangle["side"] = type === "front" ? "center" : cen.x >= 0 ? "right" : "left";
      pushTri(a, b, c, type, side, craniumCenter);
      pushTri(a, c, d, type, side, craniumCenter);
    }
  }

  if (withNeck) {
    const segs = 24, rings = 8;
    const top = mapY(0.12), bottom = mapY(0.12) + 0.42;
    const ring = (r: number, j: number) => {
      const t = r / rings;
      const a = (2 * Math.PI * j) / segs;
      return { p: v(0.15 * Math.sin(a), lerp(top, bottom, t), -0.1 + 0.135 * Math.cos(a)), t };
    };
    for (let r = 0; r < rings; r++) {
      for (let j = 0; j < segs; j++) {
        const a = ring(r, j), b = ring(r + 1, j), c = ring(r + 1, j + 1), d = ring(r, j + 1);
        const axisA = v(0, a.p.y, -0.1), axisC = v(0, c.p.y, -0.1);
        const side: Triangle["side"] = a.p.x + d.p.x >= 0 ? "right" : "left";
        pushTri(a.p, b.p, c.p, "neck", side, axisA, (a.t + b.t) / 2);
        pushTri(a.p, c.p, d.p, "neck", side, axisC, (a.t + c.t) / 2);
      }
    }
  }

  const eyeY = mapY(0.0);
  const eyeZ = (x: number) => (props.eye.kind === "sphere" ? 0.3 - props.eye.radius + dz : 0);
  const sep = props.eye.separation * widthAt(0.0);
  return {
    props,
    triangles,
    cranium: { center: craniumCenter, radii: craniumRadii },
    points,
    mirror,
    y: {
      brow: mapY(-0.07), eye: eyeY, noseBase: points.Nbc!.y, mouth: mapY(0.31), chin: points.Kb!.y,
      hairline: craniumCenter.y - craniumRadii.y + (BROW_Y - (craniumCenter.y - craniumRadii.y)) * 0.38,
      top: craniumCenter.y - craniumRadii.y,
    },
    faceWidthAt: (y: number) => widthAt(y <= BROW_Y ? y : BROW_Y + (y - BROW_Y) / props.faceLength),
    eyeCenters: { right: v(sep, eyeY, eyeZ(sep)), left: v(-sep, eyeY, eyeZ(-sep)) },
    ears: { right: earRight, left: earLeft },
  };
}

/** Front-most surface depth at head-local (x, y), or null when the ray misses. */
function surfaceZ(triangles: readonly Triangle[], x: number, y: number, skip: (t: Triangle) => boolean = () => false): number | null {
  let best: number | null = null;
  for (const t of triangles) {
    if (skip(t)) continue;
    const { a, b, c } = t;
    const d = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(d) < 1e-12) continue;
    const w1 = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / d;
    const w2 = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / d;
    const w3 = 1 - w1 - w2;
    if (w1 < -1e-9 || w2 < -1e-9 || w3 < -1e-9) continue;
    const z = w1 * a.z + w2 * b.z + w3 * c.z;
    if (best === null || z > best) best = z;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Plane levels
// ---------------------------------------------------------------------------

/** Merge a canonical plane type into the level's plane name. */
export function mergedPlane(type: string, level: PlaneLevel): string {
  if (type === "ear" || type === "neck") return type;
  if (level === 9) return type;
  if (level === 6) {
    switch (type) {
      case "temple": case "back": return "side";
      case "cheekFront": case "muzzle": return "cheek";
      case "cheekSide": case "chin": return "jaw";
      default: return type; // front, top, socket, nose, under
    }
  }
  switch (type) {
    case "temple": case "back": case "cheekSide": case "under": return "side";
    case "top": return "top";
    case "socket": return "socket";
    default: return "face";
  }
}

/** Plane names per level, for documentation and tests (ears and neck come on top). */
export const LEVEL_PLANES: Record<PlaneLevel, readonly string[]> = {
  3: ["face", "side", "top", "socket"],
  6: ["front", "top", "side", "cheek", "jaw", "nose", "socket", "under"],
  9: ["front", "top", "back", "temple", "socket", "nose", "cheekFront", "cheekSide", "muzzle", "chin", "under"],
};

const SPLIT_BY_SIDE = new Set(["temple", "back", "cheekSide", "side", "socket", "nose", "cheekFront", "cheek", "jaw", "ear", "neck"]);
const OCCLUSION: Record<string, number> = { socket: 0.8, under: 0.72, neck: 0.85, ear: 0.92 };
// Planes the hair covers: toned down so the bare block-in does not read as a
// shiny bald dome, without being treated as cavities.
const UNDER_HAIR: Record<string, number> = { top: 0.82, back: 0.9 };

const LIGHTS: Record<LightPreset, Vector3> = {
  "upper-left": v(-0.75, -0.6, 0.6),
  "upper-right": v(0.75, -0.6, 0.6),
  front: v(0, -0.2, 1),
  left: v(-1, -0.15, 0.45),
  right: v(1, -0.15, 0.45),
  top: v(0, -1, 0.35),
};

// ---------------------------------------------------------------------------
// Raster helpers
// ---------------------------------------------------------------------------

function linePixels(a: Point, b: Point, out: Point[]): void {
  let [x0, y0] = a;
  const [x1, y1] = b;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function polylinePixels(points: readonly Point[], closed = false): Point[] {
  const out: Point[] = [];
  if (points.length === 1) out.push(points[0]!);
  for (let i = 0; i + 1 < points.length; i++) linePixels(points[i]!, points[i + 1]!, out);
  if (closed && points.length > 2) linePixels(points[points.length - 1]!, points[0]!, out);
  return out;
}

/**
 * Pixel cleanup of the plane block-in: value clusters smaller than `minArea`
 * join their most common neighbour, then 1-px teeth (a pixel with three or
 * four 4-neighbours of one other value) are filed off. Plane borders are
 * rasterised edges; without this they break into staircases and specks that
 * read as noise at 48 px.
 */
function cleanPlaneValues(values: Map<number, number>, minArea: number, key: (x: number, y: number) => number): Map<number, number> {
  const out = new Map(values);
  const coords = new Map<number, Point>();
  for (const k of values.keys()) coords.set(k, [(k % 16384) - 4096, Math.floor(k / 16384) - 4096]);
  const nbrs = (k: number): number[] => {
    const [x, y] = coords.get(k)!;
    return [key(x + 1, y), key(x - 1, y), key(x, y + 1), key(x, y - 1)].filter((n) => out.has(n));
  };
  const seen = new Set<number>();
  for (const start of values.keys()) {
    if (seen.has(start)) continue;
    const value = out.get(start)!;
    const comp = [start];
    seen.add(start);
    for (let i = 0; i < comp.length; i++) {
      for (const n of nbrs(comp[i]!)) if (!seen.has(n) && out.get(n) === value) { seen.add(n); comp.push(n); }
    }
    if (comp.length >= minArea) continue;
    const votes = new Map<number, number>();
    for (const k of comp) for (const n of nbrs(k)) {
      const nv = out.get(n)!;
      if (nv !== value) votes.set(nv, (votes.get(nv) ?? 0) + 1);
    }
    if (!votes.size) continue;
    const best = [...votes].sort((a, b) => b[1] - a[1])[0]![0];
    for (const k of comp) out.set(k, best);
  }
  for (const k of values.keys()) {
    const ns = nbrs(k);
    const counts = new Map<number, number>();
    for (const n of ns) counts.set(out.get(n)!, (counts.get(out.get(n)!) ?? 0) + 1);
    for (const [nv, c] of counts) if (nv !== out.get(k) && c >= 3) out.set(k, nv);
  }
  return out;
}

/**
 * Three masses instead of one step per plane: a finished pixel face holds
 * light, half-tone and shadow, with the darkest and lightest steps left for
 * accents. Faceted plane steps left in the final skin read as a mask.
 */
function massIndex(type: string, lambert: number, archetype: Archetype, steps: number): number {
  const at = (t: number) => clamp(Math.round(t * (steps - 1)), 0, steps - 1);
  const light = at(0.75), half = at(0.5), shadow = at(0.25);
  // Cel-shaded archetypes: one skin value and one shadow. Only the planes that
  // wrap around the head (side, temple, back), the neck and the underside of
  // the jaw take the shadow; the face itself stays one flat light, and the
  // decal eyes get no orbit.
  if (archetype === "anime" || archetype === "chibi") {
    if (type === "under" || type === "neck") return half;
    if ((type === "cheekSide" || type === "temple" || type === "back") && lambert < 0.2) return half;
    return light;
  }
  if (type === "socket" || type === "under" || type === "neck") return shadow;
  // Wrapped light: a plane still facing the viewer but turned from the light
  // is a half-tone, not a shadow — the shadow is the side of the head.
  const wrapped = (lambert + 0.35) / 1.35;
  if (wrapped >= 0.62) return light;
  if (wrapped >= 0.36 || type === "cheekFront" || type === "front" || type === "muzzle" || type === "chin") return half;
  return shadow;
}

/**
 * Per-pixel masses for modelled heads: each pixel starts with the wrapped
 * light of its plane, the field is box-blurred over `radius` px inside the
 * head, then cut into light / half-tone / shadow. Cavities (orbit, underside
 * of the jaw, neck) stay in the shadow whatever the blur says.
 */
function smoothMasses(
  pixelInstance: Map<number, string>,
  acc: Map<string, { type: string; n: Vector3 }>,
  lightVec: Vector3,
  steps: number,
  radius: number,
  key: (x: number, y: number) => number,
  unkey: (k: number) => Point,
): Map<number, number> {
  const at = (t: number) => clamp(Math.round(t * (steps - 1)), 0, steps - 1);
  const light = at(0.75), half = at(0.5), shadow = at(0.25);
  const lit = new Map<number, number>();
  for (const [k, name] of pixelInstance) {
    const a = acc.get(name)!;
    lit.set(k, (Math.max(0, dot(norm(a.n), lightVec)) + 0.35) / 1.35);
  }
  const blur = (src: Map<number, number>, dx: number, dy: number) => {
    const out = new Map<number, number>();
    for (const k of src.keys()) {
      const [x, y] = unkey(k);
      let sum = 0, n = 0;
      for (let i = -radius; i <= radius; i++) {
        const v = src.get(key(x + i * dx, y + i * dy));
        if (v !== undefined) { sum += v; n++; }
      }
      out.set(k, sum / n);
    }
    return out;
  };
  const smooth = blur(blur(lit, 1, 0), 0, 1);
  const out = new Map<number, number>();
  for (const [k, name] of pixelInstance) {
    const type = acc.get(name)!.type;
    if (type === "socket" || type === "under" || type === "neck") { out.set(k, shadow); continue; }
    const v = smooth.get(k)!;
    const faceType = type === "front" || type === "cheekFront" || type === "muzzle" || type === "chin";
    out.set(k, v >= 0.55 ? light : v >= 0.4 || faceType ? half : shadow);
  }
  return out;
}

/** Outline plus interior of a closed pixel polygon (even-odd scanline fill). */
function fillPolygon(outline: readonly Point[]): Point[] {
  const ring = dedupe(outline);
  if (ring.length < 3) return ring;
  const out: Point[] = [...ring];
  const ys = ring.map((p) => p[1]);
  for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
    const xs: number[] = [];
    for (let i = 0; i < ring.length; i++) {
      const [x0, y0] = ring[i]!;
      const [x1, y1] = ring[(i + 1) % ring.length]!;
      if ((y0 <= y && y < y1) || (y1 <= y && y < y0)) xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.ceil(xs[i]!); x <= Math.floor(xs[i + 1]!); x++) out.push([x, y]);
    }
  }
  return dedupe(out);
}

function dedupe(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}

/** Moore-neighbour trace of the outer contour of a mask (ordered, clockwise). */
function traceContour(has: (x: number, y: number) => boolean, box: { x0: number; y0: number; x1: number; y1: number }): Point[] {
  let start: Point | null = null;
  outer: for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      if (has(x, y)) { start = [x, y]; break outer; }
    }
  }
  if (!start) return [];
  const dirs: Point[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const contour: Point[] = [start];
  let cur: Point = start;
  let back = 4; // we entered start moving right, so "west" is behind us
  for (let guard = 0; guard < 100000; guard++) {
    let found = false;
    for (let k = 1; k <= 8; k++) {
      const d = (back + k) % 8;
      const nx = cur[0] + dirs[d]![0], ny = cur[1] + dirs[d]![1];
      if (has(nx, ny)) {
        cur = [nx, ny];
        back = (d + 4) % 8;
        found = true;
        break;
      }
    }
    if (!found || (cur[0] === start[0] && cur[1] === start[1])) break;
    contour.push(cur);
  }
  return contour;
}

// ---------------------------------------------------------------------------
// The armature
// ---------------------------------------------------------------------------

export interface ArmatureResult {
  armature: Armature;
  raster: RasterLayers;
}

export function buildHeadArmature(input: ArmatureInput): ArmatureResult {
  const rect = input.rect;
  if (rect.height < 28) {
    throw new ArmatureError("too_small", `too_small: a ${rect.height}-px head is pixel placement, not construction — use the tables and templates in rules://32-heads-and-faces.`);
  }
  const level = headPlaneLevel(rect.height);
  const archetype = input.archetype ?? "adventure";
  const orientation: Orientation = {
    yaw: clamp(input.yaw ?? 0, -90, 90),
    pitch: clamp(input.pitch ?? 0, -45, 45),
    roll: clamp(input.roll ?? 0, -30, 30),
  };
  const withHair = input.hair !== false;
  const withNeck = input.neck !== false;
  const model = buildModel(archetype, input.sliders ?? {}, withNeck);

  // Orientation per point; the neck untwists toward the body.
  const orient = (p: Vector3, neckT = 0): Vector3 =>
    neckT === 0 ? orientVector(p, orientation) : orientVector(p, {
      yaw: orientation.yaw * (1 - neckT), pitch: orientation.pitch * (1 - neckT), roll: orientation.roll * (1 - neckT),
    });

  // --- fit: head (cranium, face, ears) plus the hair shell, never the neck.
  const headTris = model.triangles.filter((t) => t.type !== "neck");
  const shellUnits0 = 0; // replaced after the first fit
  const fit = (shellUnits: number) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const take = (p: Vector3) => {
      const q = orient(p);
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    };
    for (const t of headTris) { take(t.a); take(t.b); take(t.c); }
    if (shellUnits > 0) {
      const { center, radii } = model.cranium;
      for (let i = 0; i <= 24; i++) for (let j = 0; j < 48; j++) {
        const th = (Math.PI * i) / 24, ph = (2 * Math.PI * j) / 48;
        take(v(center.x + (radii.x + shellUnits) * Math.sin(th) * Math.sin(ph), center.y - (radii.y + shellUnits) * Math.cos(th), center.z + (radii.z + shellUnits) * Math.sin(th) * Math.cos(ph)));
      }
    }
    const scale = Math.min(rect.width / (x1 - x0), rect.height / (y1 - y0));
    const ox = rect.x + rect.width / 2 - ((x0 + x1) / 2) * scale;
    const oy = rect.y + rect.height / 2 - ((y0 + y1) / 2) * scale;
    return { scale, ox, oy };
  };
  let { scale, ox, oy } = fit(shellUnits0);
  const shellPx = withHair ? clamp(Math.round(rect.height / 32), 1, 3) : 0;
  let shellUnits = 0;
  if (withHair) {
    shellUnits = shellPx / scale;
    ({ scale, ox, oy } = fit(shellUnits));
    shellUnits = shellPx / scale;
  }

  const screen = (p: Vector3, neckT = 0): { x: number; y: number; z: number } => {
    const q = orient(p, neckT);
    return { x: ox + q.x * scale, y: oy + q.y * scale, z: q.z };
  };
  const pix = (p: Vector3, neckT = 0): Point => {
    const s = screen(p, neckT);
    return [Math.floor(s.x), Math.floor(s.y)];
  };

  // --- z-buffer rasterisation
  const zbuf = new Map<number, { z: number; tri: number }>();
  const key = (x: number, y: number) => (y + 4096) * 16384 + (x + 4096);
  const unkey = (k: number): Point => [(k % 16384) - 4096, Math.floor(k / 16384) - 4096];
  const raster = (a: { x: number; y: number; z: number }, b: typeof a, c: typeof a, onPixel: (x: number, y: number, z: number) => void) => {
    const minX = Math.floor(Math.min(a.x, b.x, c.x)), maxX = Math.ceil(Math.max(a.x, b.x, c.x));
    const minY = Math.floor(Math.min(a.y, b.y, c.y)), maxY = Math.ceil(Math.max(a.y, b.y, c.y));
    const d = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(d) < 1e-9) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w1 = ((b.y - c.y) * (px - c.x) + (c.x - b.x) * (py - c.y)) / d;
        const w2 = ((c.y - a.y) * (px - c.x) + (a.x - c.x) * (py - c.y)) / d;
        const w3 = 1 - w1 - w2;
        if (w1 < -1e-7 || w2 < -1e-7 || w3 < -1e-7) continue;
        onPixel(x, y, w1 * a.z + w2 * b.z + w3 * c.z);
      }
    }
  };
  const tris = model.triangles;
  tris.forEach((t, i) => {
    const nt = t.neckT ?? 0;
    raster(screen(t.a, nt), screen(t.b, nt), screen(t.c, nt), (x, y, z) => {
      const k = key(x, y);
      const cur = zbuf.get(k);
      if (!cur || z > cur.z) zbuf.set(k, { z, tri: i });
    });
  });

  // --- plane instances
  const instanceOf = (t: Triangle) => {
    const merged = mergedPlane(t.type, level);
    const split = SPLIT_BY_SIDE.has(merged) || SPLIT_BY_SIDE.has(t.type);
    const side: ArmaturePlane["side"] = split ? t.lr : "center";
    return { name: side === "center" ? merged : `${merged}-${side}`, merged, side };
  };
  interface Acc { name: string; type: string; side: ArmaturePlane["side"]; n: Vector3; area: number; sx: number; sy: number; x0: number; y0: number; x1: number; y1: number }
  const acc = new Map<string, Acc>();
  const pixelInstance = new Map<number, string>();
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const [k, { tri }] of zbuf) {
    const t = tris[tri]!;
    const inst = instanceOf(t);
    const [x, y] = unkey(k);
    pixelInstance.set(k, inst.name);
    bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y);
    let a = acc.get(inst.name);
    if (!a) {
      a = { name: inst.name, type: inst.merged, side: inst.side, n: v(0, 0, 0), area: 0, sx: 0, sy: 0, x0: x, y0: y, x1: x, y1: y };
      acc.set(inst.name, a);
    }
    a.n = add(a.n, orient(t.normal, t.neckT ?? 0));
    a.area++; a.sx += x; a.sy += y;
    a.x0 = Math.min(a.x0, x); a.y0 = Math.min(a.y0, y); a.x1 = Math.max(a.x1, x); a.y1 = Math.max(a.y1, y);
  }

  const lightVec = norm(typeof input.light === "object" ? input.light : LIGHTS[input.light ?? "upper-left"]);
  const ramp = input.ramp ?? [];
  const steps = Math.max(2, ramp.length || 5);
  const ambient = 0.22;
  const planes: ArmaturePlane[] = [];
  const indexByInstance = new Map<string, number>();
  // Raw lit values, then stretched over the ramp: a head facing the light
  // would otherwise push every front plane to the top step and read flat.
  const raw = new Map<string, number>();
  for (const a of acc.values()) {
    const lambert = Math.max(0, dot(norm(a.n), lightVec));
    raw.set(a.name, (ambient + (1 - ambient) * lambert) * (OCCLUSION[a.type] ?? 1) * (UNDER_HAIR[a.type] ?? 1));
  }
  const rawValues = [...raw.values()];
  const vMin = Math.min(...rawValues), vMax = Math.max(...rawValues);
  for (const a of acc.values()) {
    const value = raw.get(a.name)!;
    const stretched = vMax - vMin > 1e-6 ? (value - vMin) / (vMax - vMin) : value;
    // Lit planes share the upper steps; the darkest step is kept for the
    // occluded planes (orbit, underside of the jaw), which read as cavities.
    const occluded = OCCLUSION[a.type] !== undefined && a.type !== "ear";
    const floor = occluded ? 0 : 0.3;
    const rampIndex = input.values === "masses"
      ? massIndex(a.type, Math.max(0, dot(norm(a.n), lightVec)), archetype, steps)
      : clamp(Math.round((floor + (1 - floor) * stretched) * (steps - 1)), 0, steps - 1);
    indexByInstance.set(a.name, rampIndex);
    planes.push({
      name: a.name, type: a.type, side: a.side, area: a.area,
      bounds: { x: a.x0, y: a.y0, width: a.x1 - a.x0 + 1, height: a.y1 - a.y0 + 1 },
      centroid: [Math.round(a.sx / a.area), Math.round(a.sy / a.area)],
      value: Math.round(value * 1000) / 1000,
      rampIndex,
      ...(ramp.length ? { color: ramp[rampIndex] } : {}),
    });
  }
  planes.sort((p, q) => q.area - p.area);

  // --- visibility against the z-buffer
  const visible = (p: Vector3, tolerance = 0.03): boolean => {
    const s = screen(p);
    const hit = zbuf.get(key(Math.floor(s.x), Math.floor(s.y)));
    return !hit || s.z >= hit.z - tolerance;
  };
  const curve = (pts: Vector3[], tolerance?: number): Point[] =>
    dedupe(pts.filter((p) => visible(p, tolerance)).map((p) => pix(p)));
  const skipNeckEars = (t: Triangle) => t.type === "neck" || t.type === "ear";
  const across = (y: number, half: number, n = 41): Vector3[] => {
    const out: Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const x = -half + (2 * half * i) / n;
      const z = surfaceZ(tris, x, y, skipNeckEars);
      if (z !== null) out.push(v(x, y, z + 0.004));
    }
    return out;
  };
  const surfacePoint = (x: number, y: number): Vector3 | null => {
    const z = surfaceZ(tris, x, y, skipNeckEars);
    return z === null ? null : v(x, y, z + 0.004);
  };

  const fw = (y: number) => model.faceWidthAt(y);
  const axisPts: Vector3[] = [];
  for (let i = 0; i <= 60; i++) {
    const y = lerp(model.y.top + 0.02, model.y.chin, i / 60);
    const p = surfacePoint(0, y);
    if (p) axisPts.push(p);
  }
  const noseBase = surfacePoint(0, model.y.noseBase);
  const chinPt = surfacePoint(0, model.y.chin - 0.004);

  // Hairline wraps from temple to temple over the forehead.
  const { center: cc, radii: cr } = model.cranium;
  const hairlinePts: Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const az = lerp(-100, 100, i / 40) * (Math.PI / 180);
    const y = lerp(model.y.hairline, model.y.brow + 0.02, (Math.abs(az) / (100 * Math.PI / 180)) ** 2);
    const k = Math.sqrt(Math.max(0, 1 - ((y - cc.y) / cr.y) ** 2));
    hairlinePts.push(v(cc.x + cr.x * k * Math.sin(az) * 1.01, y, cc.z + cr.z * k * Math.cos(az) * 1.01));
  }

  // --- eyes
  const eyes: ArmatureEye[] = [];
  const props = model.props;
  for (const side of ["left", "right"] as const) {
    const c = model.eyeCenters[side];
    const sgn = side === "right" ? 1 : -1;
    let upper: Vector3[] = [], lower: Vector3[] = [], kind: ArmatureEye["kind"];
    if (props.eye.kind === "sphere") {
      kind = "sphere";
      // Below ~72 px a true-to-life lid opening is 5×4 px and reads as a
      // sleepy slit; pixel portraits open the eye up to 1.4× instead (48 px →
      // about 7×5, as rules://38-portraits asks). The ball stays in place.
      const r = props.eye.radius * clamp(72 / rect.height, 1, 1.4);
      const lid = (phiDeg: number, vDeg: number): Vector3 => {
        const phi = (phiDeg * Math.PI) / 180, vv = (vDeg * Math.PI) / 180;
        // Slight outward rotation: eyes look forward but the socket faces a little sideways.
        return add(c, v(r * Math.sin(phi) * Math.cos(vv), r * Math.sin(vv), r * Math.cos(phi) * Math.cos(vv)));
      };
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const phi = lerp(-58, 58, t);
        const shape = Math.cos(((phi * sgn + 8) / 66) * (Math.PI / 2));
        upper.push(lid(phi, -32 * Math.max(0, shape)));
        lower.push(lid(phi, 22 * Math.max(0, shape)));
      }
    } else {
      kind = "decal";
      const w = props.eye.width / 2, h = props.eye.height / 2;
      for (let i = 0; i <= 16; i++) {
        const t = Math.PI + (Math.PI * i) / 16; // top arc, left to right
        const x = c.x + w * Math.cos(t), y = c.y + h * Math.sin(t) * (1 + 0.15 * Math.cos(t) * sgn);
        const p = surfacePoint(x, y);
        if (p) upper.push(p);
        const tb = Math.PI - (Math.PI * i) / 16;
        const xb = c.x + w * Math.cos(tb), yb = c.y + h * 0.85 * Math.sin(tb);
        const pb = surfacePoint(xb, yb);
        if (pb) lower.push(pb);
      }
      lower = lower.reverse();
      const p0 = surfacePoint(c.x, c.y);
      if (p0) c.z = p0.z;
    }
    const browPts: Vector3[] = [];
    const halfW = (props.eye.kind === "sphere" ? props.eye.radius * 1.5 : props.eye.width * 0.65);
    for (let i = 0; i <= 12; i++) {
      const x = c.x + lerp(-halfW, halfW, i / 12);
      const arch = 1 - ((i / 12) * 2 - 1) ** 2;
      // Keep one skin row between brow and upper lid at small sizes: a brow
      // resting on the lid reads as a heavy, half-closed eye.
      const lift = props.eye.kind === "sphere" && rect.height < 72 ? 1.2 / rect.height : 0;
      const y = model.y.brow - 0.012 * arch - lift - (props.eye.kind === "decal" ? props.eye.height * 0.35 : 0);
      const p = surfacePoint(x, y);
      if (p) browPts.push(p);
    }
    const all = [...upper, ...lower];
    const visCount = all.filter((p) => visible(p, 0.04)).length;
    const centerScreen = pix(c);
    eyes.push({
      side, near: false, kind,
      center: centerScreen,
      footprint: fillPolygon([...upper, ...[...lower].reverse()].filter((p) => visible(p, 0.04)).map((p) => pix(p))),
      upperLid: curve(upper, 0.04),
      lowerLid: curve(lower, 0.04),
      browOverhang: curve(browPts),
      visible: all.length > 0 && visCount / all.length > 0.3,
    });
  }
  // The near eye is the one turned toward the viewer.
  const depthOf = (side: "left" | "right") => orient(model.eyeCenters[side]).z;
  const nearSide = depthOf("left") > depthOf("right") ? "left" : "right";
  for (const e of eyes) e.near = Math.abs(orientation.yaw) < 1 ? true : e.side === nearSide;

  // --- ears
  const ears = (["left", "right"] as const).map((side) => {
    const ring = model.ears[side];
    const vis = ring.filter((p) => visible(p, 0.02)).length;
    return { side, near: side === nearSide || Math.abs(orientation.yaw) < 1, polygon: dedupe(ring.map((p) => pix(p))), visible: vis >= 2 };
  });

  // --- landmark curves
  const halfFace = (y: number, frac: number) => CRANIUM_RADII.x * fw(y) * frac;
  const brow = curve(across(model.y.brow, halfFace(model.y.brow, 0.72)));
  const eyeLine = curve(across(model.y.eye, halfFace(model.y.eye, 0.86)));
  const mouthHalf = model.points.Mc!.x;
  const mouth = curve(across(model.y.mouth, mouthHalf, 16));

  // --- silhouette, hair shell, neck masks
  const isHead = (x: number, y: number) => {
    const name = pixelInstance.get(key(x, y));
    return name !== undefined && !name.startsWith("neck");
  };
  const isNeck = (x: number, y: number) => pixelInstance.get(key(x, y))?.startsWith("neck") ?? false;
  const box = { x0: bx0 - 1, y0: by0 - 1, x1: bx1 + 1, y1: by1 + 1 };
  const silhouette = traceContour(isHead, box);
  const neck = withNeck ? traceContour(isNeck, box) : [];

  const shellMask = new Set<number>();
  let hairShell: Point[] = [];
  if (withHair) {
    const r = add(cr, v(shellUnits, shellUnits, shellUnits));
    const sl = 24, sn = 40;
    const sp = (i: number, j: number) => {
      const th = (Math.PI * i) / sl, ph = (2 * Math.PI * j) / sn;
      return screen(v(cc.x + r.x * Math.sin(th) * Math.sin(ph), cc.y - r.y * Math.cos(th), cc.z + r.z * Math.sin(th) * Math.cos(ph)));
    };
    // Hair covers the cranium above the hairline in front and down to the
    // nape behind; it never wraps the face.
    const covered = (i: number, j: number) => {
      const th = (Math.PI * (i + 0.5)) / sl, ph = (2 * Math.PI * (j + 0.5)) / sn;
      const y = cc.y - r.y * Math.cos(th);
      const nz = Math.sin(th) * Math.cos(ph);
      const limit = lerp(model.y.hairline, model.y.noseBase, smooth(0.3, -0.4, nz));
      return y <= limit;
    };
    for (let i = 0; i < sl; i++) for (let j = 0; j < sn; j++) {
      if (!covered(i, j)) continue;
      const a = sp(i, j), b = sp(i + 1, j), c2 = sp(i + 1, j + 1), d = sp(i, j + 1);
      raster(a, b, c2, (x, y) => shellMask.add(key(x, y)));
      raster(a, c2, d, (x, y) => shellMask.add(key(x, y)));
    }
    let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity;
    for (const k of shellMask) {
      const [x, y] = unkey(k);
      sx0 = Math.min(sx0, x); sy0 = Math.min(sy0, y); sx1 = Math.max(sx1, x); sy1 = Math.max(sy1, y);
    }
    hairShell = traceContour((x, y) => shellMask.has(key(x, y)), { x0: sx0 - 1, y0: sy0 - 1, x1: sx1 + 1, y1: sy1 + 1 });
  }

  // --- rhythm curves (JSON only, never drawn)
  const P = model.points;
  const m = model.mirror;
  const sideChain = (s: "left" | "right") => {
    const f = s === "right" ? (p: Vector3) => p : m;
    return [P.Br2!, P.Tm!, P.Cs!, P.Ja!, P.Jm!, P.Kc!].map(f);
  };
  const rhythm: Armature["rhythm"] = [
    { name: "brow-cheek-jaw-near", points: dedupe(sideChain(nearSide).map((p) => pix(p))) },
    { name: "brow-cheek-jaw-far", points: dedupe(sideChain(nearSide === "left" ? "right" : "left").map((p) => pix(p))) },
    { name: "forehead-nose-chin", points: dedupe([v(0, model.y.top + 0.05, cc.z + cr.z * 0.6), P.G!, P.Nr!, P.Nt!, P.Nbc!, P.Ml!, P.Kt!, P.Kb!].map((p) => pix(p))) },
    {
      name: "cranium-nape",
      points: dedupe([0, 30, 60, 90, 120, 150].map((deg) => {
        const th = (deg * Math.PI) / 180;
        return pix(v(0, cc.y - cr.y * Math.cos(th), cc.z - cr.z * Math.sin(th)));
      })),
    },
  ];

  // --- raster layers
  const structure: Point[] = [];
  for (const [k, name] of pixelInstance) {
    const [x, y] = unkey(k);
    const nb = [pixelInstance.get(key(x + 1, y)), pixelInstance.get(key(x - 1, y)), pixelInstance.get(key(x, y + 1)), pixelInstance.get(key(x, y - 1))];
    const isEdge = nb.some((n) => n === undefined);
    // Plane borders one pixel thick: only mark the right/bottom neighbour change.
    const isBorder = (pixelInstance.get(key(x + 1, y)) ?? name) !== name || (pixelInstance.get(key(x, y + 1)) ?? name) !== name;
    if (isEdge || isBorder) structure.push([x, y]);
  }
  if (withHair) {
    for (const p of hairShell) if (!pixelInstance.has(key(p[0], p[1]))) structure.push(p);
  }

  const features: Point[] = [];
  const addLine = (pts: Point[], closed = false) => { for (const p of polylinePixels(pts, closed)) features.push(p); };
  addLine(curve(axisPts));
  addLine(brow); addLine(eyeLine); addLine(mouth);
  if (withHair) addLine(curve(hairlinePts, 0.02));
  for (const e of eyes) {
    if (!e.visible) continue;
    addLine(e.upperLid); addLine(e.lowerLid); addLine(e.browOverhang);
  }
  for (const ear of ears) if (ear.visible) addLine(ear.polygon, true);
  if (noseBase) features.push(pix(noseBase));
  if (chinPt) features.push(pix(chinPt));

  const planePixels: RasterLayers["planes"] = [];
  // Modelled masses follow a smoothed light, not the plane edges: the
  // terminator then curves over the cheekbone instead of running down the
  // face as a straight seam.
  const modelled = input.values === "masses" && archetype !== "anime" && archetype !== "chibi";
  const perPixel = modelled
    ? smoothMasses(pixelInstance, acc, lightVec, steps, Math.max(1, Math.round(input.rect.height / 14)), key, unkey)
    : new Map([...pixelInstance].map(([k, name]) => [k, indexByInstance.get(name) ?? 0]));
  const cleaned = cleanPlaneValues(
    perPixel,
    Math.max(2, Math.round((input.rect.height * input.rect.height) / 400)),
    key,
  );
  for (const [k, rampIndex] of cleaned) {
    const [x, y] = unkey(k);
    planePixels.push({ x, y, rampIndex });
  }

  const uniq = (pts: Point[]) => {
    const seen = new Set<number>();
    return pts.filter(([x, y]) => { const k = key(x, y); if (seen.has(k)) return false; seen.add(k); return true; });
  };

  const armature: Armature = {
    level, archetype, orientation,
    scale: Math.round(scale * 1000) / 1000,
    silhouette,
    axis: curve(axisPts),
    landmarks: {
      brow, eyeLine,
      noseBase: noseBase && visible(noseBase) ? pix(noseBase) : null,
      mouth,
      chin: chinPt ? pix(chinPt) : null,
      hairline: withHair ? curve(hairlinePts, 0.02) : [],
    },
    eyes, planes, ears, hairShell, neck, rhythm,
  };
  return { armature, raster: { structure: uniq(structure), features: uniq(features), planes: planePixels } };
}
