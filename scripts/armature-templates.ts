/**
 * Render headArmature block-ins as rulebook `grid` templates.
 *
 * The 32 and 48 px head templates in rules/32-heads-and-faces are not drawn by
 * hand: they are the armature's plane block-in, written as text, so the rules
 * and the op cannot drift apart. `tests/rules.test.ts` regenerates them and
 * compares; run `node --experimental-strip-types scripts/armature-templates.ts`
 * to print them after changing the model.
 */
import { buildHeadArmature, type Archetype } from "../dist/lib/head-armature.js";

export const TEMPLATE_RAMP = ["#3b2027", "#7a4040", "#b8705a", "#e0a07a", "#f6d2b0"] as const;
const GLYPHS = ["1", "2", "3", "4", "5"] as const;
const ROLES = ["skin-deep", "skin-shadow", "skin", "skin-light", "skin-highlight"] as const;
const EYE = { glyph: "E", role: "eye-socket", hex: "#2b1d2e" } as const;

export interface ArmatureTemplateSpec {
  name: string;
  height: number;
  archetype: Archetype;
  yaw: number;
  pitch: number;
}

/** The set rules/32 carries: front and 3/4 turned toward the upper-left light. */
export const ARMATURE_TEMPLATES: ArmatureTemplateSpec[] = [
  { name: "armature-32-front", height: 32, archetype: "adventure", yaw: 0, pitch: 0 },
  { name: "armature-32-tq", height: 32, archetype: "adventure", yaw: -35, pitch: 0 },
  { name: "armature-48-front", height: 48, archetype: "adventure", yaw: 0, pitch: 0 },
  { name: "armature-48-tq", height: 48, archetype: "adventure", yaw: -35, pitch: 0 },
  { name: "armature-48-tq-up", height: 48, archetype: "realistic", yaw: -30, pitch: 20 },
];

/** One template's fenced block, exactly as it appears in the rule file. */
export function armatureTemplate(spec: ArmatureTemplateSpec): string {
  const rect = { x: 0, y: 0, width: spec.height, height: spec.height };
  const { armature, raster } = buildHeadArmature({
    rect, archetype: spec.archetype, yaw: spec.yaw, pitch: spec.pitch, ramp: [...TEMPLATE_RAMP], hair: false, neck: false,
  });
  const cells = new Map<string, string>();
  for (const p of raster.planes) {
    if (p.y >= 0 && p.y < spec.height) cells.set(`${p.x},${p.y}`, GLYPHS[p.rampIndex]!);
  }
  for (const eye of armature.eyes) {
    if (!eye.visible) continue;
    for (const [x, y] of eye.footprint) if (cells.has(`${x},${y}`)) cells.set(`${x},${y}`, EYE.glyph);
  }
  const keys = [...cells.keys()].map((k) => k.split(",").map(Number) as [number, number]);
  const x0 = Math.min(...keys.map((k) => k[0])), x1 = Math.max(...keys.map((k) => k[0]));
  const y0 = Math.min(...keys.map((k) => k[1])), y1 = Math.max(...keys.map((k) => k[1]));
  const rows: string[] = [];
  for (let y = y0; y <= y1; y++) {
    let row = "";
    for (let x = x0; x <= x1; x++) row += cells.get(`${x},${y}`) ?? ".";
    rows.push(row);
  }
  const used = new Set(rows.join(""));
  const legend = GLYPHS.flatMap((g, i) => (used.has(g) ? [`${g} = ${ROLES[i]} ${TEMPLATE_RAMP[i]}`] : []));
  if (used.has(EYE.glyph)) legend.push(`${EYE.glyph} = ${EYE.role} ${EYE.hex}`);
  return ["```grid " + spec.name, ...legend, "---", ...rows, "```"].join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const spec of ARMATURE_TEMPLATES) console.log(armatureTemplate(spec) + "\n");
}
