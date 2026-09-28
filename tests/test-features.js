const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--enable-webgl', '--window-size=1280,800']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('[error] ' + msg.text()); });
  await page.goto('http://localhost:8321/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 400));
  await page.keyboard.press('ArrowUp');
  await new Promise(r => setTimeout(r, 300));

  await page.evaluate(() => {
    const g = window.__game;
    g.noDeath = true;
    window.__seen = {
      enemyKilledByBall: false, potionSpeed: false, potionShield: false, gemTaken: false,
      portalSeen: false, bonusEntered: false, bonusCollects: 0, bonusExited: false,
      bossSeen: false, bossHit: false, bossDefeated: false, lightning: 0, shotsFired: false,
      stormHigh: 0, maxDist: 0,
    };
    g.combat.fire = ((f) => (from, audio) => { window.__seen.shotsFired = true; return f(from, audio); })(g.combat.fire);
    g.weather.onLightning = () => { window.__seen.lightning++; };
    g.bonus.onCollect = ((o) => (kind, pos) => { window.__seen.bonusCollects++; return o(kind, pos); })(g.bonus.onCollect);
    g.boss.onDefeat = ((o) => (info) => { window.__seen.bossDefeated = true; return o(info); })(g.boss.onDefeat);
    const pu = g.powerups.onPickup.bind(g.powerups);
    g.powerups.onPickup = (kind, pos) => {
      if (kind === 'speed') window.__seen.potionSpeed = true;
      if (kind === 'shield') window.__seen.potionShield = true;
      if (kind === 'gem') window.__seen.gemTaken = true;
      return pu(kind, pos);
    };
    window.__ew = setInterval(() => {
      const g = window.__game;
      if (g.enemies.count < (window.__ec || 0)) window.__seen.enemyKilledByBall = true;
      window.__ec = g.enemies.count;
      window.__seen.portalSeen = window.__seen.portalSeen || g.bonus.portalActive;
      window.__seen.bonusEntered = window.__seen.bonusEntered || g.state === 5;
      window.__seen.bossSeen = window.__seen.bossSeen || g.boss.active;
      window.__seen.bossHit = window.__seen.bossHit || (g.boss.active && g.boss.hp < g.boss.maxHp);
      window.__seen.stormHigh = Math.max(window.__seen.stormHigh, g.weather.stormLevel);
    }, 250);
  });

  const t0 = Date.now();
  let lastState = 0;
  while (Date.now() - t0 < 100000) {
    const s = await page.evaluate(() => {
      const g = window.__game;
      const bz = g.player.pos.z;
      let best = null;
      for (const gt of g.obstacles.gates) if (gt.z < bz - 4 && (!best || gt.z > best.z)) best = gt;
      window.__seen.maxDist = Math.max(window.__seen.maxDist, Math.round(g.distance));
      return {
        y: g.player.pos.y, target: best ? best.gapY : 14,
        state: g.state, dist: Math.round(g.distance),
        enemies: g.enemies.count, balls: g.combat.count,
      };
    });
    lastState = s.state;
    if (s.state === 5) {
      // garden: fly level, keep shooting for fun
    } else {
      if (s.y < s.target - 0.35) await page.keyboard.press('ArrowUp');
    }
    if (s.enemies > 0 || s.dist > 300) await page.keyboard.press('Space');
    if (Math.floor(Date.now() / 1000) % 9 === 0) await page.keyboard.press('KeyG');
    await new Promise(r => setTimeout(r, 90));
    if (s.dist > 6300) break;
  }

  const final = await page.evaluate(() => {
    const g = window.__game;
    clearInterval(window.__ew);
    return {
      state: g.state, dist: Math.round(g.distance), maxDist: window.__seen.maxDist,
      score: g.score, coins: g.coins, bossKills: g.bossKills,
      storm: +g.weather.stormLevel.toFixed(2),
      seen: window.__seen,
    };
  });
  console.log(JSON.stringify(final, null, 2));
  await page.screenshot({ path: 'qa_adv.png' });
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });