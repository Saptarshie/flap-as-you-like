import * as THREE from 'three';
import { terrainHeight, valueNoise2D, mulberry32 } from './utils.js';

const SEG = 60;
const WORLD = 560;
const H = WORLD / 2;

function bandColor(h, x, z, slope, out) {
  if (h < -2.6) {
    out[0] = 0.85; out[1] = 0.77; out[2] = 0.54;
  } else if (h > 11) {
    out[0] = 0.95; out[1] = 0.97; out[2] = 0.98;
  } else if (h > 5.5 || slope > 0.7) {
    const strata = valueNoise2D(x * 0.13 + 8, z * 0.13 - 9);
    out[0] = 0.55 + strata * 0.2; out[1] = 0.48 + strata * 0.13; out[2] = 0.42 + strata * 0.1;
  } else {
    const n = valueNoise2D(x * 0.05 + 31, z * 0.05 - 17);
    const patch = valueNoise2D(x * 0.17 - 11, z * 0.17 + 23);
    out[0] = 0.27 + n * 0.11 + patch * 0.04;
    out[1] = 0.55 + n * 0.14 + patch * 0.05;
    out[2] = 0.21 + n * 0.08;
  }
  return out;
}

function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const rng = mulberry32(48391);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    const x = rng() * 256, y = rng() * 256, r = 8 + rng() * 30;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const v = 175 + Math.floor(rng() * 60);
    grad.addColorStop(0, 'rgba(' + v + ',' + v + ',' + v + ',0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad; ctx.fillRect(x-r, y-r, r*2, r*2);
  }
  for (let i = 0; i < 2200; i++) {
    const v = 135 + Math.floor(rng() * 110);
    ctx.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.12 + rng() * 0.25) + ')';
    const x = rng() * 256, y = rng() * 256;
    ctx.fillRect(x, y, 0.5 + rng() * 2.5, 0.5 + rng() * 3.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(34, 34);
  return tex;
}

function makeWaterTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#78b9c8'; ctx.fillRect(0, 0, 128, 128);
  const rng = mulberry32(1187);
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = 'rgba(220,245,250,' + (0.08 + rng() * 0.16) + ')';
    ctx.beginPath();
    const x = rng() * 128, y = rng() * 128;
    ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 7, y - 2, x + 15 + rng() * 14, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  return tex;
}

export class Terrain {
  constructor(scene) {
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true, map: makeGroundTexture(),
      roughness: 0.95, metalness: 0, flatShading: true
    });
    this.tiles = [];
    this._c = [0, 0, 0];
    for (let i = 0; i < 2; i++) {
      const geo = new THREE.PlaneGeometry(WORLD, WORLD, SEG, SEG);
      geo.rotateX(-Math.PI / 2);
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.receiveShadow = true;
      scene.add(mesh);
      this.tiles.push({ mesh, worldZ: 0, bakedZ: 0 });
    }
    this.tiles[0].worldZ = -60;
    this.tiles[0].bakedZ = -60;
    this.tiles[1].worldZ = -60 - WORLD;
    this.tiles[1].bakedZ = -60 - WORLD;
    this.tiles[0].mesh.position.z = this.tiles[0].worldZ;
    this.tiles[1].mesh.position.z = this.tiles[1].worldZ;
    this._fill(this.tiles[0]);
    this._fill(this.tiles[1]);
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshStandardMaterial({
        color: 0x49b8e6, map: makeWaterTexture(), transparent: true, opacity: 0.82, roughness: 0.22, metalness: 0.03
      })
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -3.2;
    scene.add(this.water);
  }

  _fill(tile) {
    const pos = tile.mesh.geometry.attributes.position;
    const col = tile.mesh.geometry.attributes.color;
    const bz = tile.bakedZ;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const localZ = pos.getZ(i);
      const z = localZ + bz;
      const h = terrainHeight(x, z);
      const sx = terrainHeight(x + 1.5, z) - terrainHeight(x - 1.5, z);
      const sz = terrainHeight(x, z + 1.5) - terrainHeight(x, z - 1.5);
      const slope = Math.sqrt(sx * sx + sz * sz) / 3;
      pos.setY(i, h);
      bandColor(h, x, z, slope, this._c);
      col.setXYZ(i, this._c[0], this._c[1], this._c[2]);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    tile.mesh.geometry.computeVertexNormals();
  }

  update(dt, speed, birdX, birdZ) {
    for (const t of this.tiles) {
      t.mesh.position.z += speed * dt;
      t.worldZ = t.mesh.position.z;
    }
    for (const t of this.tiles) {
      if (t.worldZ - H > 80) {
        const other = this.tiles[0] === t ? this.tiles[1] : this.tiles[0];
        t.worldZ = other.worldZ - WORLD;
        t.bakedZ = other.bakedZ - WORLD;
        t.mesh.position.z = t.worldZ;
        this._fill(t);
      }
    }
    this.water.position.z += speed * dt;
    if (this.water.material.map) {
      this.water.material.map.offset.x += dt * 0.006;
      this.water.material.map.offset.y -= dt * 0.012;
    }
    if (this.water.position.z > 500) this.water.position.z -= 1000;
  }

  reset() {
    this.tiles[0].worldZ = -60;
    this.tiles[0].bakedZ = -60;
    this.tiles[1].worldZ = -60 - WORLD;
    this.tiles[1].bakedZ = -60 - WORLD;
    for (const t of this.tiles) {
      t.mesh.position.z = t.worldZ;
      this._fill(t);
    }
    this.water.position.z = 0;
  }

  groundHeightAt(x, z = 0) {
    for (const t of this.tiles) {
      const localZ = z - t.worldZ;
      if (Math.abs(localZ) <= H) {
        return terrainHeight(x, localZ + t.bakedZ);
      }
    }
    return 0;
  }
}
