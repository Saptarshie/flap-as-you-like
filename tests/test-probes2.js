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
  await page.evaluate(() => { window.__game.noDeath = true; });

  // probe A: shield absorption via direct API
  const shieldA = await page.evaluate(() => {
    const g = window.__game;
    g.player.shield = 6;
    g.damagePlayer('shieldTest');
    return { after: g.state, used: g.player.shield < 6, shieldVal: g.player.shield };
  });

  // probe B: shield absorption via a real enemy contact (spawn enemy on bird line)
  const shieldB = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    g.player.shield = 6;
    const e = g.enemies.spawn(g.player.pos.z - 40, 'chase');
    e.obj.position.set(0, 14, g.player.pos.z - 40);
    await sleep(2600);
    return { after: g.state, shieldVal: g.player.shield, enemiesLeft: g.enemies.count };
  });

  // probe C: real death happens without shield
  const deathC = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    g.player.shield = 0;
    g.noDeath = false;
    const e = g.enemies.spawn(g.player.pos.z - 40, 'chase');
    e.obj.position.set(0, 14, g.player.pos.z - 40);
    await sleep(2600);
    const st = g.state;
    g.noDeath = true; // keep harness alive
    return { stateAfterEnemyContact: st };
  });

  // probe D: bonus portal geometry - where is the portal vs bird when active?
  const portalGeo = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    g.bonus.reset();
    g.bonus.scheduleAt(1);
    await sleep(600);
    const po = g.bonus._portal ? g.bonus._portal.group.position : null;
    return {
      portalActive: g.bonus.portalActive,
      hasPortalObj: !!g.bonus._portal,
      pz: po ? +po.z.toFixed(1) : null, px: po ? +po.x.toFixed(1) : null, py: po ? +po.y.toFixed(1) : null,
      bz: +g.player.pos.z.toFixed(1), by: +g.player.pos.y.toFixed(1),
    };
  });
  // wait for portal to reach the bird and let tryEnter run naturally in update()
  let entered = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    await new Promise(r => setTimeout(r, 250));
    const st = await page.evaluate(() => ({ state: window.__game.state, pa: window.__game.bonus.portalActive }));
    if (st.state === 5) { entered = true; break; }
    if (!st.pa && !entered) { /* portal passed or consumed */ }
  }
  const bonusState = await page.evaluate(() => ({ state: window.__game.state, active: window.__game.bonus.active, timeLeft: +window.__game.bonus.timeLeft.toFixed(1) }));

  console.log(JSON.stringify({ shieldA, shieldB, deathC, portalGeo, entered, bonusState, errors: errors.slice(0, 4) }, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });