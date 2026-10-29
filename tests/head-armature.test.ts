import { strict as assert } from "node:assert";
import { test } from "node:test";
import { headPlaneLevel, orientVector, projectPoint } from "../dist/lib/head-armature.js";

const neutral = { yaw: 0, pitch: 0, roll: 0 };
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

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
  const rect = { x: 10, y: 20, width: 21, height: 21 };
  assert.deepEqual(projectPoint({ x: 5, y: 0, z: 0 }, { ...neutral, roll: 90 }, rect), [20, 35]);
  assert.deepEqual(projectPoint({ x: 5, y: 0, z: 0 }, neutral, rect), [25, 30]);
});

test("combined orientation preserves vector length", () => {
  const point = { x: 2, y: -3, z: 4 };
  const rotated = orientVector(point, { yaw: 41, pitch: -17, roll: 23 });
  close(Math.hypot(rotated.x, rotated.y, rotated.z), Math.hypot(point.x, point.y, point.z));
});
