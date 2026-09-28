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

  const probe = await page.evaluate(() => {
    const g = window.__game;
    return {
      bossBirdLoaded: !!g.models.bossBird,
      usedFallback: g.boss.usedFallback,
      innerChildren: g.boss.inner ? g.boss.inner.children.length : -1,
      innerScale: g.boss.inner ? +g.boss.inner.scale.x.toFixed(2) : -1,
      baseScale: g.boss._baseScale ? +g.boss._baseScale.toFixed(2) : -1,
      bossVisible: g.boss.group.visible,
      enemyLoaded: !!g.models.enemy,
    };
  });
  console.log(JSON.stringify(probe, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });