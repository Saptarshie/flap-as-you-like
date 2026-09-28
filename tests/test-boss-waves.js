const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--window-size=1280,720', '--mute-audio', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8321/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!(window.__game && window.__game.player), { timeout: 60000 });
  await page.keyboard.press('Space');
  await sleep(100);
  await page.keyboard.press('Space');
  await sleep(100);

  const result = await page.evaluate(() => {
    try {
    const g = window.__game;
    g.noDeath = true;
    g.obstacles.clearSpan(-1000, 100);
    g.nextEnemyAt = g.nextTornadoAt = g.nextPotionAt = g.nextPortalAt = 1e9;

    // --- wave scaling across encounters ---
    const waveSizes = [];
    for (let enc = 1; enc <= 6; enc++) {
      g.boss.active = false;
      g.bossCorridorActive = false;
      g.boss._wavesSpawned = 0;
      g.boss._minionsSpawned = 0;
      g.boss.encounterNumber = enc;
      g.boss.maxHp = 6 + 3 * (enc - 1);
      g.boss.hp = g.boss.maxHp;
      g.boss.active = true;
      g.boss.phase = 1;
      g.boss._birdPos = g.player.pos;
      g._beginBossCorridor();
      const forced = g.boss._summonMinions();
      waveSizes.push({ enc, wave: g.boss._waveSize(), spawnedNow: g.boss.minions.length, arenaProps: g.obstacles.bossProps.length });
      g.boss._minionsUpdate(0.1, null);
      for (const m of [...g.boss.minions]) {
        m.obj.visible = false;
        g.boss._minionPool.push(m.obj);
      }
      g.boss.minions.length = 0;
      g._endBossCorridor();
    }

    // --- variety: one big wave must contain >=3 distinct types ---
    g.boss.encounterNumber = 6;
    g.boss.maxHp = 21; g.boss.hp = 21;
    g.boss.phase = 2;
    g.boss._wavesSpawned = 0;
    g.boss._minionsSpawned = 0;
    for (const m of [...g.boss.minions]) { m.obj.visible = false; g.boss._minionPool.push(m.obj); }
    g.boss.minions.length = 0;
    const poolBefore = g.boss._minionPool.map((o) => o.userData.type);
    g.boss._summonMinions();
    const types = [...new Set(g.boss.minions.map((m) => m.type))];
    const colors = g.boss.minions.map((m) => {
      let hex = null;
      m.obj.traverse((o) => { if (hex === null && o.isMesh && o.material && o.material.color) hex = o.material.color.getHex(); });
      return hex;
    });
    const distinctColors = new Set(colors).size;

    // --- shooter fires bolts ---
    g.boss._time = g.time;
    const shooter = g.boss.minions.find((m) => m.type === 'shooter');
    let shooterFires = false;
    if (shooter) {
      shooter.fireCd = 0;
      g.boss._minionsUpdate(0.05, g.player.pos);
      const b0 = g.boss.bolts[0];
      shooterFires = g.boss.bolts.length > 0;
      if (b0) {
        const vz = b0.vel.z;
        const towardPlayer = g.player.pos.z > shooter.obj.position.z ? vz > 10 : vz < -10;
        g.boss._boltsUpdate(0.15, g.player.pos);
        shooterFires = shooterFires && towardPlayer && b0.obj.position.z !== b0.vel.z;
      }
    }

    // --- bomber approaches overhead, then drops eggs at the player ---
    let bomberDrops = false;
    let bomberOverhead = false;
    const bomber = g.boss.minions.find((m) => m.type === 'bomber');
    if (bomber) {
      const playerZ = g.player.pos.z;
      bomber.life = 999;
      bomber.obj.position.z = -34;
      for (let i = 0; i < 120; i++) g.boss._minionsUpdate(1 / 30, g.player.pos);
      const zNow = bomber.obj.position.z;
      bomberOverhead = Math.abs(zNow - (playerZ - 5)) < 3.5;
      bomber.dropCd = 0;
      g.boss._minionsUpdate(0.05, g.player.pos);
      bomberDrops = g.boss.eggs.length > 0;
    }

    // --- speeder is fast ---
    const speeder = g.boss.minions.find((m) => m.type === 'speeder');
    let speederFast = false;
    if (speeder) {
      const z0 = speeder.obj.position.z;
      g.boss._minionsUpdate(0.2, g.player.pos);
      speederFast = Math.abs(z0 - speeder.obj.position.z) > 4;
    }

    // --- chaser tracks the player ---
    const chaser = g.boss.minions.find((m) => m.type === 'chaser');
    let chaserTracks = false;
    if (chaser) {
      g.player.pos.x = 10;
      g.player.pos.y = 20;
      const x0 = chaser.obj.position.x;
      g.boss._minionsUpdate(0.3, g.player.pos);
      chaserTracks = Math.abs(chaser.obj.position.x - x0) > 0.5;
    }

    // --- flap calibration ---
    const lvl5Base = window.__flapProbe ? window.__flapProbe(5, 34) : null;
    const impulse = (ws) => {
      g.player.worldSpeed = ws;
      g.player.vy = 0;
      g.player.flap(null);
      return g.player.vy;
    };
    const flap34 = impulse(34);
    const flap58 = impulse(58);
    const flap82 = impulse(82);
    const apexRatio = flap82 / flap34;
    g.player.worldSpeed = 34;

    return {
      waveSizes, poolBefore, types, distinctColors,     shooterFires, bomberDrops, bomberOverhead, speederFast, chaserTracks,
      flap34, flap58, flap82, apexRatio, lvl5Base,
      poolInvariant: g.boss.minions.length + g.boss._minionPool.length === 10,
    };
    } catch (e) {
      return { evalError: String(e && e.stack || e) };
    }
  });

  const checks = {
    wavesScaleToTen: result.waveSizes.every((w, i) => w.wave === Math.min(10, 3 + i * 2) || w.wave === Math.min(10, 3 + (w.enc - 1) * 2)),
    lateWavesBig: result.waveSizes[2].wave >= 7 && result.waveSizes[5].wave === 10,
    mixedTypes: result.types.length >= 3,
    distinctColors: result.distinctColors >= 3,
    shooterFires: result.shooterFires,
    bomberDrops: result.bomberDrops,
    bomberOverhead: result.bomberOverhead,
    speederFast: result.speederFast,
    chaserTracks: result.chaserTracks,
    flapCalibrated: result.flap34 > 10 && result.flap82 > result.flap34 * 1.15 && result.flap82 < result.flap34 * 1.3,
    poolInvariant: result.poolInvariant,
    noConsoleErrors: errors.length === 0,
  };
  for (const [name, ok] of Object.entries(checks)) console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
  if (errors.length) console.log(errors.join('\n'));
  console.log(JSON.stringify(result, null, 2));
  if (result.evalError) {
    console.log('EVAL ERROR:', result.evalError);
    await browser.close();
    process.exit(1);
  }
  await browser.close();
  process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
})().catch((err) => { console.error(err); process.exit(1); });