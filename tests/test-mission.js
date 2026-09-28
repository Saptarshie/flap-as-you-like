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

  // fire continuously from the moment boss is active; log hp + ball y vs boss y
  const t0 = Date.now();
  let result = null;
  let lastLog = 0;
  while (Date.now() - t0 < 130000) {
    const s = await page.evaluate(() => {
      const g = window.__game;
      const bz = g.player.pos.z;
      let best = null;
      for (const gt of g.obstacles.gates) if (gt.z < bz - 4 && (!best || gt.z > best.z)) best = gt;
      let target = best ? best.gapY : 14;
      if (g.boss.active && g.boss.pos) target = Math.max(9, Math.min(24, g.boss.pos.y));
      if (g.boss.active && g.boss.phase === 1) {
        if (g.combat.cooldown <= 0) g.combat.fire(g.player.mouthPos(g.player.vel), null);
      }
      const balls = g.combat.balls.slice(0, 3).map(b => ({ y: +b.obj.position.y.toFixed(1), z: +b.obj.position.z.toFixed(1), dead: b.dead }));
      return {
        y: g.player.pos.y, target, state: g.state, dist: Math.round(g.distance),
        boss: g.boss.active, bossHp: g.boss.hp, phase: g.boss.phase, bossY: g.boss.pos ? +g.boss.pos.y.toFixed(1) : null, bossZ: g.boss.pos ? +g.boss.pos.z.toFixed(1) : null,
        balls,
      };
    });
    if (s.state === 3 || s.state === 4) { result = { died: true, ...s }; break; }
    if (s.dist > 7200) { result = { timeout: true, ...s }; break; }
    if (s.y < s.target - 0.35) await page.keyboard.press('ArrowUp');
    await new Promise(r => setTimeout(r, 60));
  }
  if (!result) result = { timeout: true };
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });