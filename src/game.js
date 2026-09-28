import * as THREE from 'three';
import { GLTFLoader } from '../lib/loaders/GLTFLoader.js';
import { CFG } from './config.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Player } from './player.js';
import { Terrain } from './terrain.js';
import { Scenery } from './scenery.js';
import { Obstacles } from './obstacles.js';
import { Effects } from './effects.js';
import { UI } from './ui.js';
import { Combat } from './combat.js';
import { Enemies } from './enemies.js';
import { Tornados } from './tornado.js';
import { Powerups } from './powerups.js';
import { Weather } from './weather.js';
import { BonusZone } from './bonus.js';
import { Boss } from './boss.js';
import { Landmarks } from './landmarks.js';
import { Leaderboard } from './leaderboard.js';
import { damp, terrainHeight, smoothstep } from './utils.js';

const MODEL_FILES = {
  bird: 'assets/bird.glb',
  treePine: 'assets/treePine.glb',
  treeRound: 'assets/treeRound.glb',
  rockA: 'assets/rockA.glb',
  rockSpire: 'assets/rockSpire.glb',
  balloon: 'assets/balloon.glb',
  cloud: 'assets/cloud.glb',
  ring: 'assets/ring.glb',
  coin: 'assets/coin.glb',
  enemy: 'assets/enemy.glb',
  tornado: 'assets/tornado.glb',
  potionSpeed: 'assets/potionSpeed.glb',
  potionShield: 'assets/potionShield.glb',
  gem: 'assets/gem.glb',
  portal: 'assets/portal.glb',
  bossBird: 'assets/bossBird.glb',
  mountain: 'assets/mountain.glb',
  arch: 'assets/arch.glb',
  tunnel: 'assets/tunnel.glb',
  crystal: 'assets/crystal.glb',
  waterfall: 'assets/waterfall.glb',
  birdFlock: 'assets/birdFlock.glb',
  enemyBlue: 'assets/enemyBlue.glb',
  enemyBomb: 'assets/enemyBomb.glb',
};

const STATE = { MENU: 0, READY: 1, PLAY: 2, DYING: 3, OVER: 4, BONUS: 5 };

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderRatio = Math.min(devicePixelRatio, 'ontouchstart' in window ? 1 : 1.25);
    this.renderer.setPixelRatio(this.renderRatio);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CFG.colors.sky);
    this.scene.fog = new THREE.Fog(CFG.colors.fog, CFG.world.fogNear, CFG.world.fogFar);

    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
    this.camera.position.set(0, 16, 24);
    this.camera.lookAt(0, 12, -20);

    this.clock = new THREE.Clock();
    this.state = STATE.MENU;
    this.models = {};
    this.input = new Input();
    this.audio = new Audio();
    this.ui = new UI();
    this.lb = new Leaderboard('flappy3d_board_v1');
    this.score = 0;
    this.coins = 0;
    this.bossKills = 0;
    this.speed = CFG.difficulty.speedStart;
    this.distance = 0;
    this.turbulence = 0;
    this.gap = CFG.difficulty.gapStart;
    this.obstacleSpacing = 55;
    this.deathT = 0;
    this.camShake = 0;
    this.time = 0;
    this.nextTornadoAt = CFG.difficulty.tornadoStart;
    this.nextEnemyAt = CFG.difficulty.enemyStart;
    this.nextPotionAt = 0;
    this.nextPortalAt = CFG.difficulty.portalEvery;
    this.nextMilestoneAt = CFG.difficulty.milestoneEvery;
    this._milestoneIdx = 0;
    this.stormPinned = false;
    this.multiplier = 1;
    this.multTime = 0;
    this.noDeath = false;
    this._stormTarget = 0;
    this.bossCorridorActive = false;
    this._frameMs = 16.7;
    this._slowFramesT = 0;
    this._qualityReduced = false;
    this._lastFrameAt = 0;
    this._boundFrame = (ts) => this._frame(ts);

    this._buildWorld();
    this.bloom = { enabled: false };
    this._bindEvents();
  }

  async loadAssets() {
    const loader = new GLTFLoader();
    const names = Object.keys(MODEL_FILES);
    const glbs = await Promise.all(names.map(n => new Promise((resolve) => {
      loader.load(MODEL_FILES[n], (gltf) => resolve({ name: n, scene: gltf.scene }), undefined, () => {
        console.warn('asset failed: ' + MODEL_FILES[n]);
        resolve(null);
      });
    })));
    for (const g of glbs) {
      if (!g) continue;
      g.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = false;
          o.receiveShadow = false;
        }
      });
      this.models[g.name] = g.scene;
    }
    this._initGameplay();
  }

  _initGameplay() {
    this.scenery = new Scenery(this.scene, this.models);
    this.scenery.reset();
    this.obstacles = new Obstacles(this.scene, this.models);
    this.combat = new Combat(this.scene);
    this.enemies = new Enemies(this.scene, this.models);
    this.tornados = new Tornados(this.scene, this.models);
    this.powerups = new Powerups(this.scene, this.models);
    this.weather = new Weather(this.scene, this.camera);
    this.bonus = new BonusZone(this.scene, this.models);
    this.boss = new Boss(this.scene, this.models);
    this.landmarks = new Landmarks(this.scene, this.models, {
      onCrash: (kind) => this.damagePlayer(kind),
      onEnterTunnel: () => { this.audio.tunnelHum(true); this.ui.setHint('Cave passage!'); },
      onExitTunnel: () => this.audio.tunnelHum(false),
      onTunnelPass: () => { this.addScore(CFG.score.tunnelPass); this.audio.portal(); },
      onClearSpan: (z0, z1) => this.obstacles.clearSpan(z0, z1),
    });
    this.obstacles.isBlocked = (z) => this.landmarks.blockedAt(z);
    if (!this.models.bird) this.models.bird = this._buildFallbackBird();
    this.player = new Player(this.scene, this.models);
    this.player.mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.boss.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.player.mesh.visible = false;
    this._bindGameplay();
  }

  _buildWorld() {
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const sun = new THREE.DirectionalLight(0xfff3d9, 2.2);
    sun.position.set(-30, 55, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512);
    sun.shadow.camera.left = -55;
    sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 55;
    sun.shadow.camera.bottom = -55;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 260;
    sun.shadow.bias = -0.0015;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0xd8c8a8, 0.95);
    this.scene.add(hemi);
    this.sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(14, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff2cc, fog: false })
    );
    this.sunMesh.position.set(-140, 150, -320);
    this.scene.add(this.sunMesh);

    this.terrain = new Terrain(this.scene);
    this.effects = new Effects(this.scene);

    this._buildFallbackBird();
  }

  _buildFallbackBird() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.6 }));
    body.scale.set(0.85, 0.8, 1.1);
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 9),
      new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.6 }));
    head.position.set(0, 0.45, -0.6);
    g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0xff8c42, roughness: 0.5 }));
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, 0.4, -1.1);
    g.add(beak);
    const mkWing = (side) => {
      const pivot = new THREE.Group();
      pivot.name = side < 0 ? 'WingL' : 'WingR';
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 7),
        new THREE.MeshStandardMaterial({ color: 0xffb347, roughness: 0.65 }));
      w.scale.set(1.25, 0.15, 0.6);
      w.position.x = side * 0.9;
      pivot.position.set(side * 0.5, 0.15, 0.05);
      pivot.add(w);
      return pivot;
    };
    g.add(mkWing(1), mkWing(-1));
    this.fallbackBird = g;
  }

  _bindEvents() {
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    this.input.onAction = (code) => {
      this.audio.ensure();
      if (code === 'KeyM') {
        this.audio.setEnabled(!this.audio.enabled);
        this.ui.setHint(this.audio.enabled ? 'Sound on' : 'Sound off');
      }
      if (/^Digit[1-9]$/.test(code)) {
        this.setFlapLevel(Number(code.slice(5)));
      }
      if (this.state === STATE.MENU || this.state === STATE.OVER) {
        if (code === 'Touch' || code === 'Space' || code === 'ArrowUp' || code === 'Enter') {
          this.startRun();
        }
      } else if (this.state === STATE.READY) {
        if (code === 'Touch' || code === 'ArrowUp' || code === 'KeyW' || code === 'Space') {
          this.state = STATE.PLAY;
          this.ui.setHint('');
        }
      }
    };
    this.input.onGlide = (on) => {
      if (this.state === STATE.PLAY || this.state === STATE.BONUS) {
        this.player.gliding = on;
        this.audio.swoosh();
      }
    };
    if ('ontouchstart' in window) {
      document.getElementById('touchUI').classList.remove('hidden');
      document.getElementById('btnShoot').addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.audio.ensure();
        this.input.requestShoot();
      });
      document.getElementById('btnGlide').addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.audio.ensure();
        this.input.toggleGlide();
      });
    }
  }

  _bindGameplay() {
    this.obstacles.onGatePass = () => {
      this.addScore(CFG.score.obstaclePass);
      this.audio.swoosh();
    };
    this.obstacles.onRing = () => {
      this.addScore(CFG.score.ringPass);
      this.ui.flashRing();
    };
    this.obstacles.onCoin = (pos) => {
      this.coins += 1;
      this.addScore(CFG.score.coinValue * this.multiplier);
      this.effects.coinSparkle(pos);
      this.audio.coin();
    };
    this.obstacles.onCrash = (kind) => this.damagePlayer(kind);
    this.enemies.onHitPlayer = (kind, pos) => this.damagePlayer(kind, pos);
    this.powerups.onPickup = (kind, pos) => {
      if (kind === 'speed') {
        this.player.speedBoost = CFG.powerups.speedBoost;
        this.audio.potion();
        this.ui.setHint('Speed boost!');
      } else if (kind === 'shield') {
        this.player.shield = CFG.powerups.shield;
        this.audio.heal();
        this.ui.setHint('Shield up!');
      } else if (kind === 'gem') {
        this.multiplier = CFG.score.gemMultiplier;
        this.multTime = CFG.powerups.gemMultiplier;
        this.audio.pickup();
        this.ui.setHint('x2 score!');
      }
      this.effects.coinSparkle(pos);
    };
    this.boss.onHitPlayer = () => this.damagePlayer('boss');
    this.boss.onDefeat = (info) => {
      this.bossKills += 1;
      this.addScore(CFG.score.bossKill);
      this.audio.pop();
      this.effects.spawnDebris(info.pos.x, info.pos.y, info.pos.z);
      this.ui.setHint('MEGA BEAK defeated!');
      this.camShake = 1;
    };
    this.bonus.onCollect = (kind, pos) => {
      if (kind === 'coin') {
        this.coins += 1;
        this.addScore(CFG.score.coinValue * this.multiplier);
        this.audio.coin();
      } else if (kind === 'gem') {
        this.multiplier = CFG.score.gemMultiplier;
        this.multTime = CFG.powerups.gemMultiplier;
        this.audio.pickup();
      } else if (kind === 'ring') {
        this.addScore(CFG.score.ringPass);
        this.audio.ring();
      }
      this.effects.coinSparkle(pos);
    };
  }

  setFlapLevel(n) {
    const L = Math.min(9, Math.max(1, n | 0));
    if (this.player) this.player.flapLevel = L;
    this.ui.setReadout(null, L);
    this.ui.setHint('Flap power ' + L + (L === 5 ? ' (default)' : L < 5 ? ' (gentle)' : ' (strong)'));
  }

  addScore(n) {
    this.score += n;
    this.ui.setHUD(this.score, this.coins, this.speed * 3.6);
    this.ui.popScore();
  }

  damagePlayer(kind, pos) {
    if (this.noDeath) return;
    if (this.state !== STATE.PLAY && this.state !== STATE.BONUS) return;
    if (this.player.shield > 0) {
      if (pos) this.effects.coinSparkle(pos);
      this.audio.ping(950, 0.2, 0.2, 'triangle');
      this.ui.setHint('Shield saved you!');
      return;
    }
    if (this.player.hitInvuln > 0) return;
    this.player.health--;
    this.player.healT = 0;
    this.player.hitInvuln = CFG.bird.hitInvuln;
    if (this.player.health > 0) {
      this.player.vy = Math.max(this.player.vy, 7.5);
      this.player.vel.x *= -0.55;
      this.audio.crash();
      this.effects.spawnDebris(this.player.pos.x, this.player.pos.y, this.player.pos.z);
      this.ui.setHint('Hit! ' + this.player.health + 'x healing left');
      this.camShake = 0.75;
      return;
    }
    this.state = STATE.DYING;
    this.deathT = 0;
    this.player.alive = false;
    this.audio.crash();
    this.effects.spawnDebris(this.player.pos.x, this.player.pos.y, this.player.pos.z);
    this.player.mesh.visible = false;
    this.camShake = 1;
  }

  _beginBossCorridor() {
    if (this.bossCorridorActive) return;
    this.bossCorridorActive = true;
    this.obstacles.clearSpan(-Infinity, this.player.pos.z + 70);
    this.obstacles.spawnZ = this.player.pos.z - 340;
    this.obstacles.beginBossArena(this.player.pos.z, this.boss.encounterNumber);
    this.enemies.reset();
    this.tornados.reset();
    this.landmarks.clearTunnels();
    this.bonus.cancelPortal();
    this.audio.tunnelHum(false);
    this.ui.setHint('MEGA BEAK! Combat airspace cleared - FIRE!');
  }

  _endBossCorridor() {
    if (!this.bossCorridorActive) return;
    this.bossCorridorActive = false;
    const d = this.distance;
    this.obstacles.endBossArena();
    this.obstacles.spawnZ = this.player.pos.z - 340;
    this.nextEnemyAt = d + 240;
    this.nextTornadoAt = d + 320;
    this.nextPortalAt = d + CFG.difficulty.portalEvery;
    this.landmarks.scheduleNextTunnel(d);
    this.boss.nextSpawnDistance = d + CFG.difficulty.bossEvery;
  }

  _syncBossCorridor() {
    if (this.boss.active) this._beginBossCorridor();
    else this._endBossCorridor();
  }

  startRun() {
    this.score = 0;
    this.coins = 0;
    this.bossKills = 0;
    this.speed = CFG.difficulty.speedStart;
    this.gap = CFG.difficulty.gapStart;
    this.obstacleSpacing = 55;
    this.turbulence = 0;
    this.distance = 0;
    this.deathT = 0;
    this.multiplier = 1;
    this.multTime = 0;
    this.nextTornadoAt = CFG.difficulty.tornadoStart;
    this.nextEnemyAt = CFG.difficulty.enemyStart;
    this.nextPotionAt = 0;
    this.nextPortalAt = CFG.difficulty.portalEvery;
    this.nextMilestoneAt = CFG.difficulty.milestoneEvery;
    this._milestoneIdx = 0;
    this.stormPinned = false;
    this.bossCorridorActive = false;
    this.effects.reset();
    this.player.reset();
    this.player.mesh.visible = true;
    this.terrain.reset();
    this.scenery.reset();
    this.obstacles.reset();
    this.enemies.reset();
    this.tornados.reset();
    this.powerups.reset();
    this.combat.reset();
    this.boss.reset();
    this.bonus.reset();
    this.landmarks.reset();
    this.audio.tunnelHum(false);
    this.weather.setStorm(0);
    this._stormTarget = 0;
    this.state = STATE.READY;
    this.ui.showMenu(false);
    this.ui.showGameOver(false);
    this.ui.setHUD(0, 0, this.speed * 3.6);
    this.ui.setHealth(this.player.health, CFG.bird.healthMax, 0);
    this.ui.setHint('Up/W flap - Down/S dive - G glide - Space shoot - arrows steer - 1-9 flap power - M mute');
  }

  _applyDifficulty() {
    const D = CFG.difficulty;
    const pd = Math.min(1, this.distance / 6000);
    this.speed = damp(this.speed, D.speedStart + (D.speedMax - D.speedStart) * pd, 0.5, 0.016);
    this.gap = D.gapStart - (D.gapStart - D.gapMin) * pd;
    this.obstacleSpacing = D.spacingStart - (D.spacingStart - D.spacingMin) * pd;
    this.obstacles.setDifficulty(this.gap, this.obstacleSpacing, pd);
    const stormTarget = smoothstep(D.stormStart, D.stormFull, this.distance);
    this._stormTarget = stormTarget;
    if (!this.stormPinned) this.weather.setStorm(null);
    this.turbulence = smoothstep(600, 2600, this.distance) + this.weather.windGust(this.time) * 0.3 * stormTarget;
  }

  _scheduleThreats() {
    const d = this.distance;
    const hard = Math.min(1, d / 5000);
    this.boss.maybeSpawn(d, this.speed);
    this._syncBossCorridor();
    if (d > this.nextMilestoneAt) {
      this.nextMilestoneAt = d + CFG.difficulty.milestoneEvery;
      const flavor = MILESTONES[(this._milestoneIdx = (this._milestoneIdx || 0) + 1) % MILESTONES.length];
      this.ui.setHint(flavor);
    }
    if (d > this.nextPotionAt) {
      if (this.rng0() < 0.5) this.powerups.spawnPotion(this.player.pos.z - 200);
      else this.powerups.spawnGemLine(this.player.pos.z - 200);
      this.nextPotionAt = d + CFG.powerups.spawnEvery[0] + this.rng0() * (CFG.powerups.spawnEvery[1] - CFG.powerups.spawnEvery[0]);
    }
    if (this.bossCorridorActive) return;
    this.landmarks.maybeSpawnTunnel(d, this.player.pos.z);
    if (d > this.nextTornadoAt) {
      const tt = this.tornados.spawn(this.player.pos.z - 260);
      tt.baseY = this.terrain.groundHeightAt(tt.x, tt.z) - 0.25;
      this.nextTornadoAt = d + (260 - 90 * hard) / (this.speed / 34) + (160 - 60 * hard);
      this.audio.roar();
    }
    if (d > this.nextEnemyAt) {
      const n = 1 + (d > 2000 ? 1 : 0) + (d > 5500 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        this.enemies.spawn(this.player.pos.z - 220 - i * 30, 'chase', hard);
      }
      this.nextEnemyAt = d + (200 - 70 * hard) + this.rng0() * (160 - 50 * hard);
      this.audio.screech();
    }
    if (d > this.nextPortalAt && this.state === STATE.PLAY) {
      this.bonus.scheduleAt(d);
      this.nextPortalAt = d + CFG.difficulty.portalEvery;
    }
  }

  rng0() {
    if (!this._rng) this._rng = (function* () { })();
    if (this._seedRng === undefined) {
      let s = 1234567;
      this._seedRng = () => {
        s |= 0; s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    return this._seedRng();
  }

  _fireBalls() {
    if (this.input.consumeShoot()) {
      const from = this.player.mouthPos(new THREE.Vector3());
      this.combat.fire(from, this.audio);
    }
  }

  _combatCollisions() {
    const balls = this.combat.balls;
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (b.dead) continue;
      let hit = false;
      if (this.enemies.tryBallHit(b.obj.position, CFG.combat.ballRadius, (pos, variant) => {
        const base = variant === 'bomb' ? 25 : variant === 'blue' ? 20 : CFG.score.enemyKill;
        this.addScore(base * this.multiplier);
        this.effects.spawnDebris(pos.x, pos.y, pos.z);
        this.audio.pop();
      }, b)) hit = true;
      if (!hit && this.boss.active) {
        hit = this.boss.tryMinionBallHit(b, CFG.combat.ballRadius, (pos, type) => {
          const base = type === 'bomber' ? CFG.score.bossMinionBomberKill
            : type === 'shooter' || type === 'speeder' ? CFG.score.bossMinionShooterKill
            : CFG.score.bossMinionKill;
          this.addScore(base * this.multiplier);
          this.effects.spawnDebris(pos.x, pos.y, pos.z);
          this.audio.pop();
        });
      }
      if (!hit && this.boss.active) {
        const bp = this.boss.pos || (this.boss.group && this.boss.group.position);
        if (bp && b.obj.position.distanceTo(bp) < 2.8 + CFG.combat.ballRadius) {
          hit = true;
          this.boss.hit(1);
          this.audio.ping(300, 0.1, 0.2, 'square');
          this.effects.coinSparkle(b.obj.position);
        }
      }
      if (!hit) {
        hit = this.tornados.tryBallHit(b.obj.position, CFG.combat.ballRadius, (pos) => {
          this.audio.pop();
        });
      }
      if (hit) this.combat.killBall(b);
    }
  }

  _enterBonus() {
    this.state = STATE.BONUS;
    const res = this.bonus.enterGarden(this.player.pos);
    this.player.pos.y = res.entryY;
    this.player.vy = 0;
    this.weather.setStorm(0);
    this._stormTarget = 0;
    this.audio.portal();
    this.ui.setHint('Mystic Garden! collect everything!');
  }

  _exitBonus() {
    const res = this.bonus.exit(this.player.pos);
    this.player.pos.y = res.exitY;
    this.player.vy = 0;
    this.state = STATE.PLAY;
    this.stormPinned = false;
    this.ui.setHint('');
  }

  _updateCamera(dt) {
    const P = this.player;
    if (this.sun) {
      this.sun.position.set(P.pos.x - 30, P.pos.y + 55, P.pos.z + 25);
      this.sun.target.position.set(P.pos.x, 0, P.pos.z - 10);
      this.sun.target.updateMatrixWorld();
    }
    const camTargetX = P.pos.x * 0.55;
    const camTargetY = 13 + P.pos.y * 0.42;
    const camTargetZ = 17.5 + (this.state === STATE.DYING ? 6 : 0);
    const k = 1 - Math.exp(-dt * 3.2);
    this.camera.position.x += (camTargetX - this.camera.position.x) * k;
    this.camera.position.y += (camTargetY - this.camera.position.y) * k;
    this.camera.position.z += (camTargetZ - this.camera.position.z) * k;
    _lookAt.set(P.pos.x * 0.8, P.pos.y + 1.5, P.pos.z - 14);
    this.camera.lookAt(_lookAt);
    if (this.camShake > 0) {
      this.camShake = Math.max(0, this.camShake - dt * 1.6);
      const s = this.camShake * this.camShake * 0.9;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
  }

  _spawnTrail() {
    if (this.state !== STATE.PLAY && this.state !== STATE.BONUS) return;
    const P = this.player;
    const behind = _behind.set(0, 0, 1.2).applyEuler(P.mesh.rotation);
    behind.multiplyScalar(P.mesh.scale.x).add(P.pos);
    this.effects.spawnTrail(behind.x, behind.y, behind.z, -P.vel.x * 0.2, -P.vy * 0.2);
  }

  _tickDYING(dt) {
    this.deathT += dt;
    this.speed *= Math.pow(0.2, dt);
    if (this.deathT > 1.4) {
      this.state = STATE.OVER;
      const rank = this.lb.add({
        score: this.score, coins: this.coins,
        distance: Math.round(this.distance), bossKills: this.bossKills,
      });
      this.ui.showGameOver(true, this.score, this.coins, Math.round(this.distance), this.bossKills, this.lb, rank);
    }
  }

  update(dt) {
    this.time += dt;
    this.input.update(dt);
    const inPlay = this.state === STATE.PLAY || this.state === STATE.BONUS;
    this.ui.setChips({
      shield: this.player.shield > 0,
      boost: this.player.speedBoost > 0,
      mult: this.multiplier > 1,
      glide: this.player.gliding,
    });
    this.ui.setBoss(this.boss ? this.boss.hp : 0, this.boss ? this.boss.maxHp : 1, this.boss.name, this.boss.active);
    this.ui.setHealth(
      this.player.health,
      CFG.bird.healthMax,
      this.player.health < CFG.bird.healthMax ? this.player.healT / CFG.bird.healEvery : 0
    );
    if (this.multTime > 0) {
      this.multTime -= dt;
      if (this.multTime <= 0) {
        this.multiplier = 1;
        this.ui.setHUD(this.score, this.coins, this.speed * 3.6);
      }
    }
    if (this.state === STATE.PLAY) {
      this._applyDifficulty();
      this.distance += this.speed * dt;
      if (this.input.consumeFlap()) this.player.flap(this.audio);
      if (this.input.consumeDive()) this.player.dive();
      this._fireBalls();
      const gH = this.terrain.groundHeightAt(this.player.pos.x, 0);
      this.player.update(dt, this.speed, this.input.axisX, this.turbulence, this.audio, gH);
      this.ui.setReadout(Math.max(0, this.player.pos.y - gH), this.player.flapLevel);
      this.terrain.update(dt, this.speed, this.player.pos.x, this.player.pos.z);
      this.scenery.ensureAhead(this.player.pos.z);
      this.scenery.update(dt, this.speed, this.time);
      this._scheduleThreats();
      if (!this.bossCorridorActive) this.obstacles.ensureAhead(this.player.pos.z);
      this.obstacles.update(dt, this.speed, this.player, this.time, this.audio, true, !this.bossCorridorActive);
      if (this.bossCorridorActive) this.obstacles.updateBossArena(dt, this.speed, this.player);
      const groundY = gH + 0.9;
      if (this.player.pos.y < Math.max(0.6, groundY)) {
        this.player.pos.y = Math.max(0.6, groundY);
        this.obstacles.onCrash?.('ground');
      }
      this.landmarks.update(dt, this.speed, this.time, this.player, true);
      this.enemies.update(dt, this.speed, this.time, this.player, {
        onHitPlayer: (kind, pos) => this.damagePlayer(kind, pos),
      });
      this.tornados.update(dt, this.speed, this.time, this.player, {
        onPull: (fall) => { this.camShake = Math.max(this.camShake, fall * 0.35); },
        onRoar: (f) => {
          if (f > 0.55 && this.time - (this._lastRoarAt || -9) > 2.5) {
            this._lastRoarAt = this.time;
            this.audio.roar();
          }
        },
      });
      this.powerups.update(dt, this.speed, this.time, this.player, {
        onPickup: (kind, pos) => this.powerups.onPickup(kind, pos),
      });
      if (!this.bonus.active) this.boss.update(dt, this.speed, this.time, this.player.pos);
      this._syncBossCorridor();
      this.combat.update(dt, this.speed);
      this._combatCollisions();
      this.bonus.update(dt, this.speed, this.time, this.player.pos);
      if (!this.bossCorridorActive && this.bonus.portalActive && this.bonus.tryEnter(this.player.pos)) {
        this._enterBonus();
      }
      if (this.state === STATE.BONUS && this.bonus.exitReady) {
        this._exitBonus();
      }
      this.weather.update(dt, this.speed, this._stormTarget, this.time);
      const mist = this.landmarks.mistFactor;
      if (mist > 0.02) {
        this.scene.fog.near = Math.min(this.scene.fog.near, CFG.world.fogNear * (1 - 0.35 * mist));
        this.scene.fog.far = Math.min(this.scene.fog.far, CFG.world.fogFar * (1 - 0.25 * mist));
      }
      this._spawnTrail();
    } else if (this.state === STATE.BONUS) {
      this.distance += this.speed * dt;
      if (this.input.consumeFlap()) this.player.flap(this.audio);
      if (this.input.consumeDive()) this.player.dive();
      this._fireBalls();
      const gH = this.terrain.groundHeightAt(this.player.pos.x, 0);
      this.player.update(dt, this.speed, this.input.axisX, 0, this.audio, gH);
      this.ui.setReadout(Math.max(0, this.player.pos.y - gH), this.player.flapLevel);
      this.terrain.update(dt, this.speed, this.player.pos.x, this.player.pos.z);
      this.scenery.update(dt, this.speed, this.time);
      this.bonus.update(dt, this.speed, this.time, this.player.pos);
      this.combat.update(dt, this.speed);
      this._combatCollisions();
      this.weather.update(dt, this.speed, 0, this.time);
      this._spawnTrail();
      if (this.bonus.exitReady) this._exitBonus();
    } else if (this.state === STATE.READY) {
      this.player.hover(this.time, this.terrain.groundHeightAt(this.player.pos.x, 0));
      this.ui.setReadout(Math.max(0, this.player.pos.y - this.terrain.groundHeightAt(this.player.pos.x, 0)), this.player.flapLevel);
      this.terrain.update(dt, this.speed * 0.25, 0, this.player.pos.z);
      this.scenery.update(dt, this.speed * 0.25, this.time);
      this.effects.update(dt, this.speed * 0.25);
      this._spawnTrail();
    } else if (this.state === STATE.DYING) {
      this._tickDYING(dt);
      this.terrain.update(dt, this.speed, 0, this.player.pos.z);
      this.scenery.update(dt, this.speed, this.time);
      this.obstacles.update(dt, this.speed, this.player, this.time, null, false);
      this.landmarks.update(dt, this.speed, this.time, this.player, false);
      this.enemies.update(dt, this.speed, this.time, this.player, null);
      this.tornados.update(dt, this.speed, this.time, this.player, null);
      this.combat.update(dt, this.speed);
      this.weather.update(dt, this.speed, this.weather.stormLevel, this.time);
    } else if (this.state === STATE.MENU) {
      this.terrain.update(dt, this.speed * 0.5, 0, 0);
      this.scenery.update(dt, this.speed * 0.5, this.time);
      this.weather.update(dt, this.speed * 0.5, 0, this.time);
      this.camera.position.x = Math.sin(this.time * 0.22) * 6;
      this.camera.position.y = 15 + Math.sin(this.time * 0.31) * 2;
      this.camera.position.z = 24;
      this.camera.lookAt(0, 11, -30);
      this.effects.update(dt, this.speed * 0.5);
    }
    if (this.state !== STATE.MENU) {
      this._updateCamera(dt);
      this.effects.update(dt, this.state === STATE.PLAY || this.state === STATE.BONUS || this.state === STATE.DYING ? this.speed : this.speed * 0.25);
    }
  }

  _frame(timestamp = performance.now()) {
    requestAnimationFrame(this._boundFrame);
    if (this._lastFrameAt) {
      const rawMs = timestamp - this._lastFrameAt;
      if (rawMs < 100) {
        this._frameMs += (rawMs - this._frameMs) * 0.04;
        this._slowFramesT = this._frameMs > 23 ? this._slowFramesT + rawMs / 1000 : Math.max(0, this._slowFramesT - rawMs / 2000);
        if (!this._qualityReduced && this._slowFramesT > 2) {
          this._qualityReduced = true;
          this.renderRatio = Math.min(devicePixelRatio, 0.85);
          this.renderer.setPixelRatio(this.renderRatio);
          this.bloom.enabled = false;
        }
      }
    }
    this._lastFrameAt = timestamp;
    const dt = Math.min(0.05, this.clock.getDelta());
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  run() {
    requestAnimationFrame(this._boundFrame);
  }
}

const STATE_EXPORT = STATE;
const _lookAt = new THREE.Vector3();
const _behind = new THREE.Vector3();
const MILESTONES = [
  'The winds are rising...',
  'Cave country ahead - watch the walls',
  'Villain flocks gathering...',
  'Storm front closing in',
  'MEGA BEAK stirs beyond the clouds',
  'The valley tightens - keep flapping',
];

const game = new Game();
window.__game = game;
game.loadAssets().then(() => {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
  game.run();
}).catch((err) => {
  console.error(err);
  const el = document.getElementById('loading');
  el.textContent = 'Failed to load assets: ' + err.message;
});
