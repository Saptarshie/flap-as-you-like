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
  page.on('requestfailed', (r) => errors.push('[reqfail] ' + r.url()));

  await page.goto('http://localhost:8321/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  const probe1 = await page.evaluate(() => ({
    loadingHidden: document.getElementById('loading').classList.contains('hidden'),
    menuShown: !document.getElementById('menu').classList.contains('hidden'),
    webgl: !!document.getElementById('game').getContext('webgl2'),
    hasGame: !!window.__game,
    hasSystems: window.__game ? ['weather','bonus','boss','combat','enemies','tornados','powerups','lb'].map(k => k + ':' + !!window.__game[k]).join(' ') : 'no game',
  }));
  await page.screenshot({ path: 'qa_menu.png' });

  await page.keyboard.press('Space');   // menu -> READY
  await new Promise(r => setTimeout(r, 500));
  await page.keyboard.press('ArrowUp'); // READY -> PLAY
  await new Promise(r => setTimeout(r, 400));

  // autopilot: hold y~14, flap when low; glide sometimes; shoot every second
  const t0 = Date.now();
  let result = null;
  while (Date.now() - t0 < 40000) {
    const s = await page.evaluate(() => {
      const g = window.__game;
      const bz = g.player.pos.z;
      let best = null;
      for (const gt of g.obstacles.gates) if (gt.z < bz - 4 && (!best || gt.z > best.z)) best = gt;
      return {
        y: g.player.pos.y, target: best ? best.gapY : 14,
        state: g.state, dist: Math.round(g.distance),
        score: g.score, coins: g.coins, bossKills: g.bossKills,
        enemies: g.enemies.count, tornados: g.tornados.count, balls: g.combat.count,
        storm: +g.weather.stormLevel.toFixed(2),
        bossActive: g.boss.active,
      };
    });
    if (s.state === 3 || s.state === 4) { result = { died: true, ...s }; break; }
    if (s.dist > 1500) { result = { success: true, ...s }; break; }
    if (s.y < s.target - 0.35) await page.keyboard.press('ArrowUp');
    if (s.enemies > 0 || (s.dist > 400 && Math.floor(Date.now() / 1000) % 2 === 0)) await page.keyboard.press('Space');
    await new Promise(r => setTimeout(r, 70));
  }
  if (!result) {
    result = await page.evaluate(() => ({ timeout: true, state: window.__game.state, dist: Math.round(window.__game.distance) }));
  }
  const final = await page.evaluate(() => {
    const g = window.__game;
    return {
      state: g.state, dist: Math.round(g.distance), score: g.score, coins: g.coins,
      storm: +g.weather.stormLevel.toFixed(2),
      over: !document.getElementById('gameover').classList.contains('hidden'),
    };
  });
  await page.screenshot({ path: 'qa_play.png' });
  console.log(JSON.stringify({ probe1, result, final, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });