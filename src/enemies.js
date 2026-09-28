import * as THREE from 'three';
import { mulberry32 } from './utils.js';
import { hitMoving } from './collide.js';

export class Enemies {
  constructor(scene, models) {
    this.scene = scene;
    this.models = models;
    this.rng = mulberry32(77123);
    this.pools = { red: [], blue: [], bomb: [] };
    this.list = [];
    this.flapState = new WeakMap();
  }

  _acquire(variant) {
    const pool = this.pools[variant];
    const o = pool.pop();
    if (o) { o.visible = true; return o; }
    let obj;
    const proto = variant === 'blue' ? this.models.enemyBlue
      : variant === 'bomb' ? this.models.enemyBomb
      : this.models.enemy;
    if (proto) {
      obj = proto.clone(true);
    } else {
      obj = new THREE.Group();
      const color = variant === 'blue' ? 0x3b7dd9 : variant === 'bomb' ? 0x2b2b33 : 0xd93b3b;
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(1, 14, 10),
        new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
      );
      obj.add(body);
    }
    this.scene.add(obj);
    return obj;
  }

  _release(e) {
    e.obj.visible = false;
    this.pools[e.variant].push(e.obj);
  }

  _pickVariant(hard) {
    const r = this.rng();
    if (hard < 0.35) return 'red';
    if (hard < 0.7) return r < 0.65 ? 'red' : 'blue';
    return r < 0.5 ? 'red' : r < 0.82 ? 'blue' : 'bomb';
  }

  spawn(z, mode = 'chase', hard = 0) {
    const variant = this._pickVariant(hard);
    const obj = this._acquire(variant);
    const x = (this.rng() * 2 - 1) * 20;
    const y = 8 + this.rng() * 16;
    const base = variant === 'bomb' ? 1.15 : variant === 'blue' ? 0.9 : 0.95;
    const s = base + this.rng() * 0.3;
    obj.position.set(x, y, z);
    obj.scale.setScalar(s);
    const e = {
      obj, z, prevZ: z, mode, variant,
      vy: 0,
      phase: this.rng() * 6.28,
      weaver: variant === 'blue' ? 2.4 + this.rng() * 1.2 : 1.4 + this.rng() * 1.2,
      diveSpeed: variant === 'blue' ? 20 + this.rng() * 8 : variant === 'bomb' ? 11 + this.rng() * 5 : 15 + this.rng() * 8,
      flap: this.rng() * 6.28,
      r: 1.1 * s,
      dead: false,
    };
    this.list.push(e);
    return e;
  }

  reset() {
    for (const e of this.list) this._release(e);
    this.list.length = 0;
  }

  update(dt, speed, t, bird, callbacks) {
    const bz = bird.pos.z;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      const o = e.obj;
      e.prevZ = e.z;
      e.flap += dt * (e.variant === 'blue' ? 12 : 9);
      if (e.mode === 'chase') {
        e.z += (speed + e.diveSpeed) * dt;
        o.position.z = e.z;
        const dx = bird.pos.x - o.position.x;
        const dy = bird.pos.y - o.position.y;
        o.position.x += Math.sign(dx) * Math.min(Math.abs(dx), 9 * dt) + Math.sin(t * e.weaver + e.phase) * 2.2 * dt;
        e.vy += Math.sign(dy) * Math.min(Math.abs(dy), 8 * dt);
        o.position.y += e.vy * dt;
      } else {
        e.z += speed * dt;
        o.position.z = e.z;
        o.position.x += Math.sin(t * e.weaver + e.phase) * 5 * dt;
        o.position.y += Math.cos(t * e.weaver * 0.7 + e.phase) * 2 * dt;
      }
      o.rotation.z = Math.sin(e.flap) * 0.25;
      const wl = o.getObjectByName('WingL');
      const wr = o.getObjectByName('WingR');
      if (wl) wl.rotation.z = Math.sin(e.flap) * 0.5;
      if (wr) wr.rotation.z = -Math.sin(e.flap) * 0.5;
      if (!e.dead && hitMoving(bird.pos, bird.radius, {
        x: o.position.x, y: o.position.y, z: e.z, prevZ: e.prevZ,
        rx: e.r, ry: e.r, rz: e.r,
      })) {
        e.dead = true;
        callbacks?.onHitPlayer?.('enemy', o.position);
      }
      if (e.dead || e.z > 50) {
        this._release(e);
        this.list.splice(i, 1);
      }
    }
  }

  tryBallHit(ballPos, testRadius, onKill) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.obj.position.distanceTo(ballPos) < testRadius + e.r) {
        this._release(e);
        this.list.splice(i, 1);
        onKill?.(e.obj.position, e.variant);
        return true;
      }
    }
    return false;
  }

  get count() {
    return this.list.length;
  }
}