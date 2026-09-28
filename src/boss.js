import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32, damp } from './utils.js';

const LANE = CFG.world.laneHalfWidth;
const ENTER_Z = -120;
const HOVER_Z = -34;
const HOVER_Z_MIN = CFG.difficulty && -38 || -38;
const HOVER_Z_MAX = -30;
const HOVER_Y = 16;
const HOVER_Y_MIN = 9;
const HOVER_Y_MAX = 24;
const HOVER_X = 10;
const BIRD_RADIUS = 0.65;
const CONTACT_DIST = 2.6 + BIRD_RADIUS;
const MINION_CONTACT_SQ = 1.55 * 1.55;
const INVULN = 0.8;
const CADENCE = 2.4;
const CADENCE_ENRAGE = 1.5;
const TELEGRAPH = 0.5;
const SWOOP_T = 1.7;
const SWOOP_RETURN_T = 1.15;
const SWOOP_Y_BAND = 5.5;
const FEATHER_SPEED = 28;
const FEATHER_LIFE = 4.5;
const FEATHER_HIT_SQ = 1.2 * 1.2;
const MINION_SPEED = 20;
const MINION_LIFE = 6;
const TUMBLE_TIME = 2.5;
const TUMBLE_GRAV = 12;
const KILL_Y = -8;
const ENRAGE_FRAC = 0.4;
const BOSS_SIZE = 4.4;
const MINION_SIZE = 1.8;
const MINION_POOL_SIZE = 6;
const MINION_WAVE_SIZE = 3;
const MINION_ENCOUNTER_CAP = 18;
const MINION_HIT_R = 1.35;
const FIRST_SPAWN = CFG.difficulty.bossFirst;
const SPAWN_EVERY = CFG.difficulty.bossEvery;
const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);

function normalizeTo(obj, target) {
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return 1;
  const size = box.getSize(new THREE.Vector3());
  const m = Math.max(size.x, size.y, size.z);
  return m > 1e-4 ? target / m : 1;
}

function buildFallbackBoss() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.2, 2),
    new THREE.MeshStandardMaterial({ color: 0xb22222, roughness: 0.55, flatShading: true })
  );
  g.add(body);
  const eyeG = new THREE.SphereGeometry(0.45, 12, 10);
  const eyeM = new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xff4400, emissiveIntensity: 0.9 });
  const browG = new THREE.BoxGeometry(0.6, 0.15, 0.14);
  const browM = new THREE.MeshStandardMaterial({ color: 0x3a0505 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(eyeG, eyeM);
    eye.position.set(sx * 0.85, 0.55, -1.85);
    g.add(eye);
    const brow = new THREE.Mesh(browG, browM);
    brow.position.set(sx * 0.85, 1.0, -1.9);
    brow.rotation.z = sx * -0.55;
    g.add(brow);
  }
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1.7, 10),
    new THREE.MeshStandardMaterial({ color: 0xffc107, roughness: 0.5 })
  );
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, -0.1, -2.7);
  g.add(beak);
  const tailM = new THREE.MeshStandardMaterial({ color: 0x7f1010, roughness: 0.75 });
  const wingG = new THREE.ConeGeometry(0.5, 3.2, 6);
  const wingM = new THREE.MeshStandardMaterial({ color: 0x8f1515, roughness: 0.7 });
  for (const sx of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 8), tailM);
    tail.position.set(sx * 0.9, -0.3, 2.0);
    tail.rotation.x = Math.PI / 2 - 0.35;
    g.add(tail);
    const wing = new THREE.Mesh(wingG, wingM);
    wing.position.set(sx * 2.0, 0.4, 0.2);
    wing.rotation.z = sx * (Math.PI / 2 + 0.45);
    g.add(wing);
  }
  return g;
}

function buildFallbackMinion() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.75, 1),
    new THREE.MeshStandardMaterial({ color: 0x2c2c34, roughness: 0.6, flatShading: true })
  );
  g.add(body);
  const eyeG = new THREE.SphereGeometry(0.2, 8, 8);
  const eyeM = new THREE.MeshStandardMaterial({ color: 0xffdd44, emissive: 0xff5500, emissiveIntensity: 0.8 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(eyeG, eyeM);
    eye.position.set(sx * 0.3, 0.15, -0.62);
    g.add(eye);
  }
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.65, 8),
    new THREE.MeshStandardMaterial({ color: 0xffc107 })
  );
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, -0.05, -0.85);
  g.add(beak);
  return g;
}

export class Boss {
  constructor(scene, models) {
    this.scene = scene;
    this.name = 'MEGA BEAK';
    this.onDefeat = null;
    this.onHitPlayer = null;
    this.rng = mulberry32(7771);

    this.group = new THREE.Group();
    this.usedFallback = !models.bossBird;
    this.inner = models.bossBird ? models.bossBird.clone(true) : buildFallbackBoss();
    this._baseScale = this.usedFallback ? 1 : normalizeTo(this.inner, BOSS_SIZE);
    this.inner.scale.setScalar(this._baseScale);
    this.group.add(this.inner);
    this.group.visible = false;
    scene.add(this.group);

    this.feathers = [];
    this._featherPool = [];
    for (let i = 0; i < 12; i++) {
      const f = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 2.0, 6),
        new THREE.MeshStandardMaterial({ color: 0x16161c, roughness: 0.35, metalness: 0.2 })
      );
      f.visible = false;
      scene.add(f);
      this._featherPool.push(f);
    }

    this.minions = [];
    this._minionPool = [];
    for (let i = 0; i < MINION_POOL_SIZE; i++) {
      const wrap = new THREE.Group();
      const inner = models.enemy ? models.enemy.clone(true) : buildFallbackMinion();
      if (models.enemy) inner.scale.setScalar(normalizeTo(inner, MINION_SIZE));
      wrap.add(inner);
      wrap.visible = false;
      scene.add(wrap);
      this._minionPool.push(wrap);
    }

    this.active = false;
    this.phase = 0;
    this.hp = 6;
    this.maxHp = 6;
    this.encounterNumber = 0;
    this.nextSpawnDistance = FIRST_SPAWN;
    this._birdPos = null;
    this._hoverT = 0;
    this._attackTimer = 2;
    this._telegraph = 0;
    this._pending = null;
    this._swoopState = null;
    this._swoopT = 0;
    this._swoopFrom = new THREE.Vector3();
    this._swoopMid = new THREE.Vector3();
    this._swoopTo = new THREE.Vector3();
    this._invuln = 0;
    this._dyingT = 0;
    this._deathVy = 0;
    this._defeatFired = false;
    this._hitFlash = 0;
    this._minionsSpawned = 0;
  }

  reset() {
    this.group.visible = false;
    this.group.rotation.set(0, 0, 0);
    this.group.position.set(0, HOVER_Y, ENTER_Z);
    this.inner.scale.setScalar(this._baseScale);
    for (const f of this.feathers) { f.obj.visible = false; this._featherPool.push(f.obj); }
    this.feathers.length = 0;
    for (const m of this.minions) { m.obj.visible = false; this._minionPool.push(m.obj); }
    this.minions.length = 0;
    this.active = false;
    this.phase = 0;
    this.hp = 6;
    this.maxHp = 6;
    this.encounterNumber = 0;
    this.nextSpawnDistance = FIRST_SPAWN;
    this._birdPos = null;
    this._hoverT = 0;
    this._attackTimer = 2;
    this._telegraph = 0;
    this._pending = null;
    this._swoopState = null;
    this._invuln = 0;
    this._dyingT = 0;
    this._deathVy = 0;
    this._defeatFired = false;
    this._hitFlash = 0;
    this._minionsSpawned = 0;
  }

  maybeSpawn(distance, speedNow) {
    if (this.active || speedNow <= 0) return;
    if (distance >= this.nextSpawnDistance) {
      this.encounterNumber++;
      this.maxHp = 6 + 3 * (this.encounterNumber - 1);
      this.hp = this.maxHp;
      this.active = true;
      this._defeatFired = false;
      this._enter();
      this.nextSpawnDistance = distance + SPAWN_EVERY;
    }
  }

  _enter() {
    this.group.visible = true;
    this.group.position.set(0, HOVER_Y, ENTER_Z);
    this.group.rotation.set(0, 0, 0);
    this.phase = 0;
    this._hoverT = 0;
    this._attackTimer = 2;
    this._telegraph = 0;
    this._pending = null;
    this._swoopState = null;
    this._invuln = 0;
    this._dyingT = 0;
    this._deathVy = 0;
    this._hitFlash = 0;
    this._minionsSpawned = 0;
    for (const f of this.feathers) { f.obj.visible = false; this._featherPool.push(f.obj); }
    this.feathers.length = 0;
    for (const m of this.minions) { m.obj.visible = false; this._minionPool.push(m.obj); }
    this.minions.length = 0;
  }

  hit(dmg = 1) {
    if (!this.active || this.phase === 3) return false;
    this.hp -= dmg;
    this._hitFlash = 1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.phase = 3;
      this._dyingT = 0;
      this._deathVy = 0;
      this._swoopState = null;
      this._telegraph = 0;
      this._pending = null;
      return true;
    }
    if (this.phase === 1 && this.hp <= this.maxHp * ENRAGE_FRAC) {
      this.phase = 2;
      this._summonMinions();
    }
    return false;
  }

  update(dt, speed, t, birdPos) {
    if (!this.active) return;
    this._birdPos = birdPos;
    this._invuln = Math.max(0, this._invuln - dt);
    this._hitFlash = Math.max(0, this._hitFlash - dt * 3);
    this.inner.scale.setScalar(this._baseScale * (1 + this._hitFlash * 0.13));

    if (this.phase === 3) {
      this._dyingUpdate(dt, speed, birdPos);
      return;
    }
    if (this.phase === 0) {
      this._enterUpdate(dt, t, birdPos);
      return;
    }
    this._hoverUpdate(dt, t, birdPos);
  }

  _enterUpdate(dt, t, birdPos) {
    this.group.position.z = damp(this.group.position.z, HOVER_Z, 1.2, dt);
    this._weave(dt, t, 0.5);
    this._face(birdPos, dt);
    this._feathersUpdate(dt, birdPos);
    this._minionsUpdate(dt, birdPos);
    if (this.group.position.z >= HOVER_Z_MIN) {
      this.group.position.z = HOVER_Z_MIN;
      this.phase = 1;
      this._attackTimer = 1.2;
      this._summonMinions();
    }
  }

  _weave(dt, t, k) {
    this._hoverT += dt * (this.phase >= 2 ? k * 1.35 : k);
    const h = this._hoverT;
    const ampX = 4 + this.phase * 2.5;
    const tx = THREE.MathUtils.clamp(Math.sin(h * 0.55) * ampX, -HOVER_X, HOVER_X);
    const ty = THREE.MathUtils.clamp(HOVER_Y + Math.sin(h * 0.4 + 1.3) * 7, HOVER_Y_MIN, HOVER_Y_MAX);
    this.group.position.x = damp(this.group.position.x, tx, 1.5, dt);
    this.group.position.y = damp(this.group.position.y, ty, 1.3, dt);
  }

  _face(birdPos, dt) {
    if (!birdPos) return;
    const p = this.group.position;
    const yaw = Math.atan2(-(birdPos.x - p.x), -(birdPos.z - p.z));
    const pitch = THREE.MathUtils.clamp((birdPos.y - p.y) * 0.02, -0.35, 0.35);
    this.group.rotation.y = damp(this.group.rotation.y, yaw, 3, dt);
    this.group.rotation.x = damp(this.group.rotation.x, pitch, 3, dt);
    this.group.rotation.z = damp(this.group.rotation.z, 0, 3, dt);
  }

  _hoverUpdate(dt, t, birdPos) {
    this._feathersUpdate(dt, birdPos);
    this._minionsUpdate(dt, birdPos);
    if (this._swoopState) {
      this._swoopUpdate(dt, birdPos);
      return;
    }
    this._weave(dt, t, 1);
    this.group.position.z = damp(this.group.position.z, HOVER_Z, 1.2, dt);
    this._face(birdPos, dt);

    if (this._telegraph > 0) {
      this._telegraph -= dt;
      const k = Math.max(0, this._telegraph / TELEGRAPH);
      this.group.position.x += Math.sin(t * 47) * 0.28 * k;
      this.group.position.y += Math.sin(t * 61 + 2) * 0.2 * k;
      if (this._telegraph <= 0) this._execute();
      return;
    }
    this._attackTimer -= dt;
    if (this._attackTimer <= 0) {
      this._pending = this._pickAttack();
      this._telegraph = TELEGRAPH;
      this._attackTimer = this.phase >= 2 ? CADENCE_ENRAGE : CADENCE;
    }
  }

  _bodyContact(birdPos) {
    if (!birdPos) return;
    const p = this.group.position;
    const dx = birdPos.x - p.x;
    const dy = birdPos.y - p.y;
    const dz = birdPos.z - p.z;
    if (dx * dx + dy * dy + dz * dz < CONTACT_DIST * CONTACT_DIST) this._contact();
  }

  _contact() {
    if (this._invuln > 0) return;
    this._invuln = INVULN;
    this.onHitPlayer?.();
  }

  get pos() {
    return this.group.position;
  }

  _pickAttack() {
    const canSummon = this._minionPool.length >= MINION_WAVE_SIZE
      && this._minionsSpawned + MINION_WAVE_SIZE <= MINION_ENCOUNTER_CAP;
    const chance = this.phase >= 2 ? 0.65 : 0.42;
    if (canSummon && this.rng() < chance) return 'minions';
    return this.rng() < 0.45 ? 'swoop' : 'feathers';
  }

  _execute() {
    const kind = this._pending;
    this._pending = null;
    if (kind === 'swoop') this._startSwoop();
    else if (kind === 'minions') this._summonMinions();
    else this._fireFeathers();
  }

  _startSwoop() {
    const bird = this._birdPos;
    if (!bird) return;
    const p = this.group.position;
    this._swoopFrom.copy(p);
    const side = bird.x >= 0 ? -1 : 1;
    this._swoopTo.set(
      THREE.MathUtils.clamp(bird.x + side * 6.5, -LANE * 0.8, LANE * 0.8),
      THREE.MathUtils.clamp(bird.y + 2.5, 1.2, 28),
      14
    );
    const side2 = p.x >= 0 ? -1 : 1;
    this._swoopMid.set(
      THREE.MathUtils.clamp(p.x * 0.25 + side2 * 6, -HOVER_X, HOVER_X),
      THREE.MathUtils.clamp(Math.max(bird.y, p.y) + SWOOP_Y_BAND, 3, 28.5),
      (p.z + this._swoopTo.z) * 0.5
    );
    this._swoopT = 0;
    this._swoopState = 'out';
  }

  _swoopUpdate(dt, birdPos) {
    this._swoopT += dt;
    const p = this.group.position;
    if (this._swoopState === 'out') {
      const k = Math.min(1, this._swoopT / SWOOP_T);
      const e = k * k;
      this._bezier(e, p);
      this._face(birdPos, dt);
      this._bodyContact(birdPos);
      if (k >= 1) {
        this._swoopState = 'back';
        this._swoopT = 0;
        this._swoopFrom.copy(p);
      }
      return;
    }
    const k = Math.min(1, this._swoopT / SWOOP_RETURN_T);
    const e = k * k * (3 - 2 * k);
    p.set(
      this._swoopFrom.x + (0 - this._swoopFrom.x) * e,
      this._swoopFrom.y + (HOVER_Y - this._swoopFrom.y) * e,
      this._swoopFrom.z + (HOVER_Z - this._swoopFrom.z) * e
    );
    this._face(birdPos, dt);
    this._bodyContact(birdPos);
    if (k >= 1) this._swoopState = null;
  }

  _bezier(e, out) {
    const u = 1 - e;
    out.set(
      u * u * this._swoopFrom.x + 2 * u * e * this._swoopMid.x + e * e * this._swoopTo.x,
      u * u * this._swoopFrom.y + 2 * u * e * this._swoopMid.y + e * e * this._swoopTo.y,
      u * u * this._swoopFrom.z + 2 * u * e * this._swoopMid.z + e * e * this._swoopTo.z
    );
  }

  _fireFeathers() {
    const bird = this._birdPos;
    if (!bird) return;
    let n = 3 + Math.floor(this.rng() * 3);
    if (this.phase >= 2) n++;
    const p = this.group.position;
    for (let i = 0; i < n; i++) {
      if (!this._featherPool.length) break;
      const obj = this._featherPool.pop();
      obj.visible = true;
      obj.position.copy(p);
      const spread = (i - (n - 1) / 2) * 1.2;
      const target = new THREE.Vector3(
        THREE.MathUtils.clamp(bird.x + spread, -LANE, LANE),
        THREE.MathUtils.clamp(bird.y + (this.rng() - 0.5) * 1.6, 0.5, 29.5),
        bird.z
      );
      const dir = target.sub(p).normalize();
      obj.quaternion.setFromUnitVectors(UP, dir);
      this.feathers.push({
        obj,
        vel: dir.clone().multiplyScalar(FEATHER_SPEED),
        life: FEATHER_LIFE,
        hit: false,
        spin: 5 + this.rng() * 7,
      });
    }
  }

  _feathersUpdate(dt, birdPos) {
    for (let i = this.feathers.length - 1; i >= 0; i--) {
      const f = this.feathers[i];
      f.life -= dt;
      f.obj.position.addScaledVector(f.vel, dt);
      f.obj.rotateY(f.spin * dt);
      if (birdPos && !f.hit) {
        const dx = birdPos.x - f.obj.position.x;
        const dy = birdPos.y - f.obj.position.y;
        const dz = birdPos.z - f.obj.position.z;
        if (dx * dx + dy * dy + dz * dz < FEATHER_HIT_SQ) {
          f.hit = true;
          this._contact();
        }
      }
      const behind = birdPos ? f.obj.position.z > birdPos.z + 6 : f.obj.position.z > 10;
      if (f.life <= 0 || behind) {
        f.obj.visible = false;
        this._featherPool.push(f.obj);
        this.feathers.splice(i, 1);
      }
    }
  }

  _summonMinions() {
    const bird = this._birdPos;
    if (!bird || this._minionsSpawned >= MINION_ENCOUNTER_CAP) return;
    const p = this.group.position;
    const offsets = [-7, 0, 7];
    for (let i = 0; i < MINION_WAVE_SIZE; i++) {
      if (!this._minionPool.length) break;
      const obj = this._minionPool.pop();
      obj.visible = true;
      obj.position.set(p.x + offsets[i] * 0.55, p.y + (i === 1 ? 0 : -1.8), p.z + (i === 1 ? 0.5 : 1));
      const target = new THREE.Vector3(
        THREE.MathUtils.clamp(bird.x + offsets[i], -LANE, LANE),
        THREE.MathUtils.clamp(bird.y + (i === 1 ? 0 : 1.5), 1, 28),
        14
      );
      const vel = target.sub(obj.position).normalize().multiplyScalar(MINION_SPEED);
      this.minions.push({ obj, vel, life: MINION_LIFE, spin: (i === 0 ? -1 : 1) * (2 + this.rng() * 2) });
      this._minionsSpawned++;
    }
  }

  tryMinionBallHit(ball, radius, onKill) {
    const p1 = ball.obj.position;
    const p0 = ball.prevPos || p1;
    const vx = p1.x - p0.x, vy = p1.y - p0.y, vz = p1.z - p0.z;
    const vv = vx * vx + vy * vy + vz * vz;
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const m = this.minions[i];
      const q = m.obj.position;
      let u = vv > 1e-6 ? ((q.x - p0.x) * vx + (q.y - p0.y) * vy + (q.z - p0.z) * vz) / vv : 0;
      u = Math.max(0, Math.min(1, u));
      const dx = p0.x + vx * u - q.x;
      const dy = p0.y + vy * u - q.y;
      const dz = p0.z + vz * u - q.z;
      const rr = MINION_HIT_R + radius;
      if (dx * dx + dy * dy + dz * dz > rr * rr) continue;
      const pos = q.clone();
      m.obj.visible = false;
      this._minionPool.push(m.obj);
      this.minions.splice(i, 1);
      onKill?.(pos);
      return true;
    }
    return false;
  }

  _minionsUpdate(dt, birdPos) {
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const m = this.minions[i];
      m.life -= dt;
      m.obj.position.addScaledVector(m.vel, dt);
      m.obj.rotation.y += m.spin * dt;
      if (birdPos) {
        const dx = birdPos.x - m.obj.position.x;
        const dy = birdPos.y - m.obj.position.y;
        const dz = birdPos.z - m.obj.position.z;
        if (dx * dx + dy * dy + dz * dz < MINION_CONTACT_SQ) {
          this._contact();
          m.obj.visible = false;
          this._minionPool.push(m.obj);
          this.minions.splice(i, 1);
          continue;
        }
      }
      const gone = birdPos ? m.obj.position.z > birdPos.z + 8 : m.obj.position.z > 12;
      if (m.life <= 0 || gone) {
        m.obj.visible = false;
        this._minionPool.push(m.obj);
        this.minions.splice(i, 1);
      }
    }
  }

  _dyingUpdate(dt, speed, birdPos) {
    this._dyingT += dt;
    this._deathVy += TUMBLE_GRAV * dt;
    this.group.rotation.x += 5.2 * dt;
    this.group.rotation.z += 3.4 * dt;
    this.group.position.y -= this._deathVy * dt;
    this.group.position.z += Math.min(10, speed * 0.3 + 4) * dt;
    this._feathersUpdate(dt, birdPos);
    this._minionsUpdate(dt, birdPos);
    if (this.group.position.y < KILL_Y || this._dyingT >= TUMBLE_TIME) {
      for (const f of this.feathers) { f.obj.visible = false; this._featherPool.push(f.obj); }
      this.feathers.length = 0;
      for (const m of this.minions) { m.obj.visible = false; this._minionPool.push(m.obj); }
      this.minions.length = 0;
      this.active = false;
      this.group.visible = false;
      this.group.rotation.set(0, 0, 0);
      if (!this._defeatFired) {
        this._defeatFired = true;
        this.onDefeat?.({ pos: this.group.position.clone() });
      }
    }
  }
}
