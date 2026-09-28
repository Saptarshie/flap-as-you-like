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
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('[error] ' + msg.text()); });

  await page.goto('http://localhost:8321/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2200));
  await page.keyboard.press('Space');           // menu -> READY
  await new Promise(r => setTimeout(r, 400));
  await page.keyboard.press('ArrowUp');         // READY -> PLAY
  await new Promise(r => setTimeout(r, 400));
  for (let i = 0; i < 4; i++) {                 // a few flaps to approach first gate airborne
    await page.keyboard.press('ArrowUp');
    await new Promise(r => setTimeout(r, 260));
  }
  // now stop flapping: bird falls to floor clamp; next gate must crash it
  const t0 = Date.now();
  let died = false;
  while (Date.now() - t0 < 25000) {
    await new Promise(r => setTimeout(r, 400));
    const st = await page.evaluate(() => ({
      over: !document.getElementById('gameover').classList.contains('hidden'),
      score: document.getElementById('score').textContent,
      coins: document.getElementById('coins').textContent,
    }));
    if (st.over) { died = true; var finalInfo = st; break; }
  }
  await page.screenshot({ path: 'shot_death.png' });
  const panel = await page.evaluate(() => ({
    finalScore: document.getElementById('finalScore').textContent,
    finalCoins: document.getElementById('finalCoins').textContent,
    best: document.getElementById('best').textContent,
  }));
  await page.keyboard.press('Space');           // OVER -> restart
  await new Promise(r => setTimeout(r, 900));
  const after = await page.evaluate(() => ({
    hudShown: !document.getElementById('hud').classList.contains('hidden'),
    overHidden: document.getElementById('gameover').classList.contains('hidden'),
    score: document.getElementById('score').textContent,
    coins: document.getElementById('coins').textContent,
  }));
  await page.screenshot({ path: 'shot_restart.png' });
  console.log(JSON.stringify({ died, finalInfo, panel, after, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });