import * as THREE from 'three';

const TRAIL_MAX = 400;
const DEBRIS_MAX = 60;

function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    const dot = makeDotTexture();
    this.dot = dot;
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
    this.trailGeo = trailGeo;
    const trailMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.55, transparent: true, opacity: 0.5,
      depthWrite: false, sizeAttenuation: true, map: dot
    });
    this.trail = new THREE.Points(trailGeo, trailMat);
    this.trail.frustumCulled = false;
    scene.add(this.trail);
    this.trailN = 0;
    this.trailP = new Float32Array(TRAIL_MAX * 3);
    this.trailV = new Float32Array(TRAIL_MAX * 3);
    this.trailLife = new Float32Array(TRAIL_MAX);

    const debrisGeo = new THREE.BufferGeometry();
    debrisGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DEBRIS_MAX * 3), 3));
    this.debrisGeo = debrisGeo;
    const debrisMat = new THREE.PointsMaterial({
      color: 0xffd23f, size: 0.8, transparent: true, opacity: 0.9, depthWrite: false, map: dot
    });
    this.debris = new THREE.Points(debrisGeo, debrisMat);
    this.debris.frustumCulled = false;
    scene.add(this.debris);
    this.debrisN = 0;
    this.debrisP = new Float32Array(DEBRIS_MAX * 3);
    this.debrisV = new Float32Array(DEBRIS_MAX * 3);
    this.debrisLife = new Float32Array(DEBRIS_MAX);

    this.sparkles = [];
  }

  spawnTrail(x, y, z, vx, vy) {
    if (this.trailN >= TRAIL_MAX) return;
    const i = this.trailN++;
    this.trailP[i * 3] = x;
    this.trailP[i * 3 + 1] = y;
    this.trailP[i * 3 + 2] = z;
    this.trailV[i * 3] = vx;
    this.trailV[i * 3 + 1] = vy;
    this.trailV[i * 3 + 2] = 6;
    this.trailLife[i] = 0.7;
  }

  spawnDebris(x, y, z) {
    const n = Math.min(DEBRIS_MAX - this.debrisN, 26);
    for (let k = 0; k < n; k++) {
      const i = this.debrisN++;
      this.debrisP[i * 3] = x;
      this.debrisP[i * 3 + 1] = y;
      this.debrisP[i * 3 + 2] = z;
      this.debrisV[i * 3] = (Math.random() - 0.5) * 14;
      this.debrisV[i * 3 + 1] = Math.random() * 10;
      this.debrisV[i * 3 + 2] = 4 + Math.random() * 8;
      this.debrisLife[i] = 1.1 + Math.random() * 0.4;
    }
  }

  coinSparkle(pos) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0xffe9a3, transparent: true, opacity: 0.9, depthWrite: false
    }));
    s.scale.setScalar(1.6);
    s.position.copy(pos);
    this.scene.add(s);
    this.sparkles.push({ s, t: 0 });
  }

  update(dt, worldSpeed) {
    const tp = this.trailGeo.attributes.position.array;
    for (let i = this.trailN - 1; i >= 0; i--) {
      this.trailLife[i] -= dt;
      if (this.trailLife[i] <= 0) {
        this._swapRemove(i, this.trailN, this.trailP, this.trailV, this.trailLife, 1e6);
        this.trailN--;
        continue;
      }
      this.trailV[i * 3 + 1] -= 2 * dt;
      this.trailP[i * 3] += this.trailV[i * 3] * dt;
      this.trailP[i * 3 + 1] += this.trailV[i * 3 + 1] * dt;
      this.trailP[i * 3 + 2] += (this.trailV[i * 3 + 2] + worldSpeed) * dt;
      tp[i * 3] = this.trailP[i * 3];
      tp[i * 3 + 1] = this.trailP[i * 3 + 1];
      tp[i * 3 + 2] = this.trailP[i * 3 + 2];
    }
    this.trailGeo.setDrawRange(0, this.trailN);
    this.trailGeo.attributes.position.needsUpdate = true;

    const dp = this.debrisGeo.attributes.position.array;
    for (let i = this.debrisN - 1; i >= 0; i--) {
      this.debrisLife[i] -= dt;
      if (this.debrisLife[i] <= 0) {
        this._swapRemove(i, this.debrisN, this.debrisP, this.debrisV, this.debrisLife, 1e6);
        this.debrisN--;
        dp[(this.debrisN) * 3] = 1e6;
        continue;
      }
      this.debrisV[i * 3 + 1] -= 22 * dt;
      this.debrisP[i * 3] += this.debrisV[i * 3] * dt;
      this.debrisP[i * 3 + 1] += this.debrisV[i * 3 + 1] * dt;
      this.debrisP[i * 3 + 2] += (this.debrisV[i * 3 + 2] + worldSpeed) * dt;
      dp[i * 3] = this.debrisP[i * 3];
      dp[i * 3 + 1] = this.debrisP[i * 3 + 1];
      dp[i * 3 + 2] = this.debrisP[i * 3 + 2];
    }
    this.debrisGeo.setDrawRange(0, this.debrisN);
    this.debrisGeo.attributes.position.needsUpdate = true;

    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const sp = this.sparkles[i];
      sp.t += dt;
      sp.s.position.z += worldSpeed * dt;
      sp.s.scale.setScalar(1.6 + sp.t * 3);
      sp.s.material.opacity = Math.max(0, 0.9 * (1 - sp.t / 0.5));
      if (sp.t > 0.5) {
        this.scene.remove(sp.s);
        sp.s.material.dispose();
        this.sparkles.splice(i, 1);
      }
    }
  }

  _swapRemove(i, n, P, V, L, hide) {
    const last = n - 1;
    if (i !== last) {
      for (let c = 0; c < 3; c++) {
        P[i * 3 + c] = P[last * 3 + c];
        V[i * 3 + c] = V[last * 3 + c];
      }
      L[i] = L[last];
    }
    L[last] = 0;
    P[last * 3] = hide;
    P[last * 3 + 1] = hide;
    P[last * 3 + 2] = hide;
  }

  reset() {
    this.trailN = 0;
    this.debrisN = 0;
    this.trailGeo.setDrawRange(0, 0);
    this.debrisGeo.setDrawRange(0, 0);
    for (const sp of this.sparkles) {
      this.scene.remove(sp.s);
      sp.s.material.dispose();
    }
    this.sparkles.length = 0;
  }
}