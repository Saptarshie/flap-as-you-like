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
  await new Promise(r => setTimeout(r, 500));

  const info = await page.evaluate(() => {
    const g = window.__game;
    const obs = g.obstacles;
    const coins = obs.coins.map(c => ({ x: +c.obj.position.x.toFixed(1), y: +c.obj.position.y.toFixed(1), z: +c.z.toFixed(1) }));
    const rings = obs.rings.map(r => ({ x: +r.obj.position.x.toFixed(1), y: +r.obj.position.y.toFixed(1), r: +r.r.toFixed(2), z: +r.z.toFixed(1) }));
    const gates = obs.gates.map(gt => ({ gapY: +gt.gapY.toFixed(1), half: +gt.half.toFixed(1), z: +gt.z.toFixed(1) }));
    const bird = { x: +g.player.pos.x.toFixed(1), y: +g.player.pos.y.toFixed(1), z: +g.player.pos.z.toFixed(1) };
    return { bird, gates: gates.slice(0, 4), coins: coins.slice(0, 10), rings: rings.slice(0, 4), coinCount: obs.coins.length, gateCount: obs.gates.length };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });