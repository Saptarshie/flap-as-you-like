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

  // disable crashing; keep scoring. Fly through coins by servoing to next coin y.
  await page.evaluate(() => { window.__game.obstacles.onCrash = () => {}; });

  const t0 = Date.now();
  while (Date.now() - t0 < 35000) {
    const s = await page.evaluate(() => {
      const g = window.__game;
      const bz = g.player.pos.z;
      let target = null;
      for (const c of g.obstacles.coins) {
        if (!c.taken && c.z < bz - 4 && (!target || c.z > target.z)) target = c;
      }
      return {
        y: g.player.pos.y,
        targetY: target ? target.obj.position.y : 14,
        coins: document.getElementById('coins').textContent,
        score: document.getElementById('score').textContent,
      };
    });
    if (Number(s.coins) >= 3) { console.log(JSON.stringify({ collected: true, ...s, errors }, null, 2)); await browser.close(); return; }
    if (s.y < s.targetY - 3.5) await page.keyboard.press('ArrowUp');
    await new Promise(r => setTimeout(r, 80));
  }
  const final = await page.evaluate(() => ({
    coins: document.getElementById('coins').textContent,
    score: document.getElementById('score').textContent,
  }));
  console.log(JSON.stringify({ collected: false, ...final, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });