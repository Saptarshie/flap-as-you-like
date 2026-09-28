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

  // hold bird level at y=14 while probes run (simple flap keep-up loop happens in evaluate via rAF)
  await page.evaluate(() => {
    const g = window.__game;
    window.__hold = true;
    const tick = () => {
      if (!window.__hold) return;
      if (g.state === 2 || g.state === 5) {
        if (g.player.pos.y < 13.6) g.player.flap(null);
      }
      requestAnimationFrame(tick);
    };
    tick();
  });

  // probe 1: powerups on the flight line
  const pu = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    g.powerups.spawnPotion(g.player.pos.z - 55);
    const p = g.powerups.list[g.powerups.list.length - 1];
    p.obj.position.x = 0; p.baseY = 14;
    await sleep(1400);
    const gotPotion = g.player.speedBoost > 0 || g.player.shield > 0;
    const kind = p.kind;
    g.powerups.spawnGemLine(g.player.pos.z - 55);
    const gems = g.powerups.list.filter(x => x.kind === 'gem');
    for (const gm of gems) { gm.obj.position.x = 0; gm.baseY = 14; }
    await sleep(1600);
    return { gotPotion, kind, gems: gems.length, mult: g.multiplier, boost: g.player.speedBoost > 0, shield: g.player.shield > 0 };
  });

  // probe 2: shield absorbs damage
  const shieldTest = await page.evaluate(() => {
    const g = window.__game;
    g.player.shield = 6;
    g.damagePlayer('test');
    return { stateAfter: g.state, shieldUsed: g.player.shield < 6 };
  });

  // probe 3: boss fight
  const bossTest = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    g.boss.maybeSpawn(999999, 40);
    await sleep(150);
    const spawned = g.boss.active;
    const hp0 = g.boss.hp;
    const bp = g.boss.pos || (g.boss.group && g.boss.group.position);
    return { spawned, hp0, bossPosExists: !!bp, z: bp ? +bp.z.toFixed(1) : null };
  });
  let defeated = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    await page.evaluate(() => {
      const g = window.__game;
      if (g.boss.active) {
        g.combat.cooldown = 0;
        g.combat.fire(g.player.mouthPos(g.player.vel), null);
      }
    });
    await new Promise(r => setTimeout(r, 140));
    const st = await page.evaluate(() => ({ active: window.__game.boss.active, kills: window.__game.bossKills, hp: window.__game.boss.hp }));
    if (!st.active && st.kills > 0) { defeated = true; break; }
    if (!st.active) break;
  }
  const bossFinal = await page.evaluate(() => ({ kills: window.__game.bossKills, active: window.__game.boss.active, phase: window.__game.boss.phase, score: window.__game.score, hp: window.__game.boss.hp }));

  // probe 4: bonus garden
  const bonusTest = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    g.bonus.scheduleAt(1);
    await sleep(400);
    const portalSeen = g.bonus.portalActive;
    g.bonus.portalObj && (g.bonus.portalObj.position.z = g.player.pos.z - 3);
    const entered = g.bonus.tryEnter(g.player.pos);
    const st1 = g.state;
    await sleep(1200);
    const c0 = g.coins, s0 = g.score;
    await sleep(3500);
    return { portalSeen, entered, st1, coinsGained: g.coins - c0, scoreGained: g.score - s0, active: g.bonus.active, timeLeft: +g.bonus.timeLeft.toFixed(1) };
  });
  const t1 = Date.now();
  while (Date.now() - t1 < 16000) {
    await new Promise(r => setTimeout(r, 300));
    const st = await page.evaluate(() => ({ state: window.__game.state, active: window.__game.bonus.active }));
    if (st.state === 2) break;
  }
  const bonusEnd = await page.evaluate(() => ({ state: window.__game.state, active: window.__game.bonus.active, coins: window.__game.coins, score: window.__game.score }));

  window_hold_cleanup: await page.evaluate(() => { window.__hold = false; });
  console.log(JSON.stringify({ pu, shieldTest, bossTest, bossFinal, defeated, bonusTest, bonusEnd, errors: errors.slice(0, 5) }, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });