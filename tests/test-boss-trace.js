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
  await page.goto('http://localhost:8321/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 400));
  await page.keyboard.press('ArrowUp');
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    const g = window.__game;
    window.__hold = true;
    const tick = () => {
      if (!window.__hold) return;
      if (g.state === 2) {
        if (g.player.pos.y < 13.6) g.player.flap(null);
        if (g.player.pos.y > 15.5) g.player.vy = Math.min(g.player.vy, 0);
      }
      requestAnimationFrame(tick);
    };
    tick();
    g.noDeath = true;
  });
  await new Promise(r => setTimeout(r, 1500));

  const trace = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    g.boss.maybeSpawn(999999, 40);
    const out = [];
    for (let i = 0; i < 60; i++) {
      const b = g.boss;
      if (b.active) {
        out.push({ i, phase: b.phase, dist: +g.player.pos.distanceTo(b.pos).toFixed(1), swoop: b._swoopState, bz: +b.pos.z.toFixed(1) });
      }
      await sleep(220);
    }
    return out;
  });
  await page.evaluate(() => { window.__hold = false; });
  const minD = trace.length ? Math.min(...trace.map(t => t.dist)) : -1;
  console.log(JSON.stringify({ minDist: minD, close: trace.filter(t => t.dist < 5), cadence: trace.length, errors: errors.slice(0, 2) }, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });