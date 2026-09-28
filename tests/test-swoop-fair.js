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
  });
  await new Promise(r => setTimeout(r, 1500));

  // boss swoops at held-altitude bird 5 times; count contacts
  const probe = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    g.boss.maybeSpawn(999999, 40);
    await sleep(3000); // let it reach hover
    let contacts = 0;
    const orig = g.boss.onHitPlayer;
    g.boss.onHitPlayer = () => { contacts++; };
    let swoops = 0;
    for (let i = 0; i < 30; i++) {
      if (g.boss._swoopState === 'out' && (window.__lastSwoop || 0) === 0) swoops++;
      window.__lastSwoop = g.boss._swoopState === 'out' ? 1 : 0;
      await sleep(200);
    }
    g.boss.onHitPlayer = orig;
    return { swoops, contacts, bossZ: +g.boss.pos.z.toFixed(1), birdY: +g.player.pos.y.toFixed(1), hp: g.boss.hp };
  });
  await page.evaluate(() => { window.__hold = false; });
  console.log(JSON.stringify(probe, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });