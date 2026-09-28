export function hitEllipsoid(bx, by, bz, bR, ex, ey, ez, rx, ry, rz) {
  const dx = (bx - ex) / (rx + bR);
  const dy = (by - ey) / (ry + bR);
  const dz = (bz - ez) / (rz + bR);
  return dx * dx + dy * dy + dz * dz <= 1;
}

export function zSwept(zPrev, zNow, rz, birdZ) {
  const lo = Math.min(zPrev, zNow) - rz;
  const hi = Math.max(zPrev, zNow) + rz;
  return birdZ >= lo && birdZ <= hi;
}

export function hitMoving(birdPos, birdR, ent) {
  return zSwept(ent.prevZ, ent.z, ent.rz, birdPos.z) &&
    hitEllipsoid(birdPos.x, birdPos.y, birdPos.z, birdR, ent.x, ent.y, ent.z, ent.rx, ent.ry, ent.rz);
}

export function distToSegment2D(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  let t = ab2 > 0 ? (apx * abx + apy * aby) / ab2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleWrap(a) {
  return a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
}

export function inCapsule2D(px, py, ax, ay, bx, by, radius) {
  return distToSegment2D(px, py, ax, ay, bx, by) <= radius;
}