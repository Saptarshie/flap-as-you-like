import * as THREE from 'three';
import { mulberry32 } from './utils.js';

const PORTAL_OFFSET = 260;
const PORTAL_Y = 12;
const PORTAL_X = 0;
const GARDEN_TIME = 12;
const GARDEN = { xMin: -14, xMax: 14, yMin: 7, yMax: 26, zNear: 10, zFar: -30 };
const GARDEN_DEPTH = GARDEN.zNear - GARDEN.zFar; // 40
const GARDEN_WRAP_Z = GARDEN.zNear + 4;
const ISLANDS = 14, COINS = 40, GEMS = 8, RINGS = 4;
const COLLECT_R2 = 1.6 * 1.6;
const PORTAL_R2 = 3.4 * 3.4;

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(200,160,255,0.95)');
  grad.addColorStop(0.35, 'rgba(150,110,255,0.55)');
  grad.addColorStop(1, 'rgba(120,80,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class BonusZone {
  constructor(scene, models) {
    this.scene = scene;
    this.models = models;
    this.rng = mulberry32(77123);
    this.onCollect = null;
    this.active = false;
    this.portalActive = false;
    this.timeLeft = GARDEN_TIME;
    this.exitReady = false;
    this.pools = { island: [], coin: [], gem: [], ring: [] };
    this.items = [];
    this.tweens = [];
    this._odo = 0;
    this._trigger = null;
    this._entered = false;
    this._entryY = 14;
    this._portal = null;
    this._glow = null;
    this._protos = null;
  }

  _acquire(kind) {
    const pool = this.pools[kind];
    if (pool && pool.length) {
      const o = pool.pop();
      o.visible = true;
      return o;
    }
    if (!this._protos) this._protos = this._buildProtos();
    const o = this._protos[kind].clone(true);
    this.scene.add(o);
    return o;
  }

  _release(kind, obj) {
    obj.visible = false;
    this.pools[kind].push(obj);
  }

  _buildProtos() {
    const protos = {};
    const green = new THREE.MeshStandardMaterial({ color: 0x7dd06a, roughness: 0.85 });
    const dirt = new THREE.MeshStandardMaterial({ color: 0x9a7b52, roughness: 0.95 });
    const island = new THREE.Group();
    const top = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4), green);
    top.scale.set(1.5, 0.5, 1.5);
    island.add(top);
    const bottom = new THREE.Mesh(new THREE.DodecahedronGeometry(1.7), dirt);
    bottom.scale.set(1.15, 0.85, 1.15);
    bottom.position.y = -1.15;
    island.add(bottom);
    protos.island = island;
    if (this.models.coin) {
      protos.coin = this.models.coin;
    } else {
      const coin = new THREE.Group();
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20),
        new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0x8a6a10, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.7 })
      );
      disc.rotation.x = Math.PI / 2;
      coin.add(disc);
      protos.coin = coin;
    }
    if (this.models.gem) {
      protos.gem = this.models.gem;
    } else {
      protos.gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.7),
        new THREE.MeshStandardMaterial({ color: 0x63e6ff, emissive: 0x2aa7d0, emissiveIntensity: 1.1, roughness: 0.15, metalness: 0.4 })
      );
    }
    if (this.models.ring) {
      protos.ring = this.models.ring;
    } else {
      protos.ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.5, 0.22, 10, 32),
        new THREE.MeshStandardMaterial({ color: 0xffe9a3, emissive: 0xb08a2a, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.6 })
      );
    }
    return protos;
  }

  _buildPortal() {
    const group = new THREE.Group();
    if (this.models.portal) {
      group.add(this.models.portal.clone(true));
    } else {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3, 0.32, 14, 48),
        new THREE.MeshStandardMaterial({ color: 0x8a5cff, emissive: 0x8a5cff, emissiveIntensity: 1.6, roughness: 0.25, metalness: 0.5 })
      );
      group.add(ring);
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(2.75, 40),
        new THREE.MeshBasicMaterial({ color: 0xb08aff, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false })
      );
      group.add(disc);
      const crysMat = new THREE.MeshStandardMaterial({ color: 0x9ff2ff, emissive: 0x3fd0ff, emissiveIntensity: 1.4, roughness: 0.2 });
      for (let i = 0; i < 4; i++) {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), crysMat);
        group.add(c);
      }
    }
    const crystals = [];
    group.traverse((o) => { if (o.isMesh && o.geometry?.type === 'OctahedronGeometry') crystals.push(o); });
    if (!this._glow) {
      this._glowTex = makeGlowTexture();
      this._glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this._glowTex, color: 0xffffff, transparent: true, opacity: 0.85,
        depthWrite: false, blending: THREE.AdditiveBlending
      }));
      this._glow.scale.setScalar(17);
      this.scene.add(this._glow);
    }
    this.scene.add(group);
    return { group, crystals };
  }

  reset() {
    for (const it of this.items) this._release(it.kind, it.obj);
    this.items.length = 0;
    this.tweens.length = 0;
    if (this._portal) {
      this._portal.group.visible = false;
      this._glow.visible = false;
    }
    this.active = false;
    this.portalActive = false;
    this.exitReady = false;
    this.timeLeft = GARDEN_TIME;
    this._odo = 0;
    this._trigger = null;
    this._entered = false;
    this._entryY = 14;
  }

  scheduleAt(distanceTrigger) {
    this._trigger = distanceTrigger;
  }

  cancelPortal() {
    this._trigger = null;
    this.portalActive = false;
    this._entered = false;
    if (this._portal) {
      this._portal.group.visible = false;
      this._glow.visible = false;
    }
  }

  _spawnPortal() {
    if (!this._portal) this._portal = this._buildPortal();
    const p = this._portal;
    p.group.visible = true;
    p.group.position.set(PORTAL_X, PORTAL_Y, -PORTAL_OFFSET);
    p.group.rotation.set(0, 0, 0);
    p.group.scale.setScalar(1);
    this._glow.visible = true;
    this._glow.position.set(PORTAL_X, PORTAL_Y, -PORTAL_OFFSET - 0.6);
    this.portalActive = true;
  }

  tryEnter(birdPos) {
    if (!this.portalActive || this._entered) return false;
    const p = this._portal.group.position;
    const dz = p.z - birdPos.z;
    if (dz > 2.5 || dz < -3) return false;
    const dx = birdPos.x - p.x, dy = birdPos.y - p.y;
    if (dx * dx + dy * dy > PORTAL_R2) return false;
    this._entered = true;
    this.portalActive = false;
    this.enterGarden(birdPos);
    return true;
  }

  enterGarden(birdPos) {
    if (this.active) return { entryY: this._entryY };
    if (this._portal) {
      this._portal.group.visible = false;
      this._glow.visible = false;
    }
    this.active = true;
    this.timeLeft = GARDEN_TIME;
    this.exitReady = false;
    this._entryY = birdPos ? Math.max(GARDEN.yMin + 1, Math.min(GARDEN.yMax - 2, birdPos.y)) : 14;
    const zBase = birdPos ? birdPos.z : 0;
    const slots = [];
    for (let i = 0; i < ISLANDS; i++) slots.push({ kind: 'island', f: (i + 0.5) / ISLANDS });
    for (let i = 0; i < COINS; i++) slots.push({ kind: 'coin', f: (i + 0.5) / COINS });
    for (let i = 0; i < GEMS; i++) slots.push({ kind: 'gem', f: (i + 0.5) / GEMS });
    for (let i = 0; i < RINGS; i++) slots.push({ kind: 'ring', f: (i + 0.5) / RINGS });
    for (const s of slots) {
      const obj = this._acquire(s.kind);
      const it = this._makeItem(s.kind, obj, zBase - GARDEN.zNear + s.f * GARDEN_DEPTH);
      this.items.push(it);
      this._tweenIn(it, 0.15 + s.f * 0.35);
    }
    return { entryY: this._entryY };
  }

  _makeItem(kind, obj, z) {
    const r = this.rng;
    const s = kind === 'island' ? 0.9 + r() * 0.9 : 0.8 + r() * 0.6;
    obj.visible = true;
    obj.scale.setScalar(0.001);
    obj.position.set(
      GARDEN.xMin + 2 + r() * (GARDEN.xMax - GARDEN.xMin - 4),
      GARDEN.yMin + 1.5 + r() * (GARDEN.yMax - GARDEN.yMin - 3),
      z
    );
    if (kind === 'island') obj.rotation.y = r() * Math.PI * 2;
    if (kind === 'ring') { obj.rotation.set(0, 0, 0); obj.rotation.z = (r() - 0.5) * 0.6; }
    return {
      kind, obj, s, baseY: obj.position.y, z,
      bobA: 0.4 + r() * 0.8, bobF: 0.5 + r() * 0.8, phase: r() * 6.28,
      spin: kind === 'island' ? 0.1 + r() * 0.2 : 1.5 + r() * 2,
      taken: false, respawnT: 0,
    };
  }

  _tweenIn(it, dur) {
    this.tweens.push({ it, k0: 0.001, k1: 1, t: 0, dur, done: false });
  }

  _respawnAhead(it, zBase) {
    const fresh = this._makeItem(it.kind, it.obj, zBase - GARDEN.zNear);
    Object.assign(it, fresh);
    this._tweenIn(it, 0.4);
  }

  exit(birdPos) {
    if (!this.active) return { exitY: this._entryY };
    this.active = false;
    this.exitReady = false;
    const exitY = birdPos ? birdPos.y : this._entryY;
    for (const it of this.items) {
      this.tweens.push({ it, k0: it.obj.scale.x || 1, k1: 0.001, t: 0, dur: 0.5, done: false });
      it.taken = true;
    }
    this._entered = false;
    return { exitY };
  }

  update(dt, speed, t, birdPos) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      const e = k * k * (3 - 2 * k);
      const base = tw.it.s;
      tw.it.obj.scale.setScalar(Math.max(0.001, base * (tw.k0 + (tw.k1 - tw.k0) * e)));
      if (k >= 1) {
        if (tw.k1 < 0.01) {
          tw.it.obj.visible = false;
          this._release(tw.it.kind, tw.it.obj);
          const idx = this.items.indexOf(tw.it);
          if (idx >= 0) this.items.splice(idx, 1);
        }
        this.tweens.splice(i, 1);
      }
    }

    if (this._trigger !== null && !this.active && !this.portalActive && !this._entered && this._odo >= this._trigger) {
      this._spawnPortal();
      this._trigger = null;
    }
    if (this.portalActive) {
      const p = this._portal;
      p.group.position.z += speed * dt;
      this._glow.position.z += speed * dt;
      p.group.rotation.y += dt * 0.7;
      p.group.rotation.z = Math.sin(t * 0.6) * 0.12;
      p.group.position.y = PORTAL_Y + Math.sin(t * 0.9) * 0.6;
      let ci = 0;
      p.group.traverse((o) => {
        if (o.isMesh && o.geometry?.type === 'OctahedronGeometry') {
          const a = t * 1.6 + ci * 1.57;
          o.position.set(Math.cos(a) * 4.1, Math.sin(a * 1.3) * 1.1, Math.sin(a) * 4.1);
          o.rotation.y += dt * 2;
          o.rotation.x += dt * 1.3;
          ci++;
        }
      });
      this._glow.material.opacity = 0.65 + Math.sin(t * 3.2) * 0.2;
      if (p.group.position.z > (birdPos ? birdPos.z : 0) + 40) {
        p.group.visible = false;
        this._glow.visible = false;
        this.portalActive = false;
        this._trigger = null;
      }
    }

    if (!this.active) { this._odo += speed * dt; return; }

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.exitReady = true; }

    const bz = birdPos ? birdPos.z : 0;
    for (const it of this.items) {
      it.z += speed * dt;
      if (it.z > bz + GARDEN_WRAP_Z) {
        this._respawnAhead(it, bz);
        continue;
      }
      it.obj.position.z = it.z;
      it.obj.position.y = it.baseY + Math.sin(t * it.bobF + it.phase) * it.bobA;
      if (it.taken) {
        it.respawnT -= dt;
        if (it.respawnT <= 0) this._respawnAhead(it, bz);
        continue;
      }
      if (it.kind !== 'island') {
        it.obj.rotation.y += it.spin * dt;
        if (birdPos && !it.taken) {
          const dx = birdPos.x - it.obj.position.x;
          const dy = birdPos.y - it.obj.position.y;
          const dz = it.z - bz;
          if (dz > -1.4 && dz < 1.6 && dx * dx + dy * dy < COLLECT_R2) {
            it.taken = true;
            it.obj.visible = false;
            it.respawnT = 0.8;
            this.onCollect?.(it.kind, it.obj.position);
          }
        }
      } else {
        it.obj.rotation.y += it.spin * dt;
      }
    }
  }
}
