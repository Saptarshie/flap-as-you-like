export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz) {
  let h = ix * 374761393 + iz * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

export function valueNoise2D(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz), b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  const u = smooth(fx), v = smooth(fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function shadowify(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return root;
}

export function terrainHeight(x, z) {
  const h1 = valueNoise2D(x * 0.012, z * 0.009);
  const h2 = valueNoise2D(x * 0.045 + 100, z * 0.035 - 40);
  const corridor = smoothstep(24, 62, Math.abs(x));
  let h = (h1 - 0.5) * 30 * corridor + (h2 - 0.5) * 7 * (0.35 + 0.65 * corridor);
  h += (h2 - 0.5) * 2.0;
  const riv = valueNoise2D(x * 0.02 - 50, z * 0.015 + 70);
  if (riv < 0.24) h -= (0.24 - riv) * 20;
  return h;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}