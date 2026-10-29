// Coordinates are head-local: x points right, y down and z toward the viewer.
export type Vector3 = { x: number; y: number; z: number };
export type Orientation = { yaw: number; pitch: number; roll: number };
export type HeadRect = { x: number; y: number; width: number; height: number };

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
export function headPlaneLevel(height: number): 3 | 6 | 9 {
  if (height < 28) throw new RangeError("too_small: utiliser les tables de pose de pixels rules://32");
  return height >= 80 ? 9 : height >= 40 ? 6 : 3;
}
