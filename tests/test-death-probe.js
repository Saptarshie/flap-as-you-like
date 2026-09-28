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

  // record bird path samples until death
  const path = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const s = await page.evaluate(() => {
      const g = window.__game;
      const bz = g.player.pos.z;
      let target = 14, best = null;
      for (const gt of g.obstacles.gates) if (gt.z < bz - 4 && (!best || gt.z < best.z)) best = gt;
      if (best) target = best.gapY;
      return {
        y: +g.player.pos.y.toFixed(1), x: +g.player.pos.x.toFixed(1),
        vy: +g.player.vy.toFixed(1), target: +target.toFixed(1),
        over: !document.getElementById('gameover').classList.contains('hidden'),
        state: g.state,
      };
    });
    path.push(s);
    if (s.over) break;
    if (s.y < s.target - 0.7) await page.keyboard.press('ArrowUp');
    await new Promise(r => setTimeout(r, 80));
  }
  const deathProbe = await page.evaluate(() => {
    const g = window.__game;
    const obs = g.obstacles;
    const nearest = obs.gates.map(gt => ({ z: +gt.z.toFixed(1), gapY: +gt.gapY.toFixed(1), half: +gt.half.toFixed(1), passed: gt.passed }))
      .sort((a, b) => Math.abs(a.z) - Math.abs(b.z))[0];
    const drifters = obs.drifters.map(d => ({ x: +d.obj.position.x.toFixed(1), y: +d.obj.position.y.toFixed(1), z: +d.z.toFixed(1), baseX: +d.baseX.toFixed(1), amp: +d.amp.toFixed(1) }));
    return { bird: { y: +g.player.pos.y.toFixed(1), x: +g.player.pos.x.toFixed(1) }, nearestGate: nearest, drifters, speed: +g.speed.toFixed(1) };
  });
  console.log(JSON.stringify({ deathProbe, pathTail: path.slice(-12), errors }, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });