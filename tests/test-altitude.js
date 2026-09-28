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

  // closed-loop altitude hold at y ~ 14 for 30s
  const t0 = Date.now();
  let taps = 0;
  while (Date.now() - t0 < 30000) {
    const y = await page.evaluate(() => window.__game.player.pos.y);
    if (y < 13.5) { await page.keyboard.press('ArrowUp'); taps++; }
    await new Promise(r => setTimeout(r, 90));
    const st = await page.evaluate(() => ({
      over: !document.getElementById('gameover').classList.contains('hidden'),
      score: document.getElementById('score').textContent,
      coins: document.getElementById('coins').textContent,
    }));
    if (st.over) { console.log(JSON.stringify({ died: true, ...st, taps, errors }, null, 2)); await browser.close(); return; }
  }
  const result = await page.evaluate(() => ({
    score: document.getElementById('score').textContent,
    coins: document.getElementById('coins').textContent,
    speed: document.getElementById('speed').textContent,
    y: +window.__game.player.pos.y.toFixed(1),
    dist: Math.round(window.__game.distance),
  }));
  console.log(JSON.stringify({ survived: true, taps, ...result, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });