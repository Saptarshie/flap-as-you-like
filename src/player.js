import * as THREE from 'three';
import { CFG } from './config.js';

export function flapImpulseForLevel(level, worldSpeed = CFG.difficulty.speedStart) {
  const L = Math.min(9, Math.max(1, level | 0));
  const base = CFG.bird.flapImpulse * (0.5 + 0.125 * (L - 1));
  const calib = 1 + (Math.max(34, Math.min(82, worldSpeed)) - 34) / 48 * CFG.bird.flapSpeedCalib;
  return base * calib;
}

export class Player {
  constructor(scene, models) {
    this.mesh = models.bird.clone(true);
    this.mesh.scale.setScalar(CFG.bird.scale);
    scene.add(this.mesh);
    this.blob = new THREE.Mesh(
      new THREE.CircleGeometry(1, 22),
      new THREE.MeshBasicMaterial({ color: 0x203020, transparent: true, opacity: 0.4, depthWrite: false })
    );
    this.blob.rotation.x = -Math.PI / 2;
    scene.add(this.blob);
    this.wings = {
      L: this.mesh.getObjectByName('WingL'),
      R: this.mesh.getObjectByName('WingR'),
    };
    this.pos = new THREE.Vector3(0, 12, 0);
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.alive = true;
    this.flapPhase = 0;
    this.wingBoost = 0;
    this.t = 0;
    this.wingL = 0;
    this.gliding = false;
    this.shield = 0;
    this.speedBoost = 0;
    this.extX = 0;
    this.extY = 0;
    this.flapLevel = CFG.bird.flapLevelDefault;
    this.diveT = 0;
    this.health = CFG.bird.healthMax;
    this.healT = 0;
    this.hitInvuln = 0;
    this.worldSpeed = CFG.difficulty.speedStart;
  }

  reset() {
    this.pos.set(0, 12, 0);
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.alive = true;
    this.wingBoost = 0;
    this.gliding = false;
    this.diveT = 0;
    this.shield = 0;
    this.speedBoost = 0;
    this.extX = 0;
    this.extY = 0;
    this.health = CFG.bird.healthMax;
    this.healT = 0;
    this.hitInvuln = 0;
    this.worldSpeed = CFG.difficulty.speedStart;
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.visible = true;
  }

  addForce(fx, fy) {
    this.extX += fx;
    this.extY += fy;
  }

  flap(audio) {
    this.vy = flapImpulseForLevel(this.flapLevel, this.worldSpeed);
    this.wingBoost = 1;
    this.diveT = 0;
    audio?.flap();
  }

  dive() {
    if (!this.alive) return;
    this.vy = Math.max(CFG.bird.maxDiveSpeed, Math.min(this.vy, 0) + CFG.bird.diveImpulse);
    this.diveT = 0.5;
    this.wingBoost = 0;
    this.flapPhase = Math.PI / 2;
  }

  _placeBlob(groundY) {
    if (!this.blob) return;
    const gy = groundY != null ? groundY : 0;
    const alt = Math.max(0, this.pos.y - gy);
    this.blob.position.set(this.pos.x, gy + 0.05, this.pos.z);
    const s = 1 + Math.min(2.4, alt * 0.13);
    this.blob.scale.set(s, s, 1);
    this.blob.material.opacity = 0.5 / (1 + alt * 0.25);
    this.blob.visible = this.mesh.visible;
  }

  mouthPos(out) {
    const m = this.mesh;
    out.set(0, 0.3, -1.15).applyEuler(m.rotation).multiplyScalar(CFG.bird.scale / 0.62).add(this.pos);
    return out;
  }

  update(dt, speed, axisX, turbulence, audio, groundY = 0) {
    if (!this.alive) return;
    const B = CFG.bird;
    this.worldSpeed = speed;
    if (this.shield > 0) this.shield -= dt;
    if (this.speedBoost > 0) this.speedBoost -= dt;
    if (this.diveT > 0) this.diveT -= dt;
    if (this.hitInvuln > 0) this.hitInvuln -= dt;
    if (this.health < CFG.bird.healthMax) {
      this.healT += dt;
      if (this.healT >= CFG.bird.healEvery) {
        this.healT -= CFG.bird.healEvery;
        this.health++;
      }
    } else {
      this.healT = 0;
    }
    const grav = this.gliding ? B.glideGravity : B.gravity;
    const fall = this.gliding ? B.glideFallSpeed : B.maxFallSpeed;
    this.vy += grav * dt;
    if (this.vy < fall) this.vy = fall;
    const latMax = B.lateralSpeed * (this.gliding ? B.glideTurnBoost : 1);
    const targetX = axisX * latMax;
    this.vel.x += (targetX - this.vel.x) * Math.min(1, dt * (this.gliding ? 9 : 7));
    if (this.pos.x > CFG.world.laneHalfWidth) {
      this.vel.x -= (this.pos.x - CFG.world.laneHalfWidth) * B.xSoft * 30 * dt;
    } else if (this.pos.x < -CFG.world.laneHalfWidth) {
      this.vel.x += (-CFG.world.laneHalfWidth - this.pos.x) * B.xSoft * 72 * dt;
    }
    if (turbulence > 0) {
      this.vy += Math.sin(this.t * 7.3) * turbulence * 7 * dt;
      this.vel.x += Math.sin(this.t * 5.1 + 1.7) * turbulence * 4 * dt;
    }
    this.vel.x += this.extX * dt;
    this.vy += this.extY * dt;
    this.extX = 0;
    this.extY = 0;
    this.t += dt;
    this.pos.y += this.vy * dt;
    this.pos.x += this.vel.x * dt;
    if (this.pos.y >= 30) {
      this.pos.y = 30;
      this.vy = Math.min(this.vy, 0);
    }
    const pitch = this.gliding
      ? -Math.atan2(Math.max(this.vy, -6), Math.max(8, speed)) * 0.5 + B.forwardTilt
      : -Math.atan2(this.vy, Math.max(6, speed)) + B.forwardTilt;
    const roll = -this.vel.x * (this.gliding ? 0.05 : 0.03);
    this.mesh.rotation.x += (pitch - this.mesh.rotation.x) * Math.min(1, dt * B.pitchLerp);
    this.mesh.rotation.z += (roll - this.mesh.rotation.z) * Math.min(1, dt * B.rollLerp);
    this.mesh.position.copy(this.pos);
    this._placeBlob(groundY);
    this.wingBoost = Math.max(0, this.wingBoost - dt * 1.4);
    if (this.diveT > 0) {
      const folded = 0.32;
      this.wingL += (folded - this.wingL) * Math.min(1, dt * 18);
    } else if (this.gliding) {
      const spread = 0.85 + Math.sin(this.t * 2.2) * 0.06;
      this.wingL += (spread - this.wingL) * Math.min(1, dt * 10);
    } else {
      const rate = 5 + this.wingBoost * 11;
      this.flapPhase += dt * rate;
      const s = Math.sin(this.flapPhase);
      const targetL = -0.18 - s * (0.4 + this.wingBoost * 0.35);
      this.wingL += (targetL - this.wingL) * Math.min(1, dt * 24);
    }
    if (this.wings.L) this.wings.L.rotation.z = this.wingL;
    if (this.wings.R) this.wings.R.rotation.z = -this.wingL;
  }

  hover(t, groundY = 0) {
    this.alive = true;
    this.pos.y = 12 + Math.sin(t * 2) * 0.7;
    this.vy = 0;
    this.vel.x = 0;
    this.extX = 0;
    this.extY = 0;
    this.mesh.position.copy(this.pos);
    this._placeBlob(groundY);
    this.flapPhase += 0.08;
    const s = Math.sin(this.flapPhase);
    this.wingL = -0.18 - s * 0.25;
    if (this.wings.L) this.wings.L.rotation.z = this.wingL;
    if (this.wings.R) this.wings.R.rotation.z = -this.wingL;
  }

  get radius() {
    return CFG.bird.scale * 1.05;
  }
}
