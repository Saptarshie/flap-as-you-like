const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--window-size=1280,800']
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
    window.__hold = true;
    const tick = () => {
      if (!window.__hold) return;
      if (g.state === 2 || g.state === 5) {
        if (g.player.pos.y < 13.6) g.player.flap(null);
        if (g.player.pos.y > 15.5) g.player.vy = Math.min(g.player.vy, 0);
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
  // fly ~2s so PLAY is stable
  await new Promise(r => setTimeout(r, 2000));

  const result = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const out = {};
    // schedule portal
    g.bonus.reset();
    g.bonus.scheduleAt(1);
    await sleep(500);
    out.portalActiveAfterSchedule = g.bonus.portalActive;
    // teleport portal right in front of bird
    if (g.bonus._portal) {
      const p = g.bonus._portal.group.position;
      out.portalPosBefore = { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) };
      p.set(0, g.player.pos.y, g.player.pos.z - 1);
      out.portalMoved = true;
    }
    await sleep(400);
    out.entered = g.bonus._entered === true || g.state === 5;
    out.stateAfterTouch = g.state;
    if (g.state === 5) {
      out.gardenActive = g.bonus.active;
      const c0 = g.coins, s0 = g.score;
      await sleep(3000);
      out.coinsGained = g.coins - c0;
      out.scoreGained = g.score - s0;
      out.timeLeft = +g.bonus.timeLeft.toFixed(1);
      // wait for exit
      await sleep(10000);
      out.exited = g.state === 2;
      out.timeAfter = +g.bonus.timeLeft.toFixed(1);
      out.activeAfter = g.bonus.active;
    }
    return out;
  });
  // keep looping until exit completes (harness side)
  const t1 = Date.now();
  while (Date.now() - t1 < 14000) {
    await new Promise(r => setTimeout(r, 300));
    const st = await page.evaluate(() => window.__game.state);
    if (st === 2) break;
  }
  const final = await page.evaluate(() => ({
    state: window.__game.state, bonusActive: window.__game.bonus.active,
    coins: window.__game.coins, score: window.__game.score,
  }));
  await page.evaluate(() => { window.__hold = false; });
  console.log(JSON.stringify({ result, final, errors: errors.slice(0, 4) }, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });