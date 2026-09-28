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
  await page.evaluate(() => { window.__game.noDeath = true; });

  // PULL TEST: tornado 8u to +x and 2.5u ahead (inside influence); expect drift toward it >= 2.5u in 3.5s
  const pull = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const tt = g.tornados.spawn(g.player.pos.z - 2.5);
    tt.x = g.player.pos.x + 8;
    tt.rig.group.position.x = tt.x;
    tt.life = 60;
    const x0 = g.player.pos.x;
    g.player.vel.x = 0;
    for (let i = 0; i < 70; i++) {
      tt.z = g.player.pos.z - 2.5;
      tt.prevZ = tt.z;
      tt.rig.group.position.z = tt.z;
      await sleep(50);
    }
    const dx = g.player.pos.x - x0;
    return { x0: +x0.toFixed(2), x1: +g.player.pos.x.toFixed(2), dx: +dx.toFixed(2), pass: dx >= 2.5 };
  });

  // CORE TEST: tornado parked ON the bird; it manipulates air but is not a collider
  const core = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    g.noDeath = false;
    g.player.shield = 0;
    for (const tt of [...g.tornados.list]) g.tornados._release(tt);
    g.tornados.list.length = 0;
    const tt = g.tornados.spawn(g.player.pos.z - 4);
    tt.hitCd = 0;
    const health0 = g.player.health;
    let died = false;
    for (let i = 0; i < 40; i++) {
      g.player.pos.y = 13;
      g.player.vy = 0;
      tt.x = g.player.pos.x;
      tt.rig.group.position.x = tt.x;
      tt.z = g.player.pos.z - 1;
      tt.prevZ = tt.z;
      tt.rig.group.position.z = tt.z;
      await sleep(50);
      if (g.state === 3 || g.state === 4) { died = true; break; }
    }
    g.noDeath = true;
    return { died, health0, health: g.player.health, state: g.state, pass: !died && g.player.health === health0 };
  });

  const verdict = { pull, core, allPass: pull.pass && core.pass, errors: errors.slice(0, 3) };
  console.log(JSON.stringify(verdict, null, 2));
  await browser.close();
  process.exit(verdict.allPass ? 0 : 1);
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
