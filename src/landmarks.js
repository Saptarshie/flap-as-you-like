import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32, terrainHeight } from './utils.js';
import { hitEllipsoid, zSwept } from './collide.js';

const MOUNT_N = 8;
const MIST_N = 12;
const FLOCK_CAP = 3;
const TUN_CAP = 4;
const WF_RATE = 0.25;
const MX0 = 55;
const MX1 = 130;
const WRAP_Z = 150;
const WRAP_D = 700;
const TUN_X = 0;
const TUN_Y = 12;
const TUN_HALF = 14.5;
const TUN_IN = 14;
const TUN_PASS_Z = 15;
const WALL_R = 6.4;
const PASS_SCORE = 10;
const MIST_C = 0xdfe9f2;

function fbMountain() {
  const g = new THREE.Group();
  const rock = new THREE.Mesh(
    new THREE.ConeGeometry(13, 26, 7),
    new THREE.MeshStandardMaterial({ color: 0x7f838c, roughness: 0.95, flatShading: true })
  );
  rock.position.y = 13;
  const snow = new THREE.Mesh(
    new THREE.ConeGeometry(4.6, 8, 7),
    new THREE.MeshStandardMaterial({ color: 0xeef3f8, roughness: 0.9, flatShading: true })
  );
  snow.position.y = 22;
  g.add(rock, snow);
  return g;
}

function fbArch() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6c6875, roughness: 0.85, flatShading: true });
  const left = new THREE.Mesh(new THREE.BoxGeometry(4, 24, 5), mat);
  left.position.set(-13, 0, 0);
  const right = new THREE.Mesh(new THREE.BoxGeometry(4, 24, 5), mat);
  right.position.set(13, 0, 0);
  const top = new THREE.Mesh(new THREE.BoxGeometry(34, 5, 5), mat);
  top.position.y = 12.5;
  g.add(left, right, top);
  return g;
}

function fbTunnel() {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(
    new THREE.CylinderGeometry(16, 16, 28, 18, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x5a5664, roughness: 0.92, flatShading: true })
  );
  outer.rotation.x = Math.PI / 2;
  const bore = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 7, 28, 18, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x34313d, roughness: 0.9, side: THREE.BackSide })
  );
  bore.rotation.x = Math.PI / 2;
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x6a6674, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
  const rimA = new THREE.Mesh(new THREE.RingGeometry(7, 16, 18), rimMat);
  rimA.position.z = 14;
  const rimB = new THREE.Mesh(new THREE.RingGeometry(7, 16, 18), rimMat);
  rimB.position.z = -14;
  g.add(outer, bore, rimA, rimB);
  return g;
}

function fbCrystal() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3fd4ff,
    emissive: 0x1fb6e8,
    emissiveIntensity: 0.9,
    roughness: 0.25,
    flatShading: true,
  });
  const a = new THREE.Mesh(new THREE.OctahedronGeometry(1.4), mat);
  a.position.y = 1.3;
  a.scale.set(0.7, 1.7, 0.7);
  const b = new THREE.Mesh(new THREE.OctahedronGeometry(1), mat);
  b.position.set(0.9, 0.5, 0.4);
  b.scale.set(0.6, 1.2, 0.6);
  b.rotation.z = 0.5;
  const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), mat);
  c.position.set(-0.8, 0.4, -0.4);
  c.scale.set(0.5, 1.1, 0.5);
  c.rotation.x = -0.4;
  g.add(a, b, c);
  return g;
}

function fbWaterfall() {
  const g = new THREE.Group();
  const cliff = new THREE.Mesh(
    new THREE.BoxGeometry(14, 18, 8),
    new THREE.MeshStandardMaterial({ color: 0x9a8f84, roughness: 0.95, flatShading: true })
  );
  cliff.position.set(0, 9, 3);
  const fall = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 16),
    new THREE.MeshBasicMaterial({ color: 0xbfe6f5, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false })
  );
  fall.position.set(0, 8, -1.2);
  fall.rotation.y = Math.PI;
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 3),
    new THREE.MeshBasicMaterial({ color: 0xeef7fb, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
  );
  foam.position.set(0, 0.5, -1.6);
  foam.rotation.x = -Math.PI / 2;
  g.add(cliff, fall, foam);
  return g;
}

function fbFlock() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2b3140, roughness: 0.8, flatShading: true });
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 4), mat);
    body.rotation.x = Math.PI / 2;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.5), mat);
    wing.position.y = 0.18;
    b.add(body, wing);
    if (i === 0) b.position.set(0, 0.3, -1);
    else if (i === 1) b.position.set(-2.5, -0.2, 1.3);
    else b.position.set(2.5, -0.2, 1.3);
    g.add(b);
  }
  return g;
}

function makeMistTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class Landmarks {
  constructor(scene, models, hooks = {}) {
    this.scene = scene;
    this.models = models;
    this.hooks = hooks;
    this.rng = mulberry32(31415);
    this.pools = new Map();
    this._protos = {};
    this._unitPool = [];
    this._mistPool = [];
    this.mistTex = null;
    this.mountains = [];
    this.mists = [];
    this.flocks = [];
    this.tunnels = [];
    this.inTunnel = false;
    this.mistFactor = 0;
    this.tunnelPasses = 0;
    this._wasIn = false;
    this.nextFlockT = 40;
    this.nextTunnelAt = 500;
    this.reset();
  }

  _proto(kind) {
    if (this._protos[kind]) return this._protos[kind];
    let p = this.models[kind];
    if (!p) {
      if (kind === 'mountain') p = fbMountain();
      else if (kind === 'arch') p = fbArch();
      else if (kind === 'tunnel') p = fbTunnel();
      else if (kind === 'crystal') p = fbCrystal();
      else if (kind === 'waterfall') p = fbWaterfall();
      else p = fbFlock();
    }
    this._protos[kind] = p;
    return p;
  }

  _acquire(kind) {
    const pool = this.pools.get(kind);
    if (pool && pool.length) return pool.pop();
    const obj = this._proto(kind).clone(true);
    this.scene.add(obj);
    return obj;
  }

  _release(kind, obj) {
    obj.visible = false;
    let pool = this.pools.get(kind);
    if (!pool) { pool = []; this.pools.set(kind, pool); }
    pool.push(obj);
  }

  _makeUnit() {
    const g = new THREE.Group();
    g.add(this._proto('tunnel').clone(true));
    const archA = this._proto('arch').clone(true);
    archA.position.set(0, 0, 15);
    const archB = this._proto('arch').clone(true);
    archB.position.set(0, 0, -15);
    archB.rotation.y = Math.PI;
    g.add(archA, archB);
    const spots = [8.5, -3, 16.5, 2.2, -6.5, 4.5, 15.5, 1.6, 7, 5, -16.5, 1.9];
    for (let i = 0; i < spots.length; i += 4) {
      const c = this._proto('crystal').clone(true);
      c.position.set(spots[i], spots[i + 1], spots[i + 2]);
      c.scale.setScalar(spots[i + 3]);
      g.add(c);
    }
    this.scene.add(g);
    return g;
  }

  _takeUnit() {
    if (this._unitPool.length) return this._unitPool.pop();
    return this._makeUnit();
  }

  _takeMist() {
    if (this._mistPool.length) return this._mistPool.pop();
    if (!this.mistTex) this.mistTex = makeMistTexture();
    const mat = new THREE.SpriteMaterial({
      map: this.mistTex,
      color: MIST_C,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(mat);
    this.scene.add(sp);
    return sp;
  }

  _placeMountain(it) {
    it.x = it.side * (MX0 + this.rng() * (MX1 - MX0));
    it.s = 1.2 + this.rng() * 1.2;
    const depth = (Math.abs(it.x) - MX0) / (MX1 - MX0);
    it.parallax = 0.52 - depth * 0.27;
    it.obj.position.set(it.x, terrainHeight(it.x, it.z) - 1, it.z);
    it.obj.scale.set(it.s * (0.82 + this.rng() * 0.36), it.s * (1.05 + this.rng() * 0.35), it.s);
    it.obj.rotation.y = this.rng() * Math.PI * 2;
    it.obj.rotation.z = (this.rng() - 0.5) * 0.08;
    this._placeWaterfall(it);
  }

  _placeWaterfall(it) {
    if (it.wf) {
      this._release('waterfall', it.wf);
      it.wf = null;
    }
    if (this.rng() >= WF_RATE) return;
    const wf = this._acquire('waterfall');
    const x = it.x - it.side * (5 + this.rng() * 9);
    wf.visible = true;
    wf.rotation.set(0, 0, 0);
    wf.scale.setScalar(1);
    wf.position.set(x, terrainHeight(x, it.z), it.z);
    it.wf = wf;
  }

  _placeMist(it) {
    it.obj.position.set((this.rng() * 2 - 1) * 36, 2 + this.rng() * 3, it.z);
    const w = 18 + this.rng() * 22;
    it.obj.scale.set(w, w * (0.3 + this.rng() * 0.2), 1);
    it.vx = (this.rng() * 2 - 1) * 0.6;
    it.obj.material.opacity = 0.16 + this.rng() * 0.14;
  }

  _spawnFlock(bz) {
    const obj = this._acquire('birdFlock');
    obj.visible = true;
    obj.position.set((this.rng() * 2 - 1) * 30, 20 + this.rng() * 10, bz - 150 - this.rng() * 60);
    obj.rotation.set(0, 0, 0);
    obj.scale.setScalar(1);
    this.flocks.push({ obj, vx: 1.5 + this.rng() * 1.5 });
  }

  _spawnTunnel(z) {
    const obj = this._takeUnit();
    obj.visible = true;
    obj.position.set(TUN_X, TUN_Y, z);
    obj.rotation.set(0, this.rng() < 0.5 ? 0 : Math.PI, 0);
    obj.scale.setScalar(1);
    this.tunnels.push({ obj, z, prevZ: z, passed: false, crashed: false });
    const z0 = z - TUN_HALF - 10;
    const z1 = z + TUN_HALF + 10;
    if (this.hooks && typeof this.hooks.onClearSpan === 'function') this.hooks.onClearSpan(z0, z1);
  }

  blockedAt(z) {
    for (let i = 0; i < this.tunnels.length; i++) {
      const it = this.tunnels[i];
      if (z >= it.z - TUN_HALF - 10 && z <= it.z + TUN_HALF + 10) return true;
    }
    return false;
  }

  maybeSpawnTunnel(distance, birdZ) {
    if (distance <= this.nextTunnelAt) return;
    if (this.tunnels.length >= TUN_CAP) return;
    this._spawnTunnel(birdZ - 220);
    this.scheduleNextTunnel(distance);
  }

  scheduleNextTunnel(distance) {
    const range = CFG.difficulty.tunnelEvery;
    this.nextTunnelAt = distance + range[0] + this.rng() * (range[1] - range[0]);
  }

  clearTunnels() {
    for (const it of this.tunnels) {
      it.obj.visible = false;
      this._unitPool.push(it.obj);
    }
    this.tunnels.length = 0;
    if (this._wasIn) this.hooks.onExitTunnel?.();
    this._wasIn = false;
    this.inTunnel = false;
    this.mistFactor = 0;
  }

  reset() {
    for (let i = 0; i < this.mountains.length; i++) {
      const it = this.mountains[i];
      if (it.wf) { this._release('waterfall', it.wf); it.wf = null; }
      this._release('mountain', it.obj);
    }
    this.mountains.length = 0;
    for (let i = 0; i < this.mists.length; i++) {
      this.mists[i].obj.visible = false;
      this._mistPool.push(this.mists[i].obj);
    }
    this.mists.length = 0;
    for (let i = 0; i < this.flocks.length; i++) this._release('birdFlock', this.flocks[i].obj);
    this.flocks.length = 0;
    for (let i = 0; i < this.tunnels.length; i++) {
      this.tunnels[i].obj.visible = false;
      this._unitPool.push(this.tunnels[i].obj);
    }
    this.tunnels.length = 0;
    for (let side = -1; side <= 1; side += 2) {
      let z = WRAP_Z - 30;
      for (let i = 0; i < MOUNT_N; i++) {
        const obj = this._acquire('mountain');
        obj.visible = true;
        const it = { obj, wf: null, side, x: 0, s: 1, z };
        this._placeMountain(it);
        this.mountains.push(it);
        z -= 90 + this.rng() * 50;
      }
    }
    for (let i = 0; i < MIST_N; i++) {
      const obj = this._takeMist();
      obj.visible = true;
      const it = { obj, z: WRAP_Z - 30 - (WRAP_D - 80) * (i / MIST_N), vx: 0 };
      this._placeMist(it);
      this.mists.push(it);
    }
    this.inTunnel = false;
    this._wasIn = false;
    this.mistFactor = 0;
    this.tunnelPasses = 0;
    this.nextFlockT = 40 + this.rng() * 50;
    this.nextTunnelAt = 500;
  }

  update(dt, speed, t, bird, scoring = true) {
    const bx = bird.pos.x;
    const by = bird.pos.y;
    const bz = bird.pos.z;
    const sdz = speed * dt;
    for (let i = 0; i < this.mountains.length; i++) {
      const it = this.mountains[i];
      it.z += it.parallax * speed * dt;
      it.obj.position.z = it.z;
      if (it.wf) it.wf.position.z = it.z;
      if (it.z > WRAP_Z) {
        it.z -= WRAP_D;
        this._placeMountain(it);
      }
    }
    for (let i = 0; i < this.mists.length; i++) {
      const it = this.mists[i];
      it.z += sdz;
      it.obj.position.z = it.z;
      it.obj.position.x += it.vx * dt;
      if (it.obj.position.x > 48 || it.obj.position.x < -48) it.vx = -it.vx;
      if (it.z > WRAP_Z) {
        it.z -= WRAP_D;
        this._placeMist(it);
      }
    }
    for (let i = this.flocks.length - 1; i >= 0; i--) {
      const it = this.flocks[i];
      it.obj.position.x += it.vx * dt;
      it.obj.position.z += speed * 0.8 * dt;
      const fx = it.obj.position.x;
      const fz = it.obj.position.z;
      if (fz > WRAP_Z || fx > 90 || fx < -90) {
        this._release('birdFlock', it.obj);
        this.flocks[i] = this.flocks[this.flocks.length - 1];
        this.flocks.pop();
      }
    }
    if (t >= this.nextFlockT) {
      this.nextFlockT = t + 40 + this.rng() * 50;
      if (this.flocks.length < FLOCK_CAP) this._spawnFlock(bz);
    }
    let inside = false;
    for (let i = this.tunnels.length - 1; i >= 0; i--) {
      const it = this.tunnels[i];
      it.prevZ = it.z;
      it.z += sdz;
      it.obj.position.z = it.z;
      const dz = it.z - bz;
      if (scoring && !it.crashed && zSwept(it.prevZ, it.z, TUN_HALF, bz)) {
        const dx = bx - TUN_X;
        const dy = by - TUN_Y;
        if (dx * dx + dy * dy > WALL_R * WALL_R) {
          it.crashed = true;
          this.hooks.onCrash?.('tunnel');
        }
      }
      if (!it.passed && dz > TUN_PASS_Z) {
        it.passed = true;
        this.tunnelPasses += 1;
        if (scoring) this.hooks.onTunnelPass?.(PASS_SCORE);
      }
      if (dz < TUN_IN && dz > -TUN_IN) inside = true;
      if (it.z > WRAP_Z) {
        it.obj.visible = false;
        this._unitPool.push(it.obj);
        this.tunnels[i] = this.tunnels[this.tunnels.length - 1];
        this.tunnels.pop();
      }
    }
    if (inside && !this._wasIn) this.hooks.onEnterTunnel?.();
    if (!inside && this._wasIn) this.hooks.onExitTunnel?.();
    this._wasIn = inside;
    this.inTunnel = inside;
    let near = 0;
    for (let i = 0; i < this.tunnels.length; i++) {
      const dz = this.tunnels[i].z - bz;
      if (dz < 60 && dz > -60) { near = 1; break; }
    }
    this.mistFactor += (near - this.mistFactor) * (1 - Math.exp(-3 * dt));
  }
}
