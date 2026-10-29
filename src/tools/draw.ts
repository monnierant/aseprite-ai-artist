import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AsepriteLink } from "../bridge/link.js";
import { LiveError } from "../lib/protocol.js";
import { compileGrid, type CanvasSize } from "../lib/grid.js";
import { layoutText, loadFont, type TextAnchor } from "../lib/text.js";
import { ArmatureError, buildHeadArmature, type Point } from "../lib/head-armature.js";
import { deltaE, parseHex, rgbToLab } from "../lib/color.js";
import { fail, hexColor, ok, targetShape } from "./kit.js";

const textAnchor = z.enum([
  "top_left", "top", "top_right",
  "left", "center", "right",
  "bottom_left", "bottom", "bottom_right",
  "baseline_left", "baseline", "baseline_right",
]) satisfies z.ZodType<TextAnchor>;

const pointWithColor = z.object({
  x: z.number().int(),
  y: z.number().int(),
  color: hexColor.optional().describe("Per-pixel colour. Falls back to the op's `color`."),
});

const rectShape = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const sliderValue = z.number().min(-1).max(1).optional();

/**
 * Volumetric head construction (ADR-0013): ovoid cranium + wedge facial block
 * cut into simplified planes, oriented in 3D and rasterised here, then sent as
 * plain pixel passes on a guide layer and an optional plane layer.
 */
export const headArmatureOp = z.object({
  kind: z.literal("headArmature"),
  rect: rectShape.describe("Box of the head, hair shell included, neck excluded. Height ≥ 28 px; below that use the pixel-placement tables in rules://32-heads-and-faces."),
  archetype: z.enum(["realistic", "adventure", "anime", "chibi"]).default("adventure").describe("Proportion preset. anime/chibi get flat eye decals instead of eyeballs."),
  yaw: z.number().min(-90).max(90).default(0).describe("Degrees; positive turns the face toward the viewer's right."),
  pitch: z.number().min(-45).max(45).default(0).describe("Degrees; positive raises the face (seen from below)."),
  roll: z.number().min(-30).max(30).default(0).describe("Degrees; positive tilts clockwise."),
  sliders: z
    .object({ jawWidth: sliderValue, faceLength: sliderValue, browRidge: sliderValue, cheekbones: sliderValue, age: sliderValue, chin: sliderValue })
    .default({})
    .describe("Each −1…1, 0 is the archetype's default."),
  guideLayer: z.string().default("guide").describe("Layer for the construction guide; created when missing."),
  guideColor: hexColor.optional().describe("Silhouette, plane borders, hair shell, neck. Default: the palette colour furthest from the skin ramp."),
  featureColor: hexColor.optional().describe("Axis, brow/eye/mouth lines, eyelids, hairline, ears. Default: the next furthest palette colour."),
  hair: z.boolean().default(true).describe("Hair shell (cranium grown 1–3 px) and hairline."),
  neck: z.boolean().default(true).describe("Neck cylinder under the cranium."),
  planes: z
    .object({
      light: z
        .union([
          z.enum(["upper-left", "upper-right", "front", "left", "right", "top"]),
          z.object({ x: z.number(), y: z.number(), z: z.number() }),
        ])
        .default("upper-left")
        .describe("Light direction; a vector is head-local (x right, y down, z toward the viewer)."),
      ramp: z.array(hexColor).min(2).max(8).describe("Skin ramp, darkest to lightest."),
      layer: z.string().default("head-planes").describe("Layer for the block-in; created when missing, below the guide."),
    })
    .optional()
    .describe("When set, every visible plane is filled with the ramp colour of its lit value."),
});

/**
 * One batch tool instead of a dozen primitives.
 *
 * Two reasons. First, an agent drawing a 32×32 sprite one primitive per tool
 * call burns a round trip per stroke and fills its own context with acks.
 * Second — and this is the part that matters to the person watching — every op
 * in a batch lands inside a single Aseprite transaction, so one Ctrl+Z undoes
 * "the agent's last edit" rather than one of forty stray pixels.
 */
const drawOp = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("pixels"),
    color: hexColor.optional(),
    points: z.array(pointWithColor).min(1).max(20000),
  }),
  z.object({
    kind: z.literal("line"),
    color: hexColor,
    from: z.object({ x: z.number().int(), y: z.number().int() }),
    to: z.object({ x: z.number().int(), y: z.number().int() }),
    thickness: z.number().int().positive().max(64).default(1),
  }),
  z.object({
    kind: z.literal("polyline"),
    color: hexColor,
    points: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(2),
    closed: z.boolean().default(false),
    fill: hexColor.optional().describe("Fill colour; only meaningful when closed."),
  }),
  z.object({
    kind: z.literal("rect"),
    color: hexColor.describe("Outline colour."),
    rect: rectShape,
    fill: hexColor.optional().describe("Omit for an outline only."),
  }),
  z.object({
    kind: z.literal("ellipse"),
    color: hexColor,
    rect: rectShape.describe("Bounding box of the ellipse."),
    fill: hexColor.optional(),
  }),
  z.object({
    kind: z.literal("fill"),
    color: hexColor,
    at: z.object({ x: z.number().int(), y: z.number().int() }),
    tolerance: z.number().int().min(0).max(255).default(0).describe("Largest per-channel difference (0–255) still counted as the clicked colour. RGB sprites only; indexed and grayscale fills stay exact."),
    contiguous: z.boolean().default(true),
  }),
  z.object({
    kind: z.literal("replace"),
    from: hexColor,
    to: hexColor,
    region: rectShape.optional(),
  }),
  z.object({
    kind: z.literal("dither"),
    rect: rectShape,
    colorA: hexColor,
    colorB: hexColor,
    pattern: z.enum(["checker", "bayer2", "bayer4", "bayer8", "noise"]).default("bayer4"),
    ratio: z
      .number()
      .min(0)
      .max(1)
      .default(0.5)
      .describe("0 = all colorA, 1 = all colorB."),
  }),
  z.object({
    kind: z.literal("gradient"),
    rect: rectShape,
    from: hexColor,
    to: hexColor,
    direction: z.enum(["vertical", "horizontal", "diagonal", "radial"]).default("vertical"),
    steps: z
      .number()
      .int()
      .min(2)
      .max(64)
      .default(4)
      .describe("Banded, not smooth — a smooth gradient is not pixel art."),
    dither: z.boolean().default(false).describe("Dither the band boundaries."),
  }),
  z.object({
    kind: z.literal("clear"),
    region: rectShape.optional().describe("Omit to clear the whole cel."),
  }),
  z.object({
    kind: z.literal("blit"),
    from: rectShape,
    to: z.object({ x: z.number().int(), y: z.number().int() }),
    fromFrame: z.number().int().positive().optional(),
    fromLayer: z.string().optional(),
    flipHorizontal: z.boolean().default(false),
    flipVertical: z.boolean().default(false),
    skipTransparent: z.boolean().default(true),
  }),
  z.object({
    kind: z.literal("text"),
    text: z.string().min(1).describe("Multiline via \\n."),
    x: z.number().int(),
    y: z.number().int(),
    color: hexColor,
    font: z.string().default("pixel5x7").describe("Name in knowledge/fonts, without the .json extension."),
    anchor: textAnchor
      .default("top_left")
      .describe("Resolved against the glyph ink box, not the full advance box — outline and shadow never shift it."),
    letterSpacing: z.number().int().default(1),
    lineSpacing: z.number().int().default(1),
    bold: z.number().int().min(0).max(3).default(0).describe("Grid-cell passes grown rightward; 0 is regular weight."),
    outlineColor: hexColor.optional(),
    outlineDiagonals: z.boolean().default(true).describe("8-neighbour outline instead of 4."),
    shadowColor: hexColor.optional(),
    shadowOffset: z.object({ x: z.number().int(), y: z.number().int() }).default({ x: 1, y: 1 }),
    scale: z.number().int().min(1).max(8).default(1),
  }),
  z.object({
    kind: z.literal("grid"),
    x: z.number().int().default(0).describe("Sprite x of the grid's left column."),
    y: z.number().int().default(0).describe("Sprite y of the grid's top row."),
    legend: z
      .record(z.string(), hexColor.nullable())
      .describe("One character → colour; null is transparent. '.' is transparent unless you redefine it."),
    rows: z
      .array(z.string().min(1))
      .min(1)
      .describe("Top to bottom, one character per pixel, every row the same width. Up to the canvas size."),
    transparent: z
      .enum(["erase", "skip"])
      .default("erase")
      .describe(
        "Transparent cells: 'erase' clears them, so the grid's rectangle ends up exactly as written; 'skip' leaves the pixel underneath, to stamp a shape over existing art.",
      ),
  }),
  headArmatureOp,
]);

type HeadArmatureOp = z.infer<typeof headArmatureOp>;

/** Group pixels by colour into `pixels` ops, the primitive every Lua build already has. */
function pixelOps(points: readonly Point[], color: string): Record<string, unknown>[] {
  return points.length ? [{ kind: "pixels", color, points: points.map(([x, y]) => ({ x, y })) }] : [];
}

/** Palette entries ordered by distance from the skin ramp, furthest first. */
export function contrastingColors(palette: readonly string[], against: readonly string[]): string[] {
  const refs = (against.length ? against : ["#808080"]).map((h) => rgbToLab(parseHex(h)));
  return palette
    .filter((h) => (parseHex(h).a ?? 255) > 0)
    .map((h) => {
      const lab = rgbToLab(parseHex(h));
      return { h: h.slice(0, 7), d: Math.min(...refs.map((r) => deltaE(lab, r))) };
    })
    .sort((a, b) => b.d - a.d)
    .map((e) => e.h);
}

/** Build the armature and the draw.passes payload; pure, for tests. */
export function compileHeadArmature(op: HeadArmatureOp, palette: readonly string[] = []) {
  const { armature, raster } = buildHeadArmature({
    rect: op.rect, archetype: op.archetype, yaw: op.yaw, pitch: op.pitch, roll: op.roll,
    sliders: op.sliders, hair: op.hair, neck: op.neck,
    light: op.planes?.light, ramp: op.planes?.ramp,
  });
  const picks = contrastingColors(palette, op.planes?.ramp ?? []);
  const guideColor = op.guideColor ?? picks[0] ?? "#2a6fdb";
  const featureColor = op.featureColor ?? picks.find((c) => c.toLowerCase() !== guideColor.toLowerCase()) ?? "#ff3fa0";
  const passes: { layer: string; create: boolean; ops: Record<string, unknown>[] }[] = [];
  if (op.planes) {
    const ramp = op.planes.ramp;
    const byIndex = new Map<number, Point[]>();
    for (const p of raster.planes) {
      const list = byIndex.get(p.rampIndex) ?? [];
      list.push([p.x, p.y]);
      byIndex.set(p.rampIndex, list);
    }
    const ops = [...byIndex.entries()].sort((a, b) => a[0] - b[0]).flatMap(([i, pts]) => pixelOps(pts, ramp[i]!));
    passes.push({ layer: op.planes.layer, create: true, ops });
  }
  passes.push({
    layer: op.guideLayer,
    create: true,
    ops: [...pixelOps(raster.structure, guideColor), ...pixelOps(raster.features, featureColor)],
  });
  return { armature, passes, guideColor, featureColor };
}

async function drawHeadArmature(
  live: AsepriteLink,
  args: { sprite?: string; frame?: number; paletteLock: boolean; label?: string },
  op: HeadArmatureOp,
) {
  try {
    // Refuse before touching Aseprite: a too-small head is a rules question, not a connection one.
    if (op.rect.height < 28) {
      throw new ArmatureError("too_small", `too_small: a ${op.rect.height}-px head is pixel placement, not construction — use the tables and templates in rules://32-heads-and-faces.`);
    }
    const info = await live.call<{ width: number; height: number; palette?: string[] }>(
      "sprite.info",
      { sprite: args.sprite, includePalette: true },
      { expect: ["width", "height"] },
    );
    const { armature, passes, guideColor, featureColor } = compileHeadArmature(op, info.palette ?? []);
    const data = await live.call<Record<string, unknown>>(
      "draw.passes",
      { sprite: args.sprite, frame: args.frame, paletteLock: args.paletteLock, label: args.label ?? "head armature", passes },
      { expect: ["pixelsChanged", "passes"] },
    );
    data.opsApplied = 1;
    data.armature = armature as unknown as Record<string, unknown>;
    const eyes = armature.eyes.filter((e) => e.visible).map((e) => `${e.side}${e.near ? " (near)" : ""}`).join(", ");
    return ok(
      data,
      `Head armature, level ${armature.level} (${armature.planes.length} planes), ${op.archetype} yaw ${op.yaw}° pitch ${op.pitch}° roll ${op.roll}°: guide on '${op.guideLayer}' (${guideColor} structure, ${featureColor} features)` +
        (op.planes ? `, block-in on '${op.planes.layer}'` : "") +
        `. Visible eyes: ${eyes || "none"}. One Ctrl+Z undoes it. Paint the features on a new layer over the guide, then hide or delete the guide; look before moving on.`,
    );
  } catch (err) {
    if (err instanceof ArmatureError) return fail(new LiveError("invalid_args", err.message, { reason: err.code, see: "rules://32-heads-and-faces" }));
    return fail(err);
  }
}

export function registerDrawTools(server: McpServer, live: AsepriteLink): void {
  server.registerTool(
    "draw",
    {
      title: "Draw",
      description:
        "Apply a batch of drawing operations to one cel, as a single undoable action. Ops: pixels, line, polyline, rect, ellipse, fill, replace, dither, gradient, clear, blit, text, grid, headArmature. " +
        "Batch aggressively — a whole sprite in one call is normal and correct, and it means the user can undo your work with one Ctrl+Z. " +
        "Set `paletteLock` (default true) to snap every colour to the sprite's palette by perceptual distance before anything is written, so you cannot silently widen a curated palette. " +
        "Ops run in array order, so paint fills before outlines and outlines before highlights. " +
        "'text' is laid out here from a bitmap font and expanded to plain pixels before it reaches Aseprite — pass `measureOnly: true` with only 'text' ops to get each one's ink bounds without touching the sprite, e.g. to centre a label first. " +
        "'grid' paints a picture written as text — one character per pixel, a legend mapping characters to colours, the same shape `look op=\"ascii\"` returns — so you can see the whole silhouette while you write it instead of composing it from shapes. " +
        "It is the easiest way to draw a small sprite or a whole animation frame, and to edit one: read a region with `look op=\"ascii\" layer=… rulers=false`, change the rows, and send them back as a grid at the region's x/y. " +
        "'headArmature' (alone in its batch) builds a 3D head — ovoid cranium, wedge facial block, simplified planes, eyeballs in their sockets, hair shell, neck — turned by yaw/pitch/roll, draws its construction guide on `guideLayer` and, with `planes`, the lit plane block-in on `planes.layer`, in one undo step; it returns the landmarks (eyes, brow, nose base, mouth, chin, hairline, planes, rhythm curves) as JSON. Use it for every head of 32 px or more, then paint features over it — see rules://32-heads-and-faces.",
      inputSchema: {
        ...targetShape,
        ops: z.array(drawOp).min(1).max(512).describe("Applied in order, in one transaction."),
        paletteLock: z
          .boolean()
          .default(true)
          .describe(
            "Snap every colour to the nearest palette entry (CIELAB ΔE). Set false only when the user asked to introduce new colours.",
          ),
        selectionOnly: z
          .boolean()
          .default(false)
          .describe("Clip every op to the current selection."),
        createCel: z
          .boolean()
          .default(true)
          .describe("Create the cel if the target layer/frame has none."),
        label: z
          .string()
          .optional()
          .describe("Name shown in Aseprite's undo history. Describe the intent, e.g. 'shade helmet'."),
        measureOnly: z
          .boolean()
          .default(false)
          .describe(
            "Every op must be 'text'. Returns each one's ink bounds without calling Aseprite at all — use to size a panel or centre a label before actually drawing it.",
          ),
      },
      outputSchema: {
        sprite: z.string().optional(),
        layer: z.string().optional(),
        frame: z.number().int().optional(),
        opsApplied: z.number().int().optional(),
        pixelsChanged: z.number().int().optional(),
        colorsSnapped: z
          .array(z.object({ from: z.string(), to: z.string(), deltaE: z.number() }))
          .optional()
          .describe("Colours palette-lock moved, and how far. A large ΔE means the palette lacks that colour."),
        bounds: z
          .object({ x: z.number().int(), y: z.number().int(), width: z.number().int(), height: z.number().int() })
          .nullish()
          .describe("Bounding box actually touched."),
        measureOnly: z.boolean().optional(),
        textBounds: z
          .array(
            z.object({
              index: z.number().int().describe("Position of this op in the `ops` array."),
              bounds: z
                .object({ x: z.number().int(), y: z.number().int(), width: z.number().int(), height: z.number().int() })
                .nullish()
                .describe("Ink bounds of the laid-out text; null for text with no ink (e.g. all spaces)."),
            }),
          )
          .optional()
          .describe("Only present when `measureOnly` was set."),
        passes: z
          .array(z.object({ layer: z.string(), pixelsChanged: z.number().int().optional() }))
          .optional()
          .describe("headArmature only: one entry per layer written."),
        armature: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("headArmature only: level, silhouette, axis, landmarks, eyes, planes, ears, hairShell, neck, rhythm — integer canvas coordinates."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        if (args.measureOnly) {
          if (args.ops.some((op) => op.kind !== "text")) {
            return fail(
              new LiveError(
                "invalid_args",
                "measureOnly only accepts 'text' ops — nothing else has ink bounds to measure without drawing.",
              ),
            );
          }
          const textOps = args.ops as Extract<(typeof args.ops)[number], { kind: "text" }>[];
          const textBounds = textOps.map((op, index) => ({
            index,
            bounds: layoutText({ ...op, font: loadFont(op.font) }).inkBounds,
          }));
          return ok(
            { measureOnly: true, textBounds },
            `Measured ${textBounds.length} text op(s) without touching the sprite.`,
          );
        }

        const armatureOps = args.ops.filter((op) => op.kind === "headArmature");
        if (armatureOps.length > 0) {
          if (args.ops.length > 1) {
            return fail(new LiveError("invalid_args", "headArmature draws on its own layers, so it must be the only op in its batch. Send the other ops in a separate draw call."));
          }
          return await drawHeadArmature(live, args, armatureOps[0] as HeadArmatureOp);
        }

        // A grid is bounded by the canvas, which only Aseprite knows.
        const canvas: CanvasSize | undefined = args.ops.some((op) => op.kind === "grid")
          ? await live.call<CanvasSize>("sprite.info", { sprite: args.sprite, includePalette: false }, { expect: ["width", "height"] })
          : undefined;
        const expandedOps: Record<string, unknown>[] = [];
        for (const op of args.ops) {
          if (op.kind === "text") {
            const layout = layoutText({ ...op, font: loadFont(op.font) });
            if (layout.pixels.length > 0) expandedOps.push({ kind: "pixels", points: layout.pixels });
          } else if (op.kind === "grid") {
            expandedOps.push(...compileGrid(op, canvas!).ops);
          } else {
            expandedOps.push(op);
          }
        }

        const data = await live.call<Record<string, unknown>>(
          "draw.batch",
          { ...args, ops: expandedOps, measureOnly: undefined },
          { expect: ["opsApplied", "pixelsChanged", "layer", "frame"] },
        );
        const snapped = (data.colorsSnapped as { from: string; to: string; deltaE: number }[]) ?? [];
        const far = snapped.filter((s) => s.deltaE > 12);
        // Lua counts the expanded ops; the agent sent — and should hear back about — its own.
        data.opsApplied = args.ops.length;
        const summary = [
          `${args.ops.length} op(s), ${String(data.pixelsChanged ?? 0)} pixel(s) changed on '${String(data.layer)}' frame ${String(data.frame)}.`,
        ];
        if (far.length > 0) {
          summary.push(
            `Palette lock moved ${far.length} colour(s) a long way (ΔE > 12): ${far
              .slice(0, 5)
              .map((s) => `${s.from}→${s.to}`)
              .join(", ")}. Extend the palette if you meant those colours.`,
          );
        }
        summary.push("Now call look to see the result before moving on.");
        return ok(data, summary.join(" "));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "select",
    {
      title: "Selection",
      description:
        "Read or change the active selection. Ops: 'get', 'none', 'all', 'rect', 'ellipse', 'color' (select every pixel matching a colour), 'invert', 'grow', 'shrink'. A selection scopes draw, transform and recolor, which is usually cheaper and safer than masking by hand.",
      inputSchema: {
        op: z.enum(["get", "none", "all", "rect", "ellipse", "color", "invert", "grow", "shrink"]),
        ...targetShape,
        rect: rectShape.optional(),
        color: hexColor.optional().describe("For op 'color'."),
        tolerance: z.number().int().min(0).max(255).default(0).describe("Largest per-channel difference (0–255) still counted as the clicked colour. RGB sprites only; indexed and grayscale fills stay exact."),
        contiguous: z.boolean().default(false).describe("For op 'color'."),
        amount: z.number().int().positive().default(1).describe("Pixels, for grow/shrink."),
        mode: z
          .enum(["replace", "add", "subtract", "intersect"])
          .default("replace")
          .describe("How this selection combines with the existing one."),
      },
      outputSchema: {
        sprite: z.string(),
        empty: z.boolean(),
        bounds: z
          .object({ x: z.number().int(), y: z.number().int(), width: z.number().int(), height: z.number().int() })
          .nullish(),
        pixelCount: z.number().int(),
      },
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const data = await live.call<Record<string, unknown>>("select.apply", args);
        return ok(data);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "transform",
    {
      title: "Transform",
      description:
        "Move, flip, rotate or scale pixels on ONE cel — the target layer's image on the target frame. Ops: 'translate', 'flip', 'rotate', 'scale', 'outline', 'crop_to_content'. " +
        "To transform part of a cel, crop the region out with `draw` op 'blit' first; there is no selection-scoped transform. " +
        "Rotation is only clean at 90° multiples — arbitrary angles destroy pixel art, so anything else needs `allowLossy`. " +
        "Scaling is nearest-neighbour and integer-only for the same reason.",
      inputSchema: {
        op: z.enum(["translate", "flip", "rotate", "scale", "outline", "crop_to_content"]),
        ...targetShape,
        dx: z.number().int().default(0),
        dy: z.number().int().default(0),
        axis: z.enum(["horizontal", "vertical"]).optional().describe("For 'flip'."),
        angle: z.number().default(90).describe("Degrees, clockwise. For 'rotate'."),
        factor: z.number().int().min(1).max(16).default(2).describe("For 'scale'."),
        color: hexColor.optional().describe("Outline colour, for 'outline'."),
        side: z
          .enum(["outside", "inside"])
          .default("outside")
          .describe(
            "For 'outline'. 'outside' paints transparent pixels touching opaque ones, growing the cel by one pixel each way. 'inside' recolours opaque pixels that touch transparency instead, same size in and out.",
          ),
        diagonals: z
          .boolean()
          .default(false)
          .describe("For 'outline'. Treat diagonal neighbours as touching too (8-neighbour instead of 4)."),
        thickness: z.number().int().positive().max(8).default(1),
        allowLossy: z
          .boolean()
          .default(false)
          .describe("Permit a non-90° rotation or non-integer scale. Ask the user first."),
      },
      outputSchema: {
        sprite: z.string(),
        op: z.string(),
        pixelsChanged: z.number().int(),
        bounds: z
          .object({ x: z.number().int(), y: z.number().int(), width: z.number().int(), height: z.number().int() })
          .nullish(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => {
      try {
        if (args.op === "rotate" && args.angle % 90 !== 0 && !args.allowLossy) {
          return fail(
            new Error(
              `A ${args.angle}° rotation resamples every pixel and will destroy the sprite's crispness. Use a multiple of 90, or confirm with the user and pass allowLossy: true.`,
            ),
          );
        }
        const data = await live.call<Record<string, unknown>>("transform.apply", args);
        return ok(data);
      } catch (err) {
        return fail(err);
      }
    },
  );
}
