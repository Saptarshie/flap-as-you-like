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
    window.__contacts = 0;
    const oc = g.boss._contact.bind(g.boss);
    g.boss._contact = () => { window.__contacts++; return oc(); };
    // feather probe: record each feather min distance to bird
    window.__fmin = 999;
  });
  await new Promise(r => setTimeout(r, 1500));

  const result = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    g.boss.maybeSpawn(999999, 40);
    const featherTrack = [];
    for (let i = 0; i < 60; i++) {
      const b = g.boss;
      for (const f of b.feathers) {
        const d = g.player.pos.distanceTo(f.obj.position);
        window.__fmin = Math.min(window.__fmin, d);
      }
      featherTrack.push({ i, feathers: b.feathers.length, min: +window.__fmin.toFixed(2), contacts: window.__contacts });
      await sleep(200);
    }
    return { minFeatherDist: +window.__fmin.toFixed(2), contacts: window.__contacts, featherTimeline: featherTrack.filter(t => t.feathers > 0).slice(0, 12) };
  });
  await page.evaluate(() => { window.__hold = false; });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });