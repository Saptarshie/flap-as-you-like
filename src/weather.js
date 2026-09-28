import * as THREE from 'three';
import { CFG } from './config.js';
import { damp, lerp, valueNoise2D } from './utils.js';

const RAIN_COUNT = 1200;
const RAIN_BOX_W = 90;
const RAIN_AHEAD = 85;
const RAIN_BEHIND = 30;
const RAIN_TOP = 22;
const RAIN_TOP_RAND = 8;
const RAIN_FALL_MIN = 30;
const RAIN_FALL_MAX = 46;
const RAIN_OPACITY = 0.5;
const RAIN_SIZE = 1.7;
const RAIN_TILT = 0.38;
const WIND_DRIFT = 6;
const STORM_LERP = 1.8;
const STORM_SKY = 0x6b7f95;
const FOG_NEAR_STORM = 45;
const FOG_FAR_STORM = 180;
const LIGHTNING_THRESHOLD = 0.55;
const LIGHTNING_RATE = 0.25;
const FLASH_DUR = 0.25;
const FLASH_PEAK = 14;
const LIGHTNING_COLOR = 0xdfe8ff;

const _tmp = new THREE.Color();
const _storm = new THREE.Color(STORM_SKY);

function makeStreakTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.translate(32, 32);
  ctx.rotate(-RAIN_TILT);
  const grad = ctx.createLinearGradient(0, -28, 0, 28);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.3)');
  grad.addColorStop(0.8, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0.95)');
  ctx.fillStyle = grad;
  ctx.fillRect(-3.5, -28, 7, 56);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function _flashEnvelope(p) {
  const g = (c, w) => {
    const d = (p - c) / w;
    return Math.exp(-d * d);
  };
  return g(0.10, 0.085) + 0.55 * g(0.45, 0.075) + 0.22 * g(0.75, 0.07);
}

export class Weather {
  constructor(scene, camera = null) {
    this.scene = scene;
    this.cam = camera;
    this._cam = camera || null;
    this._camSearched = false;
    this.onLightning = null;

    this.stormLevel = 0;
    this._override = null;
    this._flashT = 0;
    this._flashStrength = 1;

    this._bgState = { saved: new THREE.Color(), written: new THREE.Color(), owned: false };
    this._fogState = { saved: new THREE.Color(), written: new THREE.Color(), owned: false };
    this._fogOwned = false;
    this._fogNearBase = CFG.world.fogNear;
    this._fogFarBase = CFG.world.fogFar;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN_COUNT * 3), 3));
    this.rainGeo = geo;
    this.streakTex = makeStreakTexture();
    this.rainMat = new THREE.PointsMaterial({
      color: 0xaac9e8, size: RAIN_SIZE, map: this.streakTex,
      transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true
    });
    this.rain = new THREE.Points(geo, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 2;
    scene.add(this.rain);
    this._fall = new Float32Array(RAIN_COUNT);

    this.light = new THREE.DirectionalLight(LIGHTNING_COLOR, 0);
    this.light.position.set(30, 70, -50);
    scene.add(this.light);

    this._seed();
  }

  _seed() {
    const P = this.rainGeo.attributes.position.array;
    for (let i = 0; i < RAIN_COUNT; i++) {
      P[i * 3] = (Math.random() * 2 - 1) * (RAIN_BOX_W * 0.5);
      P[i * 3 + 1] = 10 + Math.random() * (RAIN_TOP + RAIN_TOP_RAND);
      P[i * 3 + 2] = -RAIN_AHEAD + Math.random() * (RAIN_AHEAD + RAIN_BEHIND);
      this._fall[i] = RAIN_FALL_MIN + Math.random() * (RAIN_FALL_MAX - RAIN_FALL_MIN);
    }
    this.rainGeo.attributes.position.needsUpdate = true;
  }

  _camera() {
    if (this.cam) return this.cam;
    if (!this._camSearched) {
      this._camSearched = true;
      this.scene.traverse((o) => {
        if (!this._cam && o.isCamera) this._cam = o;
      });
    }
    return this._cam;
  }

  _blendTo(color, target, t, st) {
    if (t <= 0) {
      if (st.owned) {
        color.copy(st.saved);
        st.owned = false;
      } else if (!color.equals(st.saved)) {
        st.saved.copy(color);
      }
      return;
    }
    if (!st.owned || !color.equals(st.written)) st.saved.copy(color);
    _tmp.copy(st.saved).lerp(target, t);
    color.copy(_tmp);
    st.written.copy(_tmp);
    st.owned = true;
  }

  setStorm(level) {
    this._override = level == null ? null : Math.max(0, Math.min(1, level));
  }

  flashLightning(strength = 1) {
    this._flashT = FLASH_DUR;
    this._flashStrength = strength;
    if (this.onLightning) this.onLightning(strength);
  }

  windGust(t = 0) {
    const g = (valueNoise2D(t * 0.6, 4.17) - 0.5) * 2
      + (valueNoise2D(t * 1.9, 11.7) - 0.5) * 0.8;
    return Math.max(-1, Math.min(1, g));
  }

  update(dt, speed = 0, stormLevel = 0, t = 0) {
    const target = this._override != null ? this._override : (stormLevel || 0);
    this.stormLevel = damp(this.stormLevel, target, STORM_LERP, dt);
    const s = this.stormLevel;

    if (this._flashT > 0) {
      this._flashT -= dt;
      if (this._flashT <= 0) {
        this._flashT = 0;
        this.light.intensity = 0;
      } else {
        const p = 1 - this._flashT / FLASH_DUR;
        this.light.intensity = Math.max(0, FLASH_PEAK * this._flashStrength * _flashEnvelope(p));
      }
    } else {
      this.light.intensity = 0;
      if (s > LIGHTNING_THRESHOLD && Math.random() < s * LIGHTNING_RATE * dt) {
        this.flashLightning(0.55 + s * 0.45);
      }
    }

    const fog = this.scene.fog;
    if (fog) {
      this._blendTo(fog.color, _storm, s, this._fogState);
      if (s > 0) {
        if (!this._fogOwned) {
          this._fogNearBase = fog.near;
          this._fogFarBase = fog.far;
          this._fogOwned = true;
        }
        fog.near = lerp(this._fogNearBase, FOG_NEAR_STORM, s);
        fog.far = lerp(this._fogFarBase, FOG_FAR_STORM, s);
      } else if (this._fogOwned) {
        fog.near = this._fogNearBase;
        fog.far = this._fogFarBase;
        this._fogOwned = false;
      }
    }
    const bg = this.scene.background;
    if (bg && bg.isColor) this._blendTo(bg, _storm, s, this._bgState);

    const n = (s * RAIN_COUNT) | 0;
    this.rain.visible = n > 0;
    this.rainMat.opacity = RAIN_OPACITY * Math.min(1, s * 1.5);
    if (!this.rain.visible) return;

    const cam = this._camera();
    const cx = cam ? cam.position.x : 0;
    const cy = cam ? cam.position.y : 16;
    const cz = cam ? cam.position.z : 24;
    const P = this.rainGeo.attributes.position.array;
    const HW = RAIN_BOX_W * 0.5;
    const zSpan = RAIN_AHEAD + RAIN_BEHIND;
    const gust = this.windGust(t) * WIND_DRIFT;
    const floorY = CFG.world.floorY - 2;

    for (let i = 0; i < n; i++) {
      const k = i * 3;
      let x = P[k] + gust * dt;
      let y = P[k + 1] - this._fall[i] * dt;
      let z = P[k + 2] + speed * dt;
      if (z > cz + RAIN_BEHIND) z -= zSpan;
      else if (z < cz - RAIN_AHEAD) z += zSpan;
      if (x < cx - HW) x += RAIN_BOX_W;
      else if (x > cx + HW) x -= RAIN_BOX_W;
      if (y < floorY) {
        y = cy + RAIN_TOP + Math.random() * RAIN_TOP_RAND;
        x = cx + (Math.random() * 2 - 1) * HW;
        z = cz - Math.random() * RAIN_AHEAD;
        this._fall[i] = RAIN_FALL_MIN + Math.random() * (RAIN_FALL_MAX - RAIN_FALL_MIN);
      }
      P[k] = x;
      P[k + 1] = y;
      P[k + 2] = z;
    }
    this.rainGeo.setDrawRange(0, n);
    this.rainGeo.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.rain);
    this.scene.remove(this.light);
    this.rainGeo.dispose();
    this.rainMat.dispose();
    this.streakTex.dispose();
  }
}
