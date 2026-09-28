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
  await new Promise(r => setTimeout(r, 1500));

  // surgical: place a ball exactly 2m in front of boss (z+2), run ONE _combatCollisions tick
  const probe = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    g.boss.maybeSpawn(999999, 40);
    for (let i = 0; i < 50; i++) { await sleep(150); if (g.boss.phase === 1) break; }
    // pause boss motion: not possible; but do it fast
    const hp0 = g.boss.hp;
    // acquire a real ball object from fire, then place it
    g.combat.cooldown = 0;
    g.combat.fire(g.player.mouthPos(g.player.vel), null);
    const ball = g.combat.balls[g.combat.balls.length - 1];
    if (!ball) return { error: 'no ball' };
    ball.obj.position.set(g.boss.pos.x, g.boss.pos.y, g.boss.pos.z + 1.5);
    const distBefore = ball.obj.position.distanceTo(g.boss.pos);
    // run one collision pass synchronously
    g._combatCollisions();
    return {
      hp0, hp1: g.boss.hp, distBefore: +distBefore.toFixed(2),
      ballDead: ball.dead, bossActive: g.boss.active, phase: g.boss.phase,
      bossZ: +g.boss.pos.z.toFixed(1), bonusActive: g.bonus.active,
    };
  });
  console.log(JSON.stringify(probe, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });