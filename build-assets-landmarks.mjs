import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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

function weld(geo) {
  geo.deleteAttribute('normal');
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  geo.clearGroups();
  return mergeVertices(geo, 1e-4);
}

const crystal = (intensity) => new THREE.MeshStandardMaterial({
  color: 0x7ffde0, roughness: 0.2, metalness: 0.1, emissive: 0x44ffd0, emissiveIntensity: intensity, flatShading: true
});

function buildMountain(rng) {
  const g = new THREE.Group();
  g.name = 'Mountain';
  const stone = mat(0x8d8d93, { flatShading: true, roughness: 0.95 });
  const stoneDark = mat(0x6f7683, { flatShading: true, roughness: 0.95 });
  const snow = mat(0xf4f8ff, { flatShading: true, roughness: 0.85 });
  const dark = mat(0x2b2b33, { flatShading: true, roughness: 0.9 });
  const base = new THREE.Mesh(displaced(weld(new THREE.CylinderGeometry(10.5, 12, 2.2, 10, 1)), rng, 0.24), stoneDark);
  base.position.y = 1;
  base.name = 'Base';
  g.add(base);
  const mkPeak = (name, r, h, x, z, cap) => {
    const geo = displaced(weld(new THREE.ConeGeometry(r, h, 8, 2)), rng, 0.15);
    geo.computeBoundingBox();
    const minY = geo.boundingBox.min.y;
    const topY = geo.boundingBox.max.y - minY;
    geo.translate(0, -minY, 0);
    const m = new THREE.Mesh(geo, stone);
    m.position.set(x, 1.4, z);
    m.rotation.y = rng() * Math.PI;
    m.name = name;
    g.add(m);
    if (cap) {
      const sh = topY * 0.2;
      const sc = new THREE.Mesh(new THREE.ConeGeometry(r * 0.2 + 0.15, sh, 8, 1), snow);
      sc.position.set(x, 1.4 + topY - sh * 0.38, z);
      sc.rotation.y = rng() * Math.PI;
      sc.name = name.replace('Peak', 'Snow');
      g.add(sc);
    }
  };
  mkPeak('Peak0', 6.4, 24, 0, 0.4, true);
  mkPeak('Peak1', 4.6, 15.5, -5.4, 2.6, true);
  mkPeak('Peak2', 4.1, 12, 5.2, -3.0, false);
  mkPeak('Peak3', 3.2, 8.5, 3.6, 4.8, false);
  mkPeak('Peak4', 2.9, 6.8, -4.2, -4.4, false);
  const facets = new THREE.Group();
  facets.name = 'Facets';
  for (const [x, y, z, s] of [[2.4, 4.2, 4.4, 1.35], [-3.6, 6.2, -1.6, 1.1], [5.0, 2.8, 1.4, 0.95], [-6.4, 2.2, -1.8, 1.05]]) {
    const f = new THREE.Mesh(displaced(new THREE.IcosahedronGeometry(s, 0), rng, 0.42), dark);
    f.position.set(x, y, z);
    f.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    facets.add(f);
  }
  g.add(facets);
  return g;
}

function buildArch(rng) {
  const g = new THREE.Group();
  g.name = 'Arch';
  const stone = mat(0x8d8d93, { flatShading: true, roughness: 0.95 });
  const stoneDark = mat(0x6f7683, { flatShading: true, roughness: 0.95 });
  const mossA = mat(0x4fbf7f, { flatShading: true, roughness: 0.9 });
  const mossB = mat(0x2e8b57, { flatShading: true, roughness: 0.9 });
  const crystalMat = crystal(1);
  const pillarL = new THREE.Mesh(displaced(weld(new THREE.BoxGeometry(5.6, 24, 5.8, 1, 3, 1)), rng, 0.07), stone);
  pillarL.position.set(-12, 12, 0);
  pillarL.name = 'PillarL';
  const pillarR = new THREE.Mesh(displaced(weld(new THREE.BoxGeometry(5.6, 24, 5.8, 1, 3, 1)), rng, 0.07), stone);
  pillarR.position.set(12, 12, 0);
  pillarR.name = 'PillarR';
  const lintel = new THREE.Mesh(displaced(weld(new THREE.BoxGeometry(31, 10, 6.2, 3, 1, 1)), rng, 0.08), stoneDark);
  lintel.position.set(0, 19, 0);
  lintel.name = 'Lintel';
  g.add(pillarL, pillarR, lintel);
  const moss = new THREE.Group();
  moss.name = 'Moss';
  const blobs = [[-12, 24.1, 0.3, 1.9, mossA], [-11.1, 23.9, -1.0, 1.4, mossB], [12, 24.2, -0.3, 1.8, mossA], [11.0, 23.9, 1.0, 1.3, mossB], [1.4, 24.0, 0.4, 2.1, mossA]];
  blobs.forEach(([x, y, z, r, m], i) => {
    const b = new THREE.Mesh(displaced(new THREE.DodecahedronGeometry(r, 0), rng, 0.28), m);
    b.position.set(x, y, z);
    b.scale.set(1.1, 0.5, 1.05);
    b.rotation.y = rng() * Math.PI;
    b.name = 'Moss' + i;
    moss.add(b);
  });
  g.add(moss);
  const crystals = new THREE.Group();
  crystals.name = 'Crystals';
  const embeds = [[-9.05, 6.3, 0.5, 0.42], [-9.05, 10.9, -0.6, 0.34], [9.05, 7.6, -0.45, 0.4], [9.05, 11.3, 0.55, 0.36]];
  embeds.forEach(([x, y, z, r], i) => {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), crystalMat);
    c.position.set(x, y, z);
    c.scale.set(1, 1.5, 1);
    c.rotation.set(rng() * 0.6, rng() * Math.PI, (x > 0 ? -1 : 1) * (0.5 + rng() * 0.4));
    c.name = 'Crystal' + i;
    crystals.add(c);
  });
  g.add(crystals);
  return g;
}

function buildTunnel(rng) {
  const g = new THREE.Group();
  g.name = 'Tunnel';
  const stone = mat(0x8d8d93, { flatShading: true, roughness: 0.95 });
  const stoneDark = mat(0x6f7683, { flatShading: true, roughness: 0.95 });
  const crystalMat = crystal(1.1);
  const shell = new THREE.Group();
  shell.name = 'Shell';
  let si = 0;
  for (let ring = 0; ring < 6; ring++) {
    const z = -11.7 + ring * 4.68;
    for (let j = 0; j < 10; j++) {
      const a = (j / 10) * Math.PI * 2 + (ring % 2) * (Math.PI / 10);
      const slab = new THREE.Mesh(displaced(weld(new THREE.BoxGeometry(6.0, 3.6, 5.2, 1, 1, 1)), rng, 0.16), ring % 2 ? stoneDark : stone);
      slab.position.set(Math.cos(a) * 9.55, Math.sin(a) * 9.55, z + (rng() - 0.5) * 0.6);
      slab.rotation.z = a - Math.PI / 2;
      slab.rotation.x = (rng() - 0.5) * 0.2;
      slab.name = 'Slab' + si;
      si = si + 1;
      shell.add(slab);
    }
  }
  g.add(shell);
  const innerGeo = new THREE.CylinderGeometry(7.4, 7.4, 28, 12, 1, true);
  innerGeo.rotateX(Math.PI / 2);
  const innerWall = new THREE.Mesh(innerGeo, mat(0x6f7683, { flatShading: true, roughness: 0.95, side: THREE.DoubleSide }));
  innerWall.name = 'InnerWall';
  g.add(innerWall);
  const crystals = new THREE.Group();
  crystals.name = 'Crystals';
  const veins = [[0.4, -10, 0.5], [1.3, -5.5, 0.36], [2.4, -1, 0.45], [3.6, 3, 0.32], [4.6, 7, 0.5], [5.5, 10.5, 0.4]];
  veins.forEach(([a, z, r], i) => {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), crystalMat);
    c.position.set(Math.cos(a) * 7.25, Math.sin(a) * 7.25, z);
    c.scale.set(1, 1.6, 1);
    c.rotation.z = a - Math.PI / 2;
    c.rotation.y = rng() * Math.PI;
    c.name = 'Crystal' + i;
    crystals.add(c);
  });
  g.add(crystals);
  const formations = new THREE.Group();
  formations.name = 'Formations';
  [[-1.5, -8], [1.8, 0], [-0.8, 7.5]].forEach(([x, z], i) => {
    const h = 2.2 + rng() * 0.8;
    const c = new THREE.Mesh(displaced(weld(new THREE.ConeGeometry(0.8 + rng() * 0.3, h, 7, 1)), rng, 0.18), stoneDark);
    c.position.set(x, 7.5 - h / 2, z);
    c.rotation.x = Math.PI;
    c.rotation.y = rng() * Math.PI;
    c.name = 'Stalactite' + i;
    formations.add(c);
  });
  [[1.2, -5], [-2.0, 2.5], [0.6, 9]].forEach(([x, z], i) => {
    const h = 1.8 + rng() * 0.8;
    const c = new THREE.Mesh(displaced(weld(new THREE.ConeGeometry(0.7 + rng() * 0.3, h, 7, 1)), rng, 0.18), stone);
    c.position.set(x, -7.5 + h / 2, z);
    c.rotation.y = rng() * Math.PI;
    c.name = 'Stalagmite' + i;
    formations.add(c);
  });
  g.add(formations);
  return g;
}

function buildCrystalCluster(rng) {
  const g = new THREE.Group();
  g.name = 'Crystal';
  const base = new THREE.Mesh(displaced(new THREE.DodecahedronGeometry(1.35, 0), rng, 0.3), mat(0x6f7683, { flatShading: true, roughness: 0.95 }));
  base.scale.set(1.5, 0.55, 1.25);
  base.position.y = 0.4;
  base.name = 'RockBase';
  g.add(base);
  const crystalMat = crystal(1.1);
  const spikes = [[1.1, 3.0, 0, 0], [0.7, 1.9, 0.75, 0.3], [0.4, 1.2, -0.7, -0.25], [0.55, 1.5, 0.15, -0.75], [0.5, 1.6, -0.3, 0.7]];
  spikes.forEach(([r, h, x, z], i) => {
    const geo = new THREE.OctahedronGeometry(r, 0);
    geo.scale(1, h / (2 * r), 1);
    const s = new THREE.Mesh(geo, crystalMat);
    s.position.set(x, 0.55 + h / 2, z);
    s.rotation.set((rng() - 0.5) * 0.3, rng() * Math.PI, (rng() - 0.5) * 0.3);
    s.name = 'Spike' + i;
    g.add(s);
  });
  return g;
}

function buildWaterfall(rng) {
  const g = new THREE.Group();
  g.name = 'Waterfall';
  const cliff = new THREE.Mesh(displaced(weld(new THREE.BoxGeometry(10, 16, 4, 2, 3, 2)), rng, 0.12), mat(0x8d8d93, { flatShading: true, roughness: 0.95 }));
  cliff.name = 'Cliff';
  g.add(cliff);
  const cascade = new THREE.Group();
  cascade.name = 'Cascade';
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x49b8e6, roughness: 0.35, metalness: 0, transparent: true, opacity: 0.8, side: THREE.DoubleSide
  });
  const sheets = [[4.4, 5.4, 0.3, 0.1, 5.3, -2.35], [4.8, 5.0, 0.3, -0.2, 1.2, -2.5], [4.2, 5.2, 0.28, 0.15, -2.8, -2.4], [4.9, 4.4, 0.32, -0.05, -6.2, -2.55]];
  sheets.forEach(([w, h, d, x, y, z], i) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), waterMat);
    s.position.set(x, y, z);
    s.rotation.z = (rng() - 0.5) * 0.08;
    s.rotation.y = (rng() - 0.5) * 0.1;
    s.name = 'Sheet' + i;
    cascade.add(s);
  });
  g.add(cascade);
  const foam = new THREE.Group();
  foam.name = 'Foam';
  const foamMat = mat(0xf4f8ff, { roughness: 0.95, flatShading: true });
  const blobs = [[-1.6, -8.2, -2.8, 0.9], [0.3, -8.35, -3.2, 1.15], [1.9, -8.1, -2.6, 0.8]];
  blobs.forEach(([x, y, z, r], i) => {
    const b = new THREE.Mesh(displaced(weld(new THREE.SphereGeometry(r, 8, 6)), rng, 0.35), foamMat);
    b.position.set(x, y, z);
    b.scale.set(1.1, 0.7, 1.05);
    b.name = 'Foam' + i;
    foam.add(b);
  });
  g.add(foam);
  return g;
}

function buildTinyBird(bodyColor, wingColor) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), mat(bodyColor, { roughness: 0.65 }));
  body.name = 'Body';
  g.add(body);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), mat(0xffb92e, { roughness: 0.45 }));
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.02, -0.55);
  beak.name = 'Beak';
  g.add(beak);
  const eyeMat = mat(0x1a1a1a, { roughness: 0.35 });
  for (const side of [1, -1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeMat);
    e.position.set(side * 0.18, 0.14, -0.4);
    g.add(e);
  }
  const wingMat = mat(wingColor, { roughness: 0.7 });
  const mkWing = (side) => {
    const pivot = new THREE.Group();
    pivot.name = side < 0 ? 'WingL' : 'WingR';
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.32), wingMat);
    w.position.x = side * 0.3;
    pivot.position.set(side * 0.32, 0.1, 0.05);
    pivot.rotation.z = side * -0.35;
    pivot.add(w);
    return pivot;
  };
  g.add(mkWing(1), mkWing(-1));
  return g;
}

function buildBirdFlock() {
  const g = new THREE.Group();
  g.name = 'BirdFlock';
  const specs = [
    ['Bird0', -3, 0.5, 2, 0xffd23f, 0xffb347],
    ['Bird1', 3, 0.5, 2, 0xffb347, 0xe89a3c],
    ['Bird2', 0, 0, -2, 0xffe08a, 0xf0c05a]
  ];
  for (const [name, x, y, z, c, wc] of specs) {
    const b = buildTinyBird(c, wc);
    b.name = name;
    b.position.set(x, y, z);
    g.add(b);
  }
  return g;
}

function buildEnemyBlue() {
  const g = new THREE.Group();
  g.name = 'EnemyBlue';
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 14), mat(0x3b7dd9, { roughness: 0.6 }));
  body.name = 'Body';
  g.add(body);
  const white = mat(0xffffff, { roughness: 0.3 });
  const black = mat(0x1a1a1a, { roughness: 0.35 });
  for (const side of [1, -1]) {
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), white);
    patch.scale.set(1, 1.05, 0.42);
    patch.position.set(side * 0.38, 0.3, -0.76);
    g.add(patch);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), black);
    pupil.position.set(side * 0.27, 0.27, -0.92);
    g.add(pupil);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.085, 0.08), black);
    brow.position.set(side * 0.37, 0.57, -0.76);
    brow.rotation.z = side * 0.5;
    g.add(brow);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 10), mat(0xffb92e, { roughness: 0.45 }));
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.06, -1.06);
  beak.name = 'Beak';
  g.add(beak);
  const tuftMat = mat(0x2b2b33, { roughness: 0.7, flatShading: true });
  for (const [x, r, h] of [[-0.26, 0.1, 0.4], [0, 0.12, 0.52], [0.26, 0.1, 0.4]]) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), tuftMat);
    spike.position.set(x, 0.95 + h * 0.3, -0.2);
    spike.rotation.set(0.5, 0, -x * 1.2);
    g.add(spike);
  }
  const wingGeo = new THREE.SphereGeometry(0.34, 10, 8);
  wingGeo.scale(1.1, 0.22, 0.55);
  const wingMat = mat(0x2f63b5, { roughness: 0.65 });
  const mkWing = (side) => {
    const pivot = new THREE.Group();
    pivot.name = side < 0 ? 'WingL' : 'WingR';
    const w = new THREE.Mesh(wingGeo, wingMat);
    w.position.x = side * 0.42;
    pivot.position.set(side * 0.62, 0.14, 0);
    pivot.rotation.z = side * -0.25;
    pivot.add(w);
    return pivot;
  };
  g.add(mkWing(1), mkWing(-1));
  return g;
}

function buildEnemyBomb() {
  const g = new THREE.Group();
  g.name = 'EnemyBomb';
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.05, 18, 14), mat(0x2b2b33, { roughness: 0.55 }));
  body.name = 'Body';
  g.add(body);
  const white = mat(0xffffff, { roughness: 0.3 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.3, metalness: 0.05, emissive: 0xff3300, emissiveIntensity: 0.55 });
  const pupilMat = mat(0x1a0a00, { roughness: 0.35 });
  for (const side of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), eyeMat);
    eye.scale.set(1, 1.05, 0.55);
    eye.position.set(side * 0.36, 0.22, -0.85);
    g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), pupilMat);
    pupil.position.set(side * 0.28, 0.2, -1.0);
    g.add(pupil);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.12), white);
    brow.position.set(side * 0.34, 0.52, -0.8);
    brow.rotation.z = side * 0.55;
    g.add(brow);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.62, 10), mat(0xffb92e, { roughness: 0.45 }));
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0, -1.2);
  beak.name = 'Beak';
  g.add(beak);
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 6), mat(0xff8c42, { roughness: 0.6, flatShading: true }));
  fuse.position.set(0.05, 1.2, 0.05);
  fuse.rotation.set(0.25, 0, -0.2);
  fuse.name = 'Fuse';
  g.add(fuse);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffc14d, roughness: 0.4, metalness: 0, emissive: 0xffa020, emissiveIntensity: 1.2 }));
  tip.position.set(0.1, 1.44, 0.12);
  tip.name = 'FuseTip';
  g.add(tip);
  const wingGeo = new THREE.SphereGeometry(0.4, 10, 8);
  wingGeo.scale(1.1, 0.24, 0.55);
  const wingMat = mat(0x43434f, { roughness: 0.65 });
  const mkWing = (side) => {
    const pivot = new THREE.Group();
    pivot.name = side < 0 ? 'WingL' : 'WingR';
    const w = new THREE.Mesh(wingGeo, wingMat);
    w.position.x = side * 0.45;
    pivot.position.set(side * 0.68, 0.15, 0);
    pivot.rotation.z = side * -0.25;
    pivot.add(w);
    return pivot;
  };
  g.add(mkWing(1), mkWing(-1));
  return g;
}

function exportGLB(object, name) {
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(object, (buf) => {
      const bin = Buffer.from(buf);
      writeFileSync(join(outDir, name), bin);
      console.log('wrote', name, (bin.length / 1024).toFixed(1) + 'KB');
      resolve();
    }, (err) => reject(err), { binary: true });
  });
}

const jobs = [
  [buildMountain(mulberry32(11)), 'mountain.glb'],
  [buildArch(mulberry32(22)), 'arch.glb'],
  [buildTunnel(mulberry32(33)), 'tunnel.glb'],
  [buildCrystalCluster(mulberry32(44)), 'crystal.glb'],
  [buildWaterfall(mulberry32(55)), 'waterfall.glb'],
  [buildBirdFlock(), 'birdFlock.glb'],
  [buildEnemyBlue(), 'enemyBlue.glb'],
  [buildEnemyBomb(), 'enemyBomb.glb'],
];
for (const [obj, name] of jobs) await exportGLB(obj, name);
console.log('done');
