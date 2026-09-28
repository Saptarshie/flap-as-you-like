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
  const verdicts = {};

  // 1) FLAP APEX: single flap from settled fall -> rise >= 2.5m
  verdicts.flap = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    g.player.vy = 0;
    const y0 = g.player.pos.y;
    g.player.flap(null);
    let maxY = y0;
    for (let i = 0; i < 24; i++) {
      await sleep(50);
      maxY = Math.max(maxY, g.player.pos.y);
    }
    const apex = maxY - y0;
    return { apex: +apex.toFixed(2), pass: apex >= 2.5 };
  });

  // 2) BLADE GAP (no phantom hit): bird 45deg between arms at r=2.3, blade pinned at bird z, 1.2s
  verdicts.bladeGap = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let hits = 0;
    const oc = g.obstacles.onCrash;
    g.obstacles.onCrash = (k) => { hits++; };
    const obj = g.obstacles._acquire('blade');
    obj.position.set(0, 12, g.player.pos.z - 1);
    obj.rotation.z = 0;
    const rec = { obj, kind: 'blade', z: obj.position.z, prevZ: obj.position.z, spin: 0, hit: false };
    g.obstacles.movers.push(rec);
    g.player.pos.set(1.65, 13.65, 0);
    for (let i = 0; i < 24; i++) {
      rec.z = g.player.pos.z - 0.4;
      rec.prevZ = rec.z;
      obj.position.z = rec.z;
      g.player.pos.x = 1.65;
      g.player.pos.y = 13.65;
      g.player.vy = 0;
      await sleep(50);
    }
    g.obstacles.onCrash = oc;
    const idx = g.obstacles.movers.indexOf(rec);
    if (idx >= 0) g.obstacles.movers.splice(idx, 1);
    g.obstacles._release('blade', obj);
    return { hits, pass: hits === 0 };
  });

  // 3) BLADE ARM (real hit): bird on the 0deg arm at r=2.3
  verdicts.bladeArm = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let hits = 0;
    const oc = g.obstacles.onCrash;
    g.obstacles.onCrash = (k) => { hits++; };
    const obj = g.obstacles._acquire('blade');
    obj.position.set(0, 12, g.player.pos.z - 1);
    obj.rotation.z = 0;
    const rec = { obj, kind: 'blade', z: obj.position.z, prevZ: obj.position.z, spin: 0, hit: false };
    g.obstacles.movers.push(rec);
    for (let i = 0; i < 24; i++) {
      rec.z = g.player.pos.z - 0.4;
      rec.prevZ = rec.z;
      obj.position.z = rec.z;
      g.player.pos.x = 2.3;
      g.player.pos.y = 12;
      g.player.vy = 0;
      await sleep(50);
    }
    g.obstacles.onCrash = oc;
    const idx = g.obstacles.movers.indexOf(rec);
    if (idx >= 0) g.obstacles.movers.splice(idx, 1);
    g.obstacles._release('blade', obj);
    return { hits, pass: hits > 0 };
  });

  // 4) BLADE FAR (no phantom): bird 5m from hub between arms
  verdicts.bladeFar = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let hits = 0;
    const oc = g.obstacles.onCrash;
    g.obstacles.onCrash = (k) => { hits++; };
    const obj = g.obstacles._acquire('blade');
    obj.position.set(0, 12, g.player.pos.z - 1);
    obj.rotation.z = 0;
    const rec = { obj, kind: 'blade', z: obj.position.z, prevZ: obj.position.z, spin: 0, hit: false };
    g.obstacles.movers.push(rec);
    for (let i = 0; i < 24; i++) {
      rec.z = g.player.pos.z - 0.4;
      rec.prevZ = rec.z;
      obj.position.z = rec.z;
      g.player.pos.x = 3.6;
      g.player.pos.y = 15.6;
      g.player.vy = 0;
      await sleep(50);
    }
    g.obstacles.onCrash = oc;
    const idx = g.obstacles.movers.indexOf(rec);
    if (idx >= 0) g.obstacles.movers.splice(idx, 1);
    g.obstacles._release('blade', obj);
    return { hits, pass: hits === 0 };
  });

  // 5) ENEMY CONTACT COSTS ONE health charge and play continues
  verdicts.enemyDamage = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    g.noDeath = false;
    g.player.shield = 0;
    g.player.health = 3;
    g.player.hitInvuln = 0;
    const e = g.enemies.spawn(g.player.pos.z - 3, 'chase', 0);
    e.obj.position.set(g.player.pos.x, g.player.pos.y, g.player.pos.z - 3);
    e.r = 1.4;
    let hit = false;
    for (let i = 0; i < 30; i++) {
      await sleep(50);
      if (g.player.health === 2) { hit = true; break; }
    }
    g.noDeath = true;
    return { hit, health: g.player.health, state: g.state, pass: hit && g.state === 2 };
  });

  verdicts.errors = errors.slice(0, 4);
  verdicts.allPass = ['flap', 'bladeGap', 'bladeArm', 'bladeFar', 'enemyDamage'].every(k => verdicts[k].pass);
  console.log(JSON.stringify(verdicts, null, 2));
  await browser.close();
  process.exit(verdicts.allPass ? 0 : 1);
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
