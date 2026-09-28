const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--window-size=1280,800']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('http://localhost:8321/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2200));
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 400));
  await page.keyboard.press('ArrowUp');
  await new Promise(r => setTimeout(r, 300));

  // keep the bird alive: hover-hold while positioning camera for closeup
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('ArrowUp');
    await new Promise(r => setTimeout(r, 110));
  }
  await page.evaluate(() => {
    const g = window.__game;
    // freeze crash while we frame the shot
    const crash = g.obstacles.onCrash;
    g.obstacles.onCrash = () => {};
    g.player.alive = true;
    g.player.mesh.visible = true;
    g.camera.position.set(g.player.pos.x + 2.2, g.player.pos.y + 0.9, g.player.pos.z + 4.2);
    g.camera.lookAt(g.player.pos.x, g.player.pos.y, g.player.pos.z);
    g.bokeh.uniforms['focus'].value = 4.8;
  });
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: 'qa_closeup.png' });
  console.log('closeup saved');
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });