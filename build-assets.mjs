import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));

class FileReaderShim {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(r => { this.result = r; this.onload?.({ target: this }); this.onloadend?.({ target: this }); }); }
  readAsText(blob) { blob.text().then(r => { this.result = r; this.onload?.({ target: this }); this.onloadend?.({ target: this }); }); }
}
globalThis.FileReader = FileReaderShim;
const outDir = join(here, 'assets');
mkdirSync(outDir, { recursive: true });

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.75, metalness: 0.05, ...opts
});

function displaced(geo, rng, amp) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = rng();
    v.multiplyScalar(1 + (n - 0.5) * amp);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildBird() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat(0xffd23f, { roughness: 0.6 }));
  body.scale.set(0.85, 0.8, 1.1);
  g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12), mat(0xfff3d6, { roughness: 0.7 }));
  belly.position.set(0, -0.28, 0.35);
  belly.scale.set(0.72, 0.62, 0.9);
  g.add(belly);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), mat(0xffd23f, { roughness: 0.6 }));
  head.position.set(0, 0.5, -0.55);
  g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 10), mat(0xff8c42, { roughness: 0.5 }));
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.42, -1.2);
  g.add(beak);
  const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(0xffffff, { roughness: 0.3 }));
  eyeW.position.set(0.3, 0.62, -0.85);
  g.add(eyeW);
  const eyeWL = eyeW.clone(); eyeWL.position.x = -0.3; g.add(eyeWL);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), mat(0x222222, { roughness: 0.3 }));
  pupil.position.set(0.33, 0.64, -0.97);
  g.add(pupil);
  const pupilL = pupil.clone(); pupilL.position.x = -0.33; g.add(pupilL);
  const crestMat = mat(0xffb347, { roughness: 0.65 });
  for (const [x, y, z, rz] of [[0, 1.1, -0.45, 0], [0.14, 1.02, -0.28, 0.4], [-0.14, 1.02, -0.28, -0.4]]) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 6), crestMat);
    tuft.position.set(x, y, z);
    tuft.rotation.set(0.5, 0, rz);
    g.add(tuft);
  }
  const blushMat = mat(0xff8fa3, { roughness: 0.8 });
  for (const side of [1, -1]) {
    const blush = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 10), blushMat);
    blush.rotation.set(0, side * 0.4, Math.PI / 2);
    blush.position.set(side * 0.5, 0.36, -0.88);
    g.add(blush);
  }
  const footMat = mat(0xff8c42, { roughness: 0.6 });
  for (const side of [1, -1]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.16), footMat);
    foot.position.set(side * 0.22, -0.76, 0.2);
    g.add(foot);
  }
  const wingGeo = new THREE.SphereGeometry(0.8, 12, 8);
  wingGeo.scale(1.3, 0.16, 0.62);
  const wingMat = mat(0xffb347, { roughness: 0.65 });
  const mkWing = (side) => {
    const pivot = new THREE.Group();
    pivot.name = side < 0 ? 'WingL' : 'WingR';
    const w = new THREE.Mesh(wingGeo, wingMat);
    w.position.x = side * 0.95;
    pivot.position.set(side * 0.55, 0.18, 0.05);
    pivot.add(w);
    return pivot;
  };
  g.add(mkWing(1), mkWing(-1));
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 8), mat(0xffb347, { roughness: 0.65 }));
  tail.rotation.x = -Math.PI / 2.4;
  tail.position.set(0, 0.18, 1.15);
  g.add(tail);
  for (const side of [1, -1]) {
    const feather = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.55), crestMat);
    feather.position.set(side * 0.15, 0.2, 1.42);
    feather.rotation.set(-0.3, side * 0.3, side * 0.15);
    g.add(feather);
  }
  return g;
}

function buildPine(rng) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.1, 7), mat(0x8a5a33));
  trunk.position.y = 0.5;
  g.add(trunk);
  const barkRing = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.035, 6, 12), mat(0x5a3a20, { roughness: 0.9 }));
  barkRing.rotation.x = Math.PI / 2;
  barkRing.position.y = 0.55;
  g.add(barkRing);
  const root = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.35, 7), mat(0x6b4426, { flatShading: true }));
  root.position.y = 0.12;
  g.add(root);
  const tiers = [[1.15, 1.2, 1.0], [0.9, 1.1, 1.75], [0.65, 1.0, 2.45], [0.4, 0.85, 3.05]];
  const greens = [0x2e8b57, 0x3aa76d, 0x4fbf7f, 0x63d48d];
  const snowMat = mat(0xf4faff, { roughness: 0.85, flatShading: true });
  tiers.forEach(([r, h, y], i) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), mat(greens[i], { flatShading: true }));
    c.position.y = y;
    c.rotation.y = rng() * Math.PI;
    g.add(c);
    if (i >= 2) {
      const snow = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, h * 0.4, 9), snowMat);
      snow.position.y = y + h * 0.3;
      snow.rotation.y = c.rotation.y;
      g.add(snow);
    }
  });
  return g;
}

function buildRoundTree(rng) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.4, 7), mat(0x7d5a3c));
  trunk.position.y = 0.65;
  g.add(trunk);
  const fol = mat(0x58b368, { flatShading: true });
  const folDark = mat(0x3f9a55, { flatShading: true });
  const blobs = [[0, 2.1, 0, 1.05, 0], [0.65, 1.75, 0.25, 0.7, 1], [-0.6, 1.8, -0.2, 0.65, 0], [0.1, 2.75, -0.1, 0.62, 1], [0.55, 2.3, 0.35, 0.5, 0], [-0.45, 2.45, 0.3, 0.45, 1]];
  for (const [x, y, z, r, tone] of blobs) {
    const b = new THREE.Mesh(displaced(new THREE.DodecahedronGeometry(r, 0), rng, 0.22), tone ? folDark : fol);
    b.position.set(x, y, z);
    g.add(b);
  }
  const fruitMat = mat(0xff8c42, { roughness: 0.5 });
  for (const [x, y, z] of [[0.55, 1.9, 0.75], [-0.7, 1.6, 0.35], [0.15, 2.7, 0.5], [0.8, 2.2, 0.15]]) {
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), fruitMat);
    fruit.position.set(x, y, z);
    g.add(fruit);
  }
  const stubMat = mat(0x6b4a2e, { flatShading: true });
  for (const [x, y, z, rz] of [[0.3, 0.9, 0, -1.2], [-0.28, 1.1, 0.1, 1.2], [0.05, 1.2, -0.3, 2.6]]) {
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.35, 5), stubMat);
    stub.position.set(x, y, z);
    stub.rotation.z = rz;
    g.add(stub);
  }
  return g;
}

function buildRock(rng, tall) {
  const geo = displaced(new THREE.IcosahedronGeometry(0.9, 1), rng, 0.5);
  if (tall) geo.scale(0.7, 3.2, 0.7);
  const m = new THREE.Mesh(geo, mat(tall ? 0x9b8f86 : 0x8d8d93, { flatShading: true, roughness: 0.95 }));
  if (tall) m.position.y = 1.2;
  const g = new THREE.Group();
  g.add(m);
  const mossMat = mat(0x4f9e4a, { flatShading: true, roughness: 0.9 });
  const mossSpots = tall ? [[0.35, 2.7, 0.25], [-0.3, 1.9, -0.3], [0.28, 0.9, -0.25]] : [[0.3, 0.7, 0.35], [-0.35, 0.5, -0.2], [0.1, 0.85, -0.3]];
  for (const [x, y, z] of mossSpots) {
    const moss = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 5), mossMat);
    moss.scale.set(1.3, 0.45, 1.1);
    moss.position.set(x, y, z);
    g.add(moss);
  }
  const crackMat = mat(0x2e2a28, { roughness: 1, flatShading: true });
  const cracks = tall ? [[0.4, 1.6, 0.3, 0.5], [-0.35, 2.5, -0.2, -0.4]] : [[0.45, 0.35, 0.4, 0.3], [-0.3, 0.25, -0.5, -0.5]];
  for (const [x, y, z, rz] of cracks) {
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.07), crackMat);
    crack.position.set(x, y, z);
    crack.rotation.set(0.2, 0, rz);
    g.add(crack);
  }
  const pebMat = mat(0x7a756e, { flatShading: true, roughness: 0.95 });
  for (const [x, y, z, r] of [[0.85, 0.05, 0.35, 0.1], [-0.7, 0.04, -0.45, 0.08], [0.35, 0.06, -0.8, 0.07]]) {
    const peb = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), pebMat);
    peb.position.set(x, y, z);
    peb.rotation.set(x, z, y);
    g.add(peb);
  }
  if (tall) {
    const strataMat = mat(0xb0a49a, { flatShading: true, roughness: 0.9 });
    for (const [y, r] of [[1.5, 0.75], [2.6, 0.7]]) {
      const strata = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.12, 10), strataMat);
      strata.position.y = y;
      g.add(strata);
    }
    const vein = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.14, 0),
      new THREE.MeshStandardMaterial({ color: 0x8ef0ff, roughness: 0.15, metalness: 0.2, emissive: 0x3fd0e8, emissiveIntensity: 1, flatShading: true })
    );
    vein.position.set(0.3, 2.0, 0.28);
    vein.rotation.set(0.4, 0.7, 0.2);
    g.add(vein);
  }
  return g;
}

function buildBalloon(rng) {
  const g = new THREE.Group();
  const hue = rng();
  const envelope = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    mat(new THREE.Color().setHSL(hue, 0.75, 0.55), { roughness: 0.5 })
  );
  envelope.scale.set(1, 1.18, 1);
  envelope.position.y = 1.6;
  g.add(envelope);
  const stripe = new THREE.Mesh(
    new THREE.SphereGeometry(1.01, 16, 4, 0, Math.PI * 0.5),
    mat(0xfff3d6, { roughness: 0.5 })
  );
  stripe.scale.set(1, 1.18, 1);
  stripe.position.y = 1.6;
  stripe.rotation.y = 0.5;
  g.add(stripe);
  for (const [phi, hex] of [[2.3, 0xffffff], [4.3, 0xf0c04a]]) {
    const sliver = new THREE.Mesh(
      new THREE.SphereGeometry(1.015, 16, 3, phi, Math.PI * 0.38),
      mat(hex, { roughness: 0.5 })
    );
    sliver.scale.set(1, 1.18, 1);
    sliver.position.y = 1.6;
    g.add(sliver);
  }
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.2, 0.3, 10), mat(0xc9553d));
  skirt.position.y = 0.32;
  g.add(skirt);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.5), mat(0x8a5a33, { flatShading: true }));
  basket.position.y = -0.1;
  g.add(basket);
  for (const [x, z] of [[0.22, 0.22], [-0.22, 0.22], [0.22, -0.22], [-0.22, -0.22]]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 4), mat(0x5a4030));
    rope.position.set(x, 0.15, z);
    rope.rotation.z = x > 0 ? -0.12 : 0.12;
    g.add(rope);
  }
  const netMat = mat(0x5a4030, { roughness: 0.9 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.75, 5), netMat);
    cord.position.set(Math.cos(a) * 0.48, 0.72, Math.sin(a) * 0.48);
    cord.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    g.add(cord);
  }
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.85, 5), mat(0x6b4a2e));
  stick.position.set(0.24, 0.15, 0.24);
  g.add(stick);
  const pennant = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 3), mat(0xff4757, { flatShading: true }));
  pennant.scale.set(1, 1, 0.2);
  pennant.rotation.z = -Math.PI / 2;
  pennant.position.set(0.4, 0.5, 0.24);
  g.add(pennant);
  return g;
}

function buildCloud() {
  const parts = [];
  const blobs = [[0, 0, 0, 1], [0.9, -0.12, 0.15, 0.72], [-0.85, -0.1, -0.1, 0.66], [0.35, 0.32, -0.2, 0.6], [-0.3, 0.28, 0.25, 0.5], [0.15, -0.18, 0.35, 0.55]];
  for (const [x, y, z, r] of blobs) {
    const s = new THREE.SphereGeometry(r, 10, 8);
    s.translate(x, y, z);
    parts.push(s);
  }
  const geo = mergeGeometries(parts);
  geo.scale(1.6, 0.75, 1);
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, metalness: 0, transparent: true, opacity: 0.92, emissive: 0xdfe9f5, emissiveIntensity: 0.25
  }));
  g.add(m);
  const topMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.95, emissive: 0xf4f9ff, emissiveIntensity: 0.55
  });
  for (const [x, y, z, r] of [[-0.5, 0.45, 0, 0.42], [0.6, 0.5, -0.1, 0.38]]) {
    const t = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), topMat);
    t.position.set(x * 1.6, y * 0.75 + 0.1, z);
    g.add(t);
  }
  const wisp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshStandardMaterial({
    color: 0xf2f7fc, roughness: 1, metalness: 0, transparent: true, opacity: 0.6, emissive: 0xdfe9f5, emissiveIntensity: 0.3
  }));
  wisp.scale.set(1.6, 0.28, 0.6);
  wisp.position.set(-1.9, -0.15, 0.1);
  g.add(wisp);
  return g;
}

function buildRing() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.16, 12, 40),
    new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.25, metalness: 0.85, emissive: 0x8a6a00, emissiveIntensity: 0.4 })
  );
  g.add(ring);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22, 0),
    new THREE.MeshStandardMaterial({ color: 0x9be8ff, roughness: 0.1, metalness: 0.2, emissive: 0x3fb7e8, emissiveIntensity: 0.9 })
  );
  gem.position.y = 1.5;
  g.add(gem);
  const runeRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.03, 6, 28),
    new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.4, metalness: 0.8, emissive: 0x5a3f00, emissiveIntensity: 0.45 })
  );
  g.add(runeRing);
  const gemMat = new THREE.MeshStandardMaterial({ color: 0x9be8ff, roughness: 0.1, metalness: 0.2, emissive: 0x3fb7e8, emissiveIntensity: 1.05 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), gemMat);
    s.position.set(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0.14);
    s.rotation.set(a, a, 0);
    g.add(s);
  }
  return g;
}

function buildCoin() {
  const g = new THREE.Group();
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.09, 24),
    new THREE.MeshStandardMaterial({ color: 0xffc94d, roughness: 0.3, metalness: 0.8, emissive: 0x7a5a10, emissiveIntensity: 0.45 })
  );
  coin.rotation.x = Math.PI / 2;
  g.add(coin);
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.05, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xfff0b3, roughness: 0.35, metalness: 0.7 })
  );
  g.add(inner);
  const starMat = new THREE.MeshStandardMaterial({ color: 0xffe08a, roughness: 0.3, metalness: 0.75, emissive: 0x8a6a10, emissiveIntensity: 0.4 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.03), starMat);
    spoke.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0.055);
    spoke.rotation.z = a - Math.PI / 2;
    g.add(spoke);
  }
  const notchMat = new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.45, metalness: 0.7 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.1), notchMat);
    notch.position.set(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0);
    notch.rotation.z = a;
    g.add(notch);
  }
  return g;
}

function buildEnemy() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 14), mat(0xd93b3b, { roughness: 0.6 }));
  g.add(body);
  const white = mat(0xffffff, { roughness: 0.3 });
  const black = mat(0x1a1a1a, { roughness: 0.35 });
  const dark = mat(0x8f1f1f, { roughness: 0.7, flatShading: true });
  for (const side of [1, -1]) {
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), white);
    patch.scale.set(1, 1.05, 0.42);
    patch.position.set(side * 0.38, 0.3, -0.76);
    g.add(patch);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), black);
    pupil.position.set(side * 0.27, 0.27, -0.92);
    g.add(pupil);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.1), black);
    brow.position.set(side * 0.37, 0.57, -0.76);
    brow.rotation.z = side * 0.5;
    g.add(brow);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 10), mat(0xffb92e, { roughness: 0.45 }));
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.06, -1.06);
  g.add(beak);
  for (const [x, y, z, rz] of [[0, 0.95, -0.05, 0], [0.13, 0.88, 0.08, 0.35], [-0.13, 0.88, 0.08, -0.35]]) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.26, 6), dark);
    tuft.position.set(x, y, z);
    tuft.rotation.set(0.45, 0, rz);
    g.add(tuft);
  }
  for (const [x, y, z] of [[-0.3, -0.88, 0.1], [0.3, -0.88, 0.1], [0, -0.92, 0.28]]) {
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 5), mat(0xffb92e, { roughness: 0.5 }));
    claw.position.set(x, y, z);
    claw.rotation.x = Math.PI - 0.3;
    g.add(claw);
  }
  for (const i of [-1, 0, 1]) {
    const feather = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.06), dark);
    feather.position.set(i * 0.2, 0.12 - Math.abs(i) * 0.06, 0.96);
    feather.rotation.set(0.6, 0, i * 0.55);
    g.add(feather);
  }
  const wingGeo = new THREE.SphereGeometry(0.42, 10, 8);
  wingGeo.scale(1.25, 0.24, 0.6);
  const wingMat = mat(0xa62c2c, { roughness: 0.65 });
  const mkWing = (side) => {
    const pivot = new THREE.Group();
    pivot.name = side < 0 ? 'WingL' : 'WingR';
    const w = new THREE.Mesh(wingGeo, wingMat);
    w.position.x = side * 0.5;
    pivot.position.set(side * 0.7, 0.15, 0);
    pivot.rotation.z = side * -0.25;
    pivot.add(w);
    return pivot;
  };
  g.add(mkWing(1), mkWing(-1));
  return g;
}

function buildTornado() {
  const g = new THREE.Group();
  const funnelMat = new THREE.MeshStandardMaterial({
    color: 0xb9c7d6, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.35, side: THREE.DoubleSide
  });
  const levels = [0, 1.8, 3.6, 5.4, 7.2, 9];
  for (let i = 0; i < 5; i++) {
    const rB = 0.5 + (levels[i] / 9) * 2.7;
    const rT = 0.5 + (levels[i + 1] / 9) * 2.7;
    const h = levels[i + 1] - levels[i];
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, 12, 1, true), funnelMat);
    seg.position.set(Math.sin(i * 1.7) * 0.2, levels[i] + h / 2, Math.cos(i * 1.3) * 0.2);
    seg.rotation.y = i * 0.6;
    g.add(seg);
  }
  const ridgeMat = new THREE.MeshStandardMaterial({
    color: 0x9fb2c4, roughness: 0.8, metalness: 0, transparent: true, opacity: 0.55, side: THREE.DoubleSide
  });
  for (const [y, r] of [[1.8, 1.08], [3.6, 1.62], [5.4, 2.16], [7.2, 2.7]]) {
    const ridge = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 6, 22), ridgeMat);
    ridge.rotation.x = Math.PI / 2;
    ridge.position.set(Math.sin(y * 0.7) * 0.2, y, Math.cos(y * 0.5) * 0.2);
    g.add(ridge);
  }
  const cloud = new THREE.Mesh(
    new THREE.CylinderGeometry(3.6, 3.6, 0.5, 16),
    new THREE.MeshStandardMaterial({ color: 0x8a97a5, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.7 })
  );
  cloud.position.y = 9.5;
  g.add(cloud);
  const skirt = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 18),
    new THREE.MeshStandardMaterial({ color: 0xb0a18e, roughness: 1, metalness: 0, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.y = 0.04;
  g.add(skirt);
  const debrisMat = mat(0x7a7268, { flatShading: true, roughness: 0.95 });
  for (const [x, y, z, r] of [[0.9, 0.12, 0.3, 0.1], [-0.7, 0.08, -0.5, 0.08], [0.4, 0.06, -0.9, 0.07], [-0.3, 0.14, 0.8, 0.09]]) {
    const bit = new THREE.Mesh(new THREE.TetrahedronGeometry(r, 0), debrisMat);
    bit.position.set(x, y, z);
    bit.rotation.set(x * 2, z * 2, y * 3);
    g.add(bit);
  }
  return g;
}

function mkPotion(liquidHex) {
  const g = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xdfefff, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.4
  });
  const liquid = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 16, 12),
    new THREE.MeshStandardMaterial({ color: liquidHex, roughness: 0.35, metalness: 0.05, emissive: liquidHex, emissiveIntensity: 0.7 })
  );
  liquid.scale.set(1, 0.88, 1);
  liquid.position.y = -0.08;
  g.add(liquid);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 10), glassMat);
  neck.position.y = 0.28;
  g.add(neck);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.145, 0.022, 6, 18),
    mat(0xd4af37, { metalness: 0.85, roughness: 0.25 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.34;
  g.add(ring);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), glassMat);
  cap.scale.set(1, 0.85, 1);
  cap.position.y = 0.42;
  g.add(cap);
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.14, 8), mat(0x9a6a3f, { roughness: 0.85 }));
  cork.position.y = 0.62;
  g.add(cork);
  const labelBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.44, 0.055, 8, 22),
    mat(0xf3e2b8, { roughness: 0.85 })
  );
  labelBand.rotation.x = Math.PI / 2;
  labelBand.position.y = -0.12;
  g.add(labelBand);
  const shine = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.65, emissive: 0xffffff, emissiveIntensity: 0.4 })
  );
  shine.scale.set(0.35, 1.1, 0.2);
  shine.position.set(0.2, 0.44, -0.16);
  shine.rotation.set(0.3, -0.6, 0.2);
  g.add(shine);
  const liqCol = new THREE.Color(liquidHex);
  const surfCol = liqCol.clone().lerp(new THREE.Color(0xffffff), 0.35);
  const surface = new THREE.Mesh(
    new THREE.CircleGeometry(0.33, 18),
    new THREE.MeshStandardMaterial({ color: surfCol, roughness: 0.3, metalness: 0, emissive: surfCol, emissiveIntensity: 0.6, side: THREE.DoubleSide })
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0.18;
  g.add(surface);
  const bubCol = liqCol.clone().lerp(new THREE.Color(0xffffff), 0.55);
  const bubMat = new THREE.MeshStandardMaterial({ color: bubCol, roughness: 0.2, metalness: 0, emissive: bubCol, emissiveIntensity: 0.8 });
  for (const [x, y, z, r] of [[0.14, -0.05, 0.1, 0.04], [-0.12, 0.06, -0.06, 0.03], [0.02, 0.14, 0.08, 0.025]]) {
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), bubMat);
    bubble.position.set(x, y, z);
    g.add(bubble);
  }
  return g;
}

function buildPotionSpeed() {
  return mkPotion(0xff3355);
}

function buildPotionShield() {
  const g = mkPotion(0x33aaff);
  const plusMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.35 });
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.03), plusMat);
  h.position.set(0, -0.08, -0.46);
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.03), plusMat);
  v.position.set(0, -0.08, -0.46);
  g.add(h, v);
  return g;
}

function buildGem() {
  const g = new THREE.Group();
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55, 0),
    new THREE.MeshStandardMaterial({ color: 0xaa44ff, roughness: 0.15, metalness: 0.3, emissive: 0xaa44ff, emissiveIntensity: 0.8, flatShading: true })
  );
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.3, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1, emissive: 0xffffff, emissiveIntensity: 1.1 })
  );
  g.add(gem, core);
  const ridge = new THREE.Mesh(
    new THREE.TorusGeometry(0.52, 0.028, 6, 16),
    new THREE.MeshStandardMaterial({ color: 0xd8b3ff, roughness: 0.25, metalness: 0.2, emissive: 0xaa44ff, emissiveIntensity: 0.6 })
  );
  ridge.rotation.x = Math.PI / 2;
  g.add(ridge);
  const shardMat = new THREE.MeshStandardMaterial({ color: 0xcc77ff, roughness: 0.2, metalness: 0.25, emissive: 0xaa44ff, emissiveIntensity: 0.7, flatShading: true });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.09, 0), shardMat);
    shard.position.set(Math.cos(a) * 0.85, Math.sin(a * 2.3) * 0.25, Math.sin(a) * 0.85);
    shard.rotation.set(a, a * 1.4, a * 0.7);
    g.add(shard);
  }
  g.rotation.y = Math.PI / 4;
  return g;
}

function buildPortal() {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(2.6, 0.3, 8, 28),
    new THREE.MeshStandardMaterial({ color: 0x8d8d93, roughness: 0.8, metalness: 0.1, emissive: 0x44ffd0, emissiveIntensity: 0.9 })
  );
  g.add(rim);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(2.35, 28),
    new THREE.MeshStandardMaterial({
      color: 0x2bd8a8, roughness: 0.4, metalness: 0, transparent: true, opacity: 0.28,
      emissive: 0x2bd8a8, emissiveIntensity: 1.2, side: THREE.DoubleSide
    })
  );
  g.add(disc);
  const swirlMat = new THREE.MeshStandardMaterial({
    color: 0x9dffe8, roughness: 0.4, metalness: 0, transparent: true, opacity: 0.18,
    emissive: 0x2bd8a8, emissiveIntensity: 1.4, side: THREE.DoubleSide
  });
  const swirlA = new THREE.Mesh(new THREE.CircleGeometry(1.5, 22), swirlMat);
  swirlA.position.set(0.45, -0.3, 0.08);
  swirlA.rotation.z = 0.6;
  g.add(swirlA);
  const swirlB = new THREE.Mesh(new THREE.CircleGeometry(1.1, 18), swirlMat);
  swirlB.position.set(-0.55, 0.4, -0.08);
  swirlB.rotation.z = -0.9;
  g.add(swirlB);
  const glyphRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.15, 0.035, 6, 30),
    new THREE.MeshStandardMaterial({ color: 0x1a8a70, roughness: 0.5, metalness: 0.2, emissive: 0x44ffd0, emissiveIntensity: 0.8 })
  );
  g.add(glyphRing);
  const runeMat = new THREE.MeshStandardMaterial({ color: 0x7ffde0, roughness: 0.3, metalness: 0.1, emissive: 0x44ffd0, emissiveIntensity: 1.1 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const rune = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.03), runeMat);
    rune.position.set(Math.cos(a) * 2.15, Math.sin(a) * 2.15, 0.06);
    rune.rotation.z = a;
    g.add(rune);
  }
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x7ffde0, roughness: 0.2, metalness: 0.1, emissive: 0x44ffd0, emissiveIntensity: 1 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), crystalMat);
    c.position.set(Math.cos(a) * 3.1, Math.sin(a) * 3.1, i % 2 ? 0.35 : -0.35);
    c.rotation.set(a, a * 0.7, 0);
    g.add(c);
  }
  return g;
}

function buildBossBird() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(2, 20, 14), mat(0xd93b3b, { roughness: 0.55 }));
  body.scale.set(1, 0.95, 1.05);
  g.add(body);
  const white = mat(0xffffff, { roughness: 0.3 });
  const black = mat(0x181818, { roughness: 0.35 });
  for (const side of [1, -1]) {
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), white);
    patch.scale.set(1, 1.05, 0.4);
    patch.position.set(side * 0.8, 0.6, -1.62);
    g.add(patch);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), black);
    pupil.position.set(side * 0.6, 0.52, -1.86);
    g.add(pupil);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.14), black);
    brow.position.set(side * 0.78, 1.12, -1.6);
    brow.rotation.z = side * 0.5;
    g.add(brow);
  }
  const scar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.42, 0.16), mat(0x2a1010, { roughness: 0.9 }));
  scar.position.set(1.0, 1.16, -1.62);
  scar.rotation.z = 0.5 + Math.PI / 2;
  g.add(scar);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.44, 1.0, 12), mat(0xffb92e, { roughness: 0.45 }));
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.12, -2.2);
  g.add(beak);
  for (const [x, r, h, z] of [[-0.55, 0.26, 0.85, -0.55], [0, 0.32, 1.05, -0.55], [0.55, 0.26, 0.85, -0.55], [0, 0.16, 0.5, 0.1]]) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), mat(0x8f1f1f, { roughness: 0.7, flatShading: true }));
    spike.position.set(x, 2.0 + h * 0.28, z);
    spike.rotation.set(z < 0 ? 0.55 : 0.15, 0, -x * 0.5);
    g.add(spike);
  }
  const scaleMat = mat(0x8f1f1f, { roughness: 0.65, flatShading: true });
  for (const [x, y, z, rz] of [[1.3, 0.9, 0.1, -0.4], [-1.3, 0.9, 0.1, 0.4], [0, 1.35, 0.5, 0]]) {
    const scale = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), scaleMat);
    scale.scale.set(1, 0.3, 0.85);
    scale.position.set(x, y, z);
    scale.rotation.set(0.3, 0, rz);
    g.add(scale);
  }
  for (const [x, y, z] of [[-0.55, -1.85, 0.4], [0.55, -1.85, 0.4], [0, -1.9, 0.65]]) {
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 5), mat(0xffb92e, { roughness: 0.5 }));
    claw.position.set(x, y, z);
    claw.rotation.x = Math.PI - 0.3;
    g.add(claw);
  }
  for (const i of [-1, 0, 1]) {
    const jit = [0.05, -0.04, 0.03][i + 1];
    const feather = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.2, 0.14), mat(0x1a1a1a, { roughness: 0.6, flatShading: true }));
    feather.position.set(i * 0.42, 0.1 - Math.abs(i) * 0.12, 1.95);
    feather.rotation.set(0.5 + jit, jit * 0.6, i * 0.4 + jit);
    g.add(feather);
  }
  const wingGeo = new THREE.SphereGeometry(1.0, 12, 9);
  wingGeo.scale(1.9, 0.26, 0.95);
  const wingMat = mat(0xa62c2c, { roughness: 0.65 });
  const mkWing = (side) => {
    const pivot = new THREE.Group();
    pivot.name = side < 0 ? 'WingL' : 'WingR';
    const w = new THREE.Mesh(wingGeo, wingMat);
    w.position.x = side * 1.55;
    pivot.position.set(side * 1.55, 0.6, 0.1);
    pivot.rotation.set(0, side * 0.55, side * 0.42);
    pivot.add(w);
    return pivot;
  };
  g.add(mkWing(1), mkWing(-1));
  return g;
}

function exportGLB(object, name) {
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(object, (buf) => {
      writeFileSync(join(outDir, name), Buffer.from(buf));
      console.log('wrote', name, (buf.byteLength / 1024).toFixed(1) + 'KB');
      resolve();
    }, (err) => reject(err), { binary: true });
  });
}

const rng = mulberry32(1337);
const jobs = [
  [buildBird(), 'bird.glb'],
  [buildPine(rng), 'treePine.glb'],
  [buildRoundTree(rng), 'treeRound.glb'],
  [buildRock(mulberry32(7), false), 'rockA.glb'],
  [buildRock(mulberry32(23), true), 'rockSpire.glb'],
  [buildBalloon(mulberry32(51)), 'balloon.glb'],
  [buildCloud(), 'cloud.glb'],
  [buildRing(), 'ring.glb'],
  [buildCoin(), 'coin.glb'],
  [buildEnemy(), 'enemy.glb'],
  [buildTornado(), 'tornado.glb'],
  [buildPotionSpeed(), 'potionSpeed.glb'],
  [buildPotionShield(), 'potionShield.glb'],
  [buildGem(), 'gem.glb'],
  [buildPortal(), 'portal.glb'],
  [buildBossBird(), 'bossBird.glb'],
];
for (const [obj, name] of jobs) await exportGLB(obj, name);
console.log('done');
