const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--enable-webgl', '--window-size=1280,800']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  await page.goto('http://localhost:8321/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2200));
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 400));
  await page.keyboard.press('ArrowUp');
  await new Promise(r => setTimeout(r, 300));

  const t0 = Date.now();
  let taps = 0, released = false;
  while (Date.now() - t0 < 40000) {
    const s = await page.evaluate(() => {
      const g = window.__game;
      const bz = g.player.pos.z;
      let target = 14;
      let best = null;
      for (const gt of g.obstacles.gates) {
        if (gt.z < bz - 4 && (!best || gt.z > best.z)) best = gt;
      }
      if (best) target = best.gapY;
      return { y: g.player.pos.y, target, over: !document.getElementById('gameover').classList.contains('hidden'), state: g.state };
    });
    if (s.over || s.state === 3) break;
    if (s.over) break;
    if (s.y < s.target - 0.7) { await page.keyboard.press('ArrowUp'); taps++; }
    else if (s.y > s.target + 0.7 && !released) { /* gravity does it */ }
    await new Promise(r => setTimeout(r, 80));
  }
  const result = await page.evaluate(() => ({
    over: !document.getElementById('gameover').classList.contains('hidden'),
    score: document.getElementById('score').textContent,
    coins: document.getElementById('coins').textContent,
    speed: document.getElementById('speed').textContent,
    dist: Math.round(window.__game.distance),
  }));
  console.log(JSON.stringify({ taps, ...result, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });