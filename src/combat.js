import * as THREE from 'three';
import { CFG } from './config.js';

const _v = new THREE.Vector3();

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.balls = [];
    const geo = new THREE.SphereGeometry(CFG.combat.ballRadius, 12, 10);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x9ff3ff, emissive: 0x36d1ff, emissiveIntensity: 2.2,
      roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.95
    });
    this.protoGeo = geo;
    this.protoMat = mat;
    this.cooldown = 0;
  }

  _acquire() {
    const p = this.pool.pop();
    if (p) { p.visible = true; return p; }
    const m = new THREE.Mesh(this.protoGeo, this.protoMat);
    this.scene.add(m);
    return m;
  }

  fire(from, audio) {
    if (this.cooldown > 0) return false;
    if (this.balls.length >= CFG.combat.maxBalls) return false;
    this.cooldown = CFG.combat.fireCooldown;
    const obj = this._acquire();
    obj.position.copy(from);
    this.balls.push({ obj, prevPos: from.clone(), life: CFG.combat.ballLife, dead: false });
    audio?.shoot();
    return true;
  }

  update(dt, worldSpeed) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.life -= dt;
      b.prevPos.copy(b.obj.position);
      b.obj.position.z -= (CFG.combat.ballSpeed + Math.max(0, worldSpeed - CFG.combat.ballSpeed)) * dt;
      b.obj.position.y += Math.sin(b.life * 22) * 0.02;
      if (b.life <= 0 || b.obj.position.z < -360) b.dead = true;
      if (b.dead) {
        b.obj.visible = false;
        this.pool.push(b.obj);
        this.balls.splice(i, 1);
      }
    }
  }

  hitTest(pos, radius) {
    for (const b of this.balls) {
      if (b.dead) continue;
      if (b.obj.position.distanceTo(pos) < radius + CFG.combat.ballRadius) {
        b.dead = true;
        return true;
      }
    }
    return false;
  }

  killBall(b) {
    b.dead = true;
  }

  reset() {
    for (const b of this.balls) {
      b.obj.visible = false;
      this.pool.push(b.obj);
    }
    this.balls.length = 0;
    this.cooldown = 0;
  }

  get count() {
    return this.balls.length;
  }
}
