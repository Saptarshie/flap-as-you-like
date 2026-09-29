import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32, terrainHeight } from './utils.js';
import { hitMoving, inCapsule2D, zSwept } from './collide.js';

const LANE = 26;

export class Obstacles {
  constructor(scene, models) {
    this.scene = scene;
    this.models = models;
    this.rng = mulberry32(20240);
    this.gates = [];
    this.drifters = [];
    this.rings = [];
    this.coins = [];
    this.movers = [];
    this.pools = { ring: [], coin: [], drifter: [], blade: [], log: [], floater: [] };
    this.spawnZ = -150;
    this.spacing = CFG.difficulty.spacingStart;
    this.gap = CFG.difficulty.gapStart;
    this.intensity = 0;
    this.gatesSpawned = 0;
    this.onCrash = null;
    this.onGatePass = null;
    this.onRing = null;
    this.onCoin = null;
    this.isBlocked = null;
    this.bossProps = [];
    this.bossPropPool = [];
  }

  _acquire(kind) {
    const pool = this.pools[kind];
    if (pool && pool.length) {
      const o = pool.pop();
      o.visible = true;
      return o;
    }
    let o;
    if (kind === 'ring') o = this.models.ring.clone(true);
    else if (kind === 'coin') o = this.models.coin.clone(true);
    else if (kind === 'blade') {
      o = new THREE.Group();
      const hub = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x6b4f2a, roughness: 0.8 })
      );
      o.add(hub);
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc7a24a, roughness: 0.5, metalness: 0.4 });
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.3, 0.55), bladeMat);
        b.position.set(Math.cos((i * Math.PI) / 2) * 1.75, Math.sin((i * Math.PI) / 2) * 1.75, 0);
        b.rotation.z = (i * Math.PI) / 2;
        o.add(b);
      }
    } else if (kind === 'log') {
      o = new THREE.Group();
      const logMat = new THREE.MeshStandardMaterial({ color: 0x7d5a3c, roughness: 0.9 });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 11, 9), logMat);
      beam.rotation.z = Math.PI / 2;
      beam.position.y = -3.5;
      o.add(beam);
      const ropeMat = new THREE.MeshStandardMaterial({ color: 0x9a8a6a, roughness: 1 });
      for (const rx of [-5, 5]) {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.5, 5), ropeMat);
        rope.position.set(rx, -1.75, 0);
        o.add(rope);
      }
    } else if (kind === 'floater') {
      o = this.models.rockA.clone(true);
    } else o = this.models.rockA.clone(true);
    this.scene.add(o);
    return o;
  }

  _release(kind, obj) {
    obj.visible = false;
    if (kind === 'log' && obj.parent && obj.parent.type === 'Group' && obj.parent !== this.scene) {
      const pivot = obj.parent;
      pivot.remove(obj);
      this.scene.remove(pivot);
    }
    this.pools[kind].push(obj);
  }

  reset() {
    this.endBossArena();
    for (const g of this.gates) this.scene.remove(g.group);
    this.gates.length = 0;
    for (const d of this.drifters) this._release('drifter', d.obj);
    this.drifters.length = 0;
    for (const m of this.movers) {
      if (m.kind === 'log') {
        const inner = m.obj.children[0];
        this.scene.remove(m.obj);
        if (inner) this.pools.log.push(inner);
      } else this._release(m.kind, m.obj);
    }
    this.movers.length = 0;
    for (const r of this.rings) this._release('ring', r.obj);
    this.rings.length = 0;
    for (const c of this.coins) this._release('coin', c.obj);
    this.coins.length = 0;
    this.spawnZ = -150;
    this.spacing = CFG.difficulty.spacingStart;
    this.gap = CFG.difficulty.gapStart;
    this.intensity = 0;
    this.gatesSpawned = 0;
    this.ensureAhead(0, 0);
  }

  _takeBossProp() {
    if (this.bossPropPool.length) return this.bossPropPool.pop();
    const proto = this.models.rockSpire || this.models.rockA;
    const obj = proto.clone(true);
    obj.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.scene.add(obj);
    return obj;
  }

  _placeBossProp(rec, z, index) {
    const layout = [
      { side: 1, off: 17.5, y: 15 },
      { side: -1, off: 19.3, y: 8 },
      { side: 0, off: 0, y: 5.2 },
      { side: -1, off: 21.1, y: 17 },
      { side: 1, off: 18.4, y: 6 },
    ];
    const L = layout[index % layout.length];
    rec.z = z;
    rec.prevZ = z;
    rec.x = L.side * L.off;
    rec.baseY = L.y;
    rec.r = L.side === 0 ? 1.9 : 2.3;
    rec.hit = false;
    rec.obj.visible = true;
    rec.obj.position.set(rec.x, rec.baseY, z);
    rec.obj.scale.set(2.1, 2.8, 2.1);
    rec.obj.rotation.set(0.2 * index, index * 1.7, 0.1 * (L.side || 1));
  }

  beginBossArena(birdZ, encounterNumber = 1) {
    this.endBossArena();
    const count = Math.min(5, 3 + Math.floor((encounterNumber - 1) / 2));
    for (let i = 0; i < count; i++) {
      const rec = { obj: this._takeBossProp() };
      this._placeBossProp(rec, birdZ - 95 - i * 105, i);
      this.bossProps.push(rec);
    }
  }

  endBossArena() {
    for (const rec of this.bossProps) {
      rec.obj.visible = false;
      this.bossPropPool.push(rec.obj);
    }
    this.bossProps.length = 0;
  }

  updateBossArena(dt, speed, bird) {
    let farthest = bird.pos.z - 120;
    for (const p of this.bossProps) farthest = Math.min(farthest, p.z);
    for (const p of this.bossProps) {
      p.prevZ = p.z;
      p.z += speed * dt;
      if (p.z > bird.pos.z + 55) {
        farthest -= 105;
        this._placeBossProp(p, farthest, this.bossProps.indexOf(p));
      } else {
        p.obj.position.z = p.z;
        p.obj.rotation.y += dt * 0.28;
      }
      if (!p.hit && hitMoving(bird.pos, bird.radius, {
        x: p.x, y: p.baseY, z: p.z, prevZ: p.prevZ,
        rx: p.r, ry: p.r * 1.4, rz: p.r,
      })) {
        p.hit = true;
        this.onCrash?.('boss-rock');
      }
    }
  }

  setDifficulty(gap, spacing, intensity = 0) {
    this.gap = gap;
    this.spacing = spacing;
    this.intensity = intensity;
  }

  _spawnGate(z) {
    const group = new THREE.Group();
    const gentle = this.gatesSpawned < 2;
    const gapY = gentle ? 11 + this.rng() * 6 : 7 + this.rng() * 15;
    this.gatesSpawned++;
    const half = this.gap / 2;
    const bottomTop = gapY - half;
    const topBottom = gapY + half;
    const groundY = terrainHeight(0, z);
    const spire = this.models.rockSpire;
    const monolithX = [0, -9, 9, -6, 6][this.gatesSpawned % 5] * (0.75 + this.rng() * 0.25);
    const bottomH = Math.max(0, bottomTop - groundY + 2);
    if (bottomH > 3) {
      const b = spire.clone(true);
      b.scale.set(4.4, bottomH / 4.1, 2.4);
      b.position.set(monolithX, bottomTop - bottomH, 0);
      group.add(b);
    }
    const slab = this.models.rockA.clone(true);
    const slabThick = 3.5 + this.rng() * 4;
    slab.scale.set(14, slabThick / 1.8, 3.2);
    slab.position.set(0, topBottom + slabThick / 2 - 1, 0);
    slab.rotation.y = this.rng() * 0.6 - 0.3;
    group.add(slab);
    group.position.z = z;
    this.scene.add(group);
    const gate = { group, z, gapY, half, passed: false };
    this.gates.push(gate);
    if (this.rng() < 0.45) {
      const ring = this._acquire('ring');
      ring.position.set(0, gapY, z);
      const rs = 1.5 + this.rng() * 0.5;
      ring.scale.setScalar(rs);
      ring.rotation.y = 0;
      this.rings.push({ obj: ring, z, prevZ: z, passed: false, r: 2.2 * rs });
    }
    if (this.rng() < 0.7) {
      const n = 4 + Math.floor(this.rng() * 4);
      const cy = 8 + this.rng() * 14;
      const amp = 1.5 + this.rng() * 2.5;
      const ph = this.rng() * 6.28;
      for (let i = 0; i < n; i++) {
        const cz = z - 14 - i * 5;
        const coin = this._acquire('coin');
        coin.position.set(0, cy + Math.sin(ph + i * 0.7) * amp, cz);
        this.coins.push({ obj: coin, z: cz, prevZ: cz, taken: false, baseY: coin.position.y });
      }
    }
    if (this.rng() < 0.45 + 0.3 * this.intensity) {
      const d = this._acquire('drifter');
      const dy = 7 + this.rng() * 16;
      const baseX = (this.rng() * 2 - 1) * 6;
      const amp = 8 + this.rng() * 10;
      const s = 1.6 + this.rng() * 0.9;
      d.scale.setScalar(s);
      d.position.set(baseX, dy, z - this.spacing * 0.5);
      d.rotation.set(this.rng() * 3, this.rng() * 3, this.rng() * 3);
      this.drifters.push({
        obj: d, z: d.position.z, prevZ: d.position.z, baseX,
        amp, freq: 0.5 + this.rng() * 0.7,
        baseY: dy, phase: this.rng() * 6.28, spin: 0.4 + this.rng() * 0.8,
        r: 0.95 * s, hit: false,
      });
    }
    this._spawnMover(z - this.spacing * 0.62);
  }

  _spawnMover(z) {
    const chance = 0.4 + 0.35 * this.intensity;
    if (this.rng() > chance) return;
    const r = this.rng();
    let kind;
    if (r < 0.4) kind = 'blade';
    else if (r < 0.72) kind = 'log';
    else kind = 'floater';
    const obj = this._acquire(kind);
    if (kind === 'blade') {
      const y = 7 + this.rng() * 15;
      const x = (this.rng() * 2 - 1) * 12;
      obj.position.set(x, y, z);
      obj.rotation.z = this.rng() * 6.28;
      this.movers.push({ obj, kind, z, prevZ: z, spin: (this.rng() < 0.5 ? -1 : 1) * (1.6 + this.rng() * 1.4), hit: false });
    } else if (kind === 'log') {
      const y = 12 + this.rng() * 10;
      const pivot = new THREE.Group();
      pivot.position.set(0, y, z);
      pivot.add(obj);
      obj.position.set(0, 0, 0);
      this.scene.add(pivot);
      this.movers.push({ obj: pivot, inner: obj, kind, z, prevZ: z, swing: (this.rng() < 0.5 ? -1 : 1) * (0.7 + this.rng() * 0.5), phase: this.rng() * 6.28, hit: false });
    } else {
      const y = 9 + this.rng() * 14;
      const x = (this.rng() * 2 - 1) * 16;
      const s = 1.8 + this.rng() * 1.4;
      obj.position.set(x, y, z);
      obj.scale.setScalar(s);
      obj.rotation.set(this.rng() * 3, this.rng() * 3, this.rng() * 3);
      this.movers.push({ obj, kind, z, prevZ: z, bobA: 1.2 + this.rng() * 1.2, phase: this.rng() * 6.28, baseY: y, r: 0.9 * s * 1.05, hit: false });
    }
  }

  ensureAhead(birdZ) {
    let guard = 0;
    while (this.spawnZ > birdZ - 340 && guard++ < 24) {
      if (!this.isBlocked || !this.isBlocked(this.spawnZ)) this._spawnGate(this.spawnZ);
      this.spawnZ -= this.spacing;
    }
    if (this.spawnZ < birdZ - 900) this.spawnZ = birdZ - 340;
  }

  clearSpan(z0, z1) {
    const inR = (z) => z >= z0 && z <= z1;
    for (let i = this.gates.length - 1; i >= 0; i--) {
      if (inR(this.gates[i].z)) {
        this.scene.remove(this.gates[i].group);
        this.gates.splice(i, 1);
      }
    }
    for (let i = this.drifters.length - 1; i >= 0; i--) {
      if (inR(this.drifters[i].z)) {
        this._release('drifter', this.drifters[i].obj);
        this.drifters.splice(i, 1);
      }
    }
    for (let i = this.movers.length - 1; i >= 0; i--) {
      const m = this.movers[i];
      if (!inR(m.z)) continue;
      if (m.kind === 'log') {
        const inner = m.inner || m.obj.children[0];
        this.scene.remove(m.obj);
        if (inner) this.pools.log.push(inner);
      } else this._release(m.kind, m.obj);
      this.movers.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      if (inR(this.rings[i].z)) {
        this._release('ring', this.rings[i].obj);
        this.rings.splice(i, 1);
      }
    }
    for (let i = this.coins.length - 1; i >= 0; i--) {
      if (inR(this.coins[i].z)) {
        this._release('coin', this.coins[i].obj);
        this.coins.splice(i, 1);
      }
    }
  }

  update(dt, speed, bird, t, audio, scoring = true, advanceSpawnCursor = true) {
    const bz = bird.pos.z;
    if (advanceSpawnCursor) this.spawnZ += speed * dt;
    for (let i = this.gates.length - 1; i >= 0; i--) {
      const g = this.gates[i];
      g.z += speed * dt;
      g.group.position.z = g.z;
      if (!g.passed && g.z >= bz) {
        g.passed = true;
        if (!scoring) continue;
        const margin = 0.5;
        let safe = true;
        if (Math.abs(bird.pos.x) < 8) {
          safe = bird.pos.y > g.gapY - g.half + margin && bird.pos.y < g.gapY + g.half - margin;
        }
        if (safe) {
          this.onGatePass?.();
          audio?.swoosh();
        } else if (this.onCrash) {
          this.onCrash('gate');
          return;
        }
      }
      if (g.z > 60) {
        this.scene.remove(g.group);
        this.gates.splice(i, 1);
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.prevZ = r.z;
      r.z += speed * dt;
      r.obj.position.z = r.z;
      if (scoring && !r.passed && zSwept(r.prevZ, r.z, 1.0, bz)) {
        const dx = bird.pos.x - r.obj.position.x;
        const dy = bird.pos.y - r.obj.position.y;
        if (dx * dx + dy * dy < r.r * r.r) {
          r.passed = true;
          this.onRing?.();
          audio?.ring();
        }
      }
      if (r.z > 50) { this._release('ring', r.obj); this.rings.splice(i, 1); }
    }
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.prevZ = c.z;
      c.z += speed * dt;
      c.obj.position.z = c.z;
      c.obj.rotation.y += dt * 3;
      if (scoring && !c.taken && zSwept(c.prevZ, c.z, 0.8, bz)) {
        const dx = bird.pos.x - c.obj.position.x;
        const dy = bird.pos.y - c.obj.position.y;
        if (dx * dx + dy * dy < 3.0) {
          c.taken = true;
          c.obj.visible = false;
          this.onCoin?.(c.obj.position);
          audio?.coin();
        }
      }
      if (c.z > 50) { this._release('coin', c.obj); this.coins.splice(i, 1); }
    }
    for (let i = this.drifters.length - 1; i >= 0; i--) {
      const d = this.drifters[i];
      d.prevZ = d.z;
      d.z += speed * dt;
      d.obj.position.z = d.z;
      d.obj.position.x = d.baseX + Math.sin(t * d.freq + d.phase) * d.amp;
      d.obj.position.y = d.baseY + Math.sin(t * d.freq * 0.6 + d.phase * 1.3) * 1.2;
      d.obj.rotation.y += d.spin * dt;
      if (scoring && !d.hit && hitMoving(bird.pos, bird.radius, {
        x: d.obj.position.x, y: d.obj.position.y, z: d.z, prevZ: d.prevZ,
        rx: d.r, ry: d.r, rz: d.r,
      })) {
        d.hit = true;
        this.onCrash?.('drifter');
        return;
      }
      if (d.z > 50) { this._release('drifter', d.obj); this.drifters.splice(i, 1); }
    }
    for (let i = this.movers.length - 1; i >= 0; i--) {
      const m = this.movers[i];
      m.prevZ = m.z;
      m.z += speed * dt;
      m.obj.position.z = m.z;
      let hit = false;
      if (m.kind === 'blade') {
        m.obj.rotation.z += m.spin * dt;
        if (scoring && !m.hit && zSwept(m.prevZ, m.z, 0.5, bz)) {
          const hx = m.obj.position.x;
          const hy = m.obj.position.y;
          const spin = m.obj.rotation.z;
          const rr = 0.35 + bird.radius;
          for (let k = 0; k < 4; k++) {
            const th = spin + (k * Math.PI) / 2;
            const cth = Math.cos(th);
            const sth = Math.sin(th);
            if (inCapsule2D(bird.pos.x, bird.pos.y, hx + cth * 0.3, hy + sth * 0.3, hx + cth * 3.1, hy + sth * 3.1, rr)) {
              hit = true;
              break;
            }
          }
          if (!hit) {
            const dx = bird.pos.x - hx;
            const dy = bird.pos.y - hy;
            hit = dx * dx + dy * dy < (0.7 + bird.radius) * (0.7 + bird.radius);
          }
        }
      } else if (m.kind === 'log') {
        m.obj.rotation.z = Math.sin(t * m.swing + m.phase) * 0.9;
        if (scoring && !m.hit && zSwept(m.prevZ, m.z, 0.6, bz)) {
          const px = m.obj.position.x;
          const py = m.obj.position.y;
          const phi = m.obj.rotation.z;
          const cph = Math.cos(phi);
          const sph = Math.sin(phi);
          const ax = px + (-5.5 * cph - -3.5 * sph);
          const ay = py + (-5.5 * sph + -3.5 * cph);
          const bx2 = px + (5.5 * cph - -3.5 * sph);
          const by2 = py + (5.5 * sph + -3.5 * cph);
          hit = inCapsule2D(bird.pos.x, bird.pos.y, ax, ay, bx2, by2, 0.55 + bird.radius);
        }
      } else {
        m.obj.position.y = m.baseY + Math.sin(t * 1.4 + m.phase) * m.bobA;
        m.obj.rotation.y += dt * 0.7;
        if (scoring && !m.hit && hitMoving(bird.pos, bird.radius, {
          x: m.obj.position.x, y: m.obj.position.y, z: m.z, prevZ: m.prevZ,
          rx: m.r, ry: m.r, rz: m.r,
        })) {
          hit = true;
        }
      }
      if (hit) {
        m.hit = true;
        this.onCrash?.(m.kind);
        return;
      }
      if (m.z > 50) {
        if (m.kind === 'log') {
          this.scene.remove(m.obj);
          this.pools.log.push(m.inner);
        } else this._release(m.kind, m.obj);
        this.movers.splice(i, 1);
      }
    }
  }
}
