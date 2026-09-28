import * as THREE from 'three';
import { mulberry32 } from './utils.js';
import { zSwept } from './collide.js';

export class Powerups {
  constructor(scene, models) {
    this.scene = this._s = scene;
    this.models = models;
    this.rng = mulberry32(90210);
    this.pools = { speed: [], shield: [], gem: [] };
    this.list = [];
  }

  _acquire(kind) {
    const pool = this.pools[kind];
    const o = pool.pop();
    if (o) { o.visible = true; return o; }
    let obj;
    if (kind === 'speed' && this.models.potionSpeed) obj = this.models.potionSpeed.clone(true);
    else if (kind === 'shield' && this.models.potionShield) obj = this.models.potionShield.clone(true);
    else if (kind === 'gem' && this.models.gem) obj = this.models.gem.clone(true);
    else {
      const color = kind === 'speed' ? 0xff3355 : kind === 'shield' ? 0x33aaff : 0xaa44ff;
      obj = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.55, 0),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 })
      );
    }
    this.scene.add(obj);
    return obj;
  }

  _release(p) {
    p.obj.visible = false;
    this.pools[p.kind].push(p.obj);
  }

  _place(kind, x, y, z) {
    const obj = this._acquire(kind);
    obj.position.set(x, y, z);
    const p = { obj, kind, z, prevZ: z, baseY: y, phase: this.rng() * 6.28, taken: false };
    this.list.push(p);
    return p;
  }

  spawnPotion(z) {
    const kind = this.rng() < 0.5 ? 'speed' : 'shield';
    const x = (this.rng() * 2 - 1) * 14;
    const y = 8 + this.rng() * 14;
    this._place(kind, x, y, z);
  }

  spawnGemLine(z) {
    const n = 3 + Math.floor(this.rng() * 3);
    const x = (this.rng() * 2 - 1) * 12;
    const y = 9 + this.rng() * 12;
    for (let i = 0; i < n; i++) {
      this._place('gem', x, y + Math.sin(i * 0.8) * 1.2, z - i * 4.5);
    }
  }

  reset() {
    for (const p of this.list) this._release(p);
    this.list.length = 0;
  }

  update(dt, speed, t, bird, callbacks) {
    const bz = bird.pos.z;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.prevZ = p.z;
      p.z += speed * dt;
      p.obj.position.z = p.z;
      p.obj.position.y = p.baseY + Math.sin(t * 2 + p.phase) * 0.6;
      p.obj.rotation.y += dt * 2.4;
      if (!p.taken && zSwept(p.prevZ, p.z, 1.0, bz)) {
        const d = p.obj.position.distanceTo(bird.pos);
        if (d < 1.7 + bird.radius) {
          p.taken = true;
          this._release(p);
          this.list.splice(i, 1);
          callbacks?.onPickup?.(p.kind, p.obj.position);
          continue;
        }
      }
      if (p.z > 50) {
        this._release(p);
        this.list.splice(i, 1);
      }
    }
  }

  get count() {
    return this.list.length;
  }
}