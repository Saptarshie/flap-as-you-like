import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32, terrainHeight } from './utils.js';

const LANE = 26;

export class Scenery {
  constructor(scene, models) {
    this.scene = scene;
    this.models = models;
    this.rng = mulberry32(9176);
    this.items = [];
    this.pools = new Map();
    this.frontier = -40;
  }

  _acquire(kind) {
    const pool = this.pools.get(kind);
    if (pool && pool.length) return pool.pop();
    const proto = this.models[kind];
    const obj = proto.clone(true);
    this.scene.add(obj);
    return obj;
  }

  _release(item) {
    item.obj.visible = false;
    let pool = this.pools.get(item.kind);
    if (!pool) { pool = []; this.pools.set(item.kind, pool); }
    pool.push(item.obj);
  }

  _spawnOne(z) {
    const r = this.rng();
    const side = this.rng() < 0.5 ? -1 : 1;
    let kind, x, y, s = 1, spin = 0, bobA = 0, bobF = 0, drift = 0, phase = this.rng() * 6.28;
    if (r < 0.40) {
      kind = this.rng() < 0.55 ? 'treePine' : 'treeRound';
      x = side * (LANE + 3 + this.rng() * 26);
      y = terrainHeight(x, z) - 0.15;
      if (y < -3.4) return;
      s = 1.4 + this.rng() * 1.5;
    } else if (r < 0.55) {
      kind = this.rng() < 0.4 ? 'rockSpire' : 'rockA';
      x = side * (LANE + 2 + this.rng() * 22);
      y = terrainHeight(x, z) - 0.3;
      s = 1.2 + this.rng() * 1.8;
    } else if (r < 0.64) {
      kind = 'balloon';
      x = side * (3 + this.rng() * 18);
      y = 9 + this.rng() * 14;
      s = 1 + this.rng() * 0.6;
      bobA = 0.6 + this.rng() * 0.8;
      bobF = 0.4 + this.rng() * 0.5;
      drift = (this.rng() - 0.5) * 1.2;
    } else {
      kind = 'cloud';
      x = (this.rng() * 2 - 1) * 80;
      y = 17 + this.rng() * 13;
      s = 2.2 + this.rng() * 2.6;
      drift = (this.rng() - 0.5) * 0.8;
    }
    const obj = this._acquire(kind);
    obj.visible = true;
    obj.position.set(x, y, z);
    obj.scale.setScalar(s);
    obj.rotation.y = this.rng() * Math.PI * 2;
    this.items.push({ obj, kind, baseY: y, spin, bobA, bobF, drift, phase });
  }

  spawnChunk(zStart, depth) {
    const n = 5 + Math.floor(this.rng() * 3);
    for (let i = 0; i < n; i++) {
      this._spawnOne(zStart - this.rng() * depth);
    }
  }

  reset() {
    for (const it of this.items) this._release(it);
    this.items.length = 0;
    this.frontier = -40;
    this.ensureAhead(0);
  }

  ensureAhead(birdZ) {
    while (this.frontier > birdZ - 340) {
      this.spawnChunk(this.frontier, 46);
      this.frontier -= 46;
    }
  }

  update(dt, speed, t) {
    this.frontier += speed * dt;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.obj.position.z += speed * dt;
      if (it.spin) it.obj.rotation.y += it.spin * dt;
      if (it.bobA) it.obj.position.y = it.baseY + Math.sin(t * it.bobF + it.phase) * it.bobA;
      if (it.drift) {
        it.obj.position.x += it.drift * dt;
        if (Math.abs(it.obj.position.x) > 90) it.drift *= -1;
      }
      if (it.obj.position.z > 70) {
        this._release(it);
        this.items.splice(i, 1);
      }
    }
  }
}
