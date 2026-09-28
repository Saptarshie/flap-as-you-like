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

  const deaths = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 80000) {
    const s = await page.evaluate(() => {
      const g = window.__game;
      const bz = g.player.pos.z;
      let best = null;
      for (const gt of g.obstacles.gates) if (gt.z < bz - 4 && (!best || gt.z > best.z)) best = gt;
      const d = {
        dist: Math.round(g.distance),
        boss: g.boss.active,
        bossZ: g.boss.pos ? +g.boss.pos.z.toFixed(1) : null,
        bossY: g.boss.pos ? +g.boss.pos.y.toFixed(1) : null,
        birdY: +g.player.pos.y.toFixed(1),
        birdX: +g.player.pos.x.toFixed(1),
        swooping: g.boss._swoopState || null,
        target: best ? +best.gapY.toFixed(1) : 14,
      };
      // record frames where boss is very close
      if (d.boss && d.bossZ > -6) {
        window.__close = window.__close || [];
        window.__close.push(d);
      }
      return d;
    });
    if (s.boss && s.swooping) {
      const dodgeY = s.bossY > 16 ? 8 : 22;
      if (s.y < dodgeY - 1) await page.keyboard.press('ArrowUp');
    } else if (s.y < s.target - 0.35) await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Space');
    await new Promise(r => setTimeout(r, 70));
    if (s.dist > 4600) break;
  }
  const close = await page.evaluate(() => (window.__close || []).slice(0, 20));
  console.log(JSON.stringify({ closeFrames: close, errors: errors.slice(0, 3) }, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });