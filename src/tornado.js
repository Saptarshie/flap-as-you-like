import * as THREE from 'three';
import { mulberry32 } from './utils.js';

const PULL_R = 30;
const CORE_R = 4;
const FUNNEL_H = 15;
const FUNNEL_R0 = 0.8;
const FUNNEL_R1 = 5.5;
const F_IN = 62;
const F_SWIRL = 38;
const F_LIFT = 14;
const F_SINK = 5;
const CORE_CD = 1;
const ROAR_DT = 0.5;
const RING_N = 9;
const DUST_N = 120;
const HELIX_TURNS = 8;
const TAU = Math.PI * 2;

function funnelR(y) {
  const c = y < 0 ? 0 : (y > FUNNEL_H ? FUNNEL_H : y);
  return FUNNEL_R0 + (c / FUNNEL_H) * FUNNEL_R1;
}

function makeSoftParticle() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function makeHelixGeometry() {
  const pts = [];
  const steps = 120;
  for (let strand = 0; strand < 3; strand++) {
    for (let i = 0; i < steps - 1; i++) {
      if (i % 7 === 5) continue;
      for (const j of [i, i + 1]) {
        const y = (j / (steps - 1)) * FUNNEL_H;
        const a = (j / (steps - 1)) * TAU * HELIX_TURNS + strand * TAU / 3;
        const r = funnelR(y) + 0.35 + 0.22 * Math.sin(a * 0.7);
        pts.push(Math.cos(a) * r, y, -Math.sin(a) * r);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}

export class Tornados {
  constructor(scene, models, hooks = {}) {
    this.scene = scene;
    this.models = models;
    this.hooks = hooks || {};
    this.rng = mulberry32(60613);
    this.pool = [];
    this.list = [];
    this.roarT = 0;
    this._shared();
  }

  _shared() {
    this.ringGeos = [];
    this.ringMats = [];
    const bh = FUNNEL_H / RING_N;
    for (let i = 0; i < RING_N; i++) {
      const rB = funnelR(i * bh);
      const rT = funnelR((i + 1) * bh);
      this.ringGeos.push(new THREE.CylinderGeometry(rT, rB, bh * 1.3, 12, 1, true));
      this.ringMats.push(new THREE.MeshStandardMaterial({
        color: 0x9aa7b8,
        transparent: true,
        opacity: 0.45 - (i / (RING_N - 1)) * 0.13,
        roughness: 0.88,
        metalness: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }));
    }
    this.debrisGeo = new THREE.TetrahedronGeometry(0.22);
    this.debrisMat = new THREE.MeshStandardMaterial({ color: 0x6f6355, roughness: 0.95, metalness: 0 });
    this.capGeo = new THREE.SphereGeometry(1, 10, 8);
    this.capMats = [
      new THREE.MeshStandardMaterial({ color: 0x3f4854, roughness: 1, metalness: 0 }),
      new THREE.MeshStandardMaterial({ color: 0x4d5764, roughness: 1, metalness: 0 }),
      new THREE.MeshStandardMaterial({ color: 0x59636f, roughness: 1, metalness: 0 }),
    ];
    this.discGeo = new THREE.ConeGeometry(6.8, 0.9, 22, 1, true);
    this.discMat = new THREE.MeshStandardMaterial({
      color: 0x464f5c,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.dustMat = new THREE.PointsMaterial({
      color: 0x8a7a62,
      size: 0.65,
      map: makeSoftParticle(),
      transparent: true,
      opacity: 0.62,
      blending: THREE.NormalBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.helixGeo = makeHelixGeometry();
    this.helixMat = new THREE.LineBasicMaterial({
      color: 0xd4dde4, transparent: true, opacity: 0.28,
      blending: THREE.NormalBlending, depthWrite: false,
    });
  }

  _build() {
    const group = new THREE.Group();
    const rings = [];
    const bh = FUNNEL_H / RING_N;
    for (let i = 0; i < RING_N; i++) {
      const mesh = new THREE.Mesh(this.ringGeos[i], this.ringMats[i]);
      const y = (i + 0.5) * bh;
      mesh.position.y = y;
      group.add(mesh);
      rings.push({
        mesh,
        y,
        spin: (2.5 + (i / (RING_N - 1)) * 4.5) * (0.9 + this.rng() * 0.2),
        wobA: 0.08 + this.rng() * 0.14,
        wobF: 0.6 + this.rng() * 1.0,
        ph: i + this.rng() * 1.2,
      });
    }
    const cap = new THREE.Group();
    cap.position.y = FUNNEL_H + 0.3;
    const disc = new THREE.Mesh(this.discGeo, this.discMat);
    disc.position.y = -0.55;
    disc.scale.y = 0.55;
    cap.add(disc);
    const blobs = [
      [3.1, 1.0, 2.7, 0, 0.5, 0],
      [2.3, 0.75, 2.0, -1.5, 0.9, 0.7],
      [2.1, 0.7, 1.9, 1.4, 0.7, -0.8],
    ];
    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];
      const m = new THREE.Mesh(this.capGeo, this.capMats[i]);
      m.scale.set(b[0], b[1], b[2]);
      m.position.set(b[3], b[4], b[5]);
      cap.add(m);
    }
    group.add(cap);
    const helix = new THREE.LineSegments(this.helixGeo, this.helixMat);
    helix.position.y = 0.2;
    group.add(helix);
    const debris = [];
    const nd = 5 + Math.floor(this.rng() * 3);
    for (let i = 0; i < nd; i++) {
      const dy = 0.7 + this.rng() * 11.5;
      const mesh = new THREE.Mesh(this.debrisGeo, this.debrisMat);
      mesh.scale.setScalar(0.7 + this.rng() * 0.7);
      group.add(mesh);
      debris.push({
        mesh,
        y: dy,
        rad: funnelR(dy) + 0.8,
        ang: this.rng() * TAU,
        angSp: 0.8 + this.rng() * 1.3,
        spx: (this.rng() - 0.5) * 8,
        spy: (this.rng() - 0.5) * 8,
      });
    }
    const pos = new Float32Array(DUST_N * 3);
    const dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(dGeo, this.dustMat);
    points.frustumCulled = false;
    group.add(points);
    const dust = [];
    for (let i = 0; i < DUST_N; i++) {
      dust.push({
        ang: this.rng() * TAU,
        angSp: 0.8 + this.rng() * 1.4,
        outerR: 7 + this.rng() * 15,
        age: this.rng(),
        rate: 0.10 + this.rng() * 0.12,
        ph: this.rng() * TAU,
      });
    }
    this.scene.add(group);
    return { group, rings, cap, helix, debris, dust, points, pos };
  }

  _acquire() {
    const rig = this.pool.pop() || this._build();
    rig.group.visible = true;
    return rig;
  }

  _release(tt) {
    tt.rig.group.visible = false;
    this.pool.push(tt.rig);
  }

  _cb(callbacks, name, arg) {
    if (callbacks === null) return;
    const fn = (callbacks && callbacks[name]) || this.hooks[name] || this[name];
    if (typeof fn === 'function') fn(arg);
  }

  spawn(z) {
    const rig = this._acquire();
    const x = (this.rng() * 2 - 1) * 24;
    const s = 1.1 + this.rng() * 0.5;
    const tt = {
      rig,
      x,
      z,
      prevZ: z,
      s,
      spinSign: this.rng() < 0.5 ? -1 : 1,
      life: 26 + this.rng() * 14,
      hitCd: 0,
      ph: this.rng() * TAU,
      baseY: -0.25,
    };
    rig.group.position.set(x, tt.baseY, z);
    rig.group.scale.set(s, s, s);
    this.list.push(tt);
    return tt;
  }

  reset() {
    for (const tt of this.list) this._release(tt);
    this.list.length = 0;
    this.roarT = 0;
  }

  update(dt, speed, t, bird, callbacks) {
    this.roarT -= dt;
    let roar = 0;
    const bPos = bird && bird.pos ? bird.pos : null;
    const bR = bird && bird.radius != null ? bird.radius : 0.65;
    const canPush = !!(bird && typeof bird.addForce === 'function' && bird.alive !== false);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tt = this.list[i];
      const rig = tt.rig;
      tt.prevZ = tt.z;
      tt.z += speed * dt;
      tt.life -= dt;
      tt.hitCd = Math.max(0, tt.hitCd - dt);
      const g = rig.group;
      g.position.set(tt.x, tt.baseY, tt.z);
      g.scale.set(tt.s, tt.s * (1 + Math.sin(t * 2.1 + tt.ph) * 0.04), tt.s);
      for (let ri = 0; ri < rig.rings.length; ri++) {
        const r = rig.rings[ri];
        const h = ri / (rig.rings.length - 1);
        const bendX = Math.sin(t * 0.72 + tt.ph + h * 2.2) * (0.08 + h * 0.38);
        const bendZ = Math.cos(t * 0.58 + tt.ph * 1.3 + h * 1.8) * (0.06 + h * 0.3);
        r.mesh.rotation.y += tt.spinSign * r.spin * dt;
        r.mesh.position.x = bendX + Math.sin(t * r.wobF + r.ph) * r.wobA * 0.18;
        r.mesh.position.z = bendZ + Math.cos(t * r.wobF * 0.85 + r.ph) * r.wobA * 0.18;
        r.mesh.position.y = r.y + Math.sin(t * r.wobF * 1.3 + r.ph) * r.wobA * 0.35;
      }
      rig.cap.rotation.y += tt.spinSign * 0.35 * dt;
      rig.helix.rotation.y += tt.spinSign * 2.8 * dt;
      for (const d of rig.debris) {
        d.ang += tt.spinSign * d.angSp * dt;
        d.mesh.position.set(Math.cos(d.ang) * d.rad, d.y + Math.sin(t * 1.4 + d.ang) * 0.2, -Math.sin(d.ang) * d.rad);
        d.mesh.rotation.x += d.spx * dt;
        d.mesh.rotation.y += d.spy * dt;
      }
      const pos = rig.pos;
      for (let k = 0; k < rig.dust.length; k++) {
        const p = rig.dust[k];
        p.age += p.rate * dt;
        if (p.age >= 1) {
          p.age -= 1;
          p.outerR = 7 + this.rng() * 15;
        }
        const inward = p.age * p.age;
        const y = Math.pow(p.age, 2.4) * 9;
        const rr = p.outerR * (1 - inward) + funnelR(y) * inward;
        p.ang += tt.spinSign * p.angSp * (0.6 + inward * 3.5) * dt;
        pos[k * 3] = Math.cos(p.ang) * rr;
        pos[k * 3 + 1] = y + Math.sin(t * 2.1 + p.ph) * 0.25;
        pos[k * 3 + 2] = -Math.sin(p.ang) * rr;
      }
      rig.points.geometry.attributes.position.needsUpdate = true;
      if (bPos) {
        const dx = bPos.x - tt.x;
        const dzE = (bPos.z - tt.z) * 0.35;
        const d = Math.sqrt(dx * dx + dzE * dzE);
        if (d < PULL_R) {
          const base = 1 - d / PULL_R;
          const f = Math.pow(base > 0 ? base : 0, 1.5);
          const ff = f * f;
          let fx = 0;
          let fy = 0;
          if (d > 1e-4) {
            const nx = dx / d;
            const nzE = dzE / d;
            const tx = -nzE * tt.spinSign;
            fx = -nx * F_IN * ff + tx * F_SWIRL * ff;
            if (d < CORE_R) {
              const cf = 1 - d / CORE_R;
              fx += tx * F_SWIRL * cf * 1.6 - nx * F_IN * cf * 0.6;
              fy += Math.sin(t * 9 + tt.ph) * F_LIFT * cf * 2.4;
            }
          }
          if (bPos.y < 8) fy += F_LIFT * ff;
          else if (bPos.y > 16) fy -= F_SINK * ff;
          if (canPush) bird.addForce(fx, fy);
          this._cb(callbacks, 'onPull', f);
          if (f > roar) roar = f;
        }
      }
      if (tt.life <= 0 || tt.z > 50) {
        this._release(tt);
        this.list.splice(i, 1);
      }
    }
    if (roar > 0 && this.roarT <= 0) {
      this.roarT = ROAR_DT;
      this._cb(callbacks, 'onRoar', roar);
    }
  }

  tryBallHit(ballPos, radius, onKill) {
    return false;
  }

  get count() {
    return this.list.length;
  }
}
