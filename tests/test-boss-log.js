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

  // full boss attack log: phases, actions, positions, contacts
  const log = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    g.boss.maybeSpawn(999999, 40);
    await sleep(3500);
    const events = [];
    let lastPhase = g.boss.phase;
    let lastSwoop = null;
    let contacts = 0;
    const orig = g.boss.onHitPlayer;
    g.boss.onHitPlayer = () => { contacts++; events.push({ t: 'contact', y: +g.player.pos.y.toFixed(1), by: +g.boss.pos.y.toFixed(1), bz: +g.boss.pos.z.toFixed(1) }); };
    for (let i = 0; i < 60; i++) {
      const b = g.boss;
      if (b.phase !== lastPhase) { events.push({ t: 'phase', to: b.phase }); lastPhase = b.phase; }
      if (b._swoopState === 'out' && lastSwoop !== 'out') events.push({ t: 'swoop-start', by: +b.pos.y.toFixed(1), bz: +b.pos.z.toFixed(1) });
      if (b._swoopState === null && lastSwoop === 'out') events.push({ t: 'swoop-end' });
      lastSwoop = b._swoopState;
      if (events.length > 30) break;
      await sleep(200);
    }
    g.boss.onHitPlayer = orig;
    const featherFired = b => b._feathers ? b._feathers.length : (b.feathers ? b.feathers.length : -1);
    return { events, contacts, finalSwoopState: g.boss._swoopState, featherCount: featherFired(g.boss), bossPos: { x: +g.boss.pos.x.toFixed(1), y: +g.boss.pos.y.toFixed(1), z: +g.boss.pos.z.toFixed(1) } };
  });
  await page.evaluate(() => { window.__hold = false; });
  console.log(JSON.stringify(log, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });