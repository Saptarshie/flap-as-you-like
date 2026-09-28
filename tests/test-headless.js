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
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      errors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  page.on('requestfailed', (r) => errors.push('[reqfail] ' + r.url() + ' ' + (r.failure() && r.failure().errorText)));

  await page.goto('http://localhost:8321/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500));

  const probe1 = await page.evaluate(() => {
    const c = document.getElementById('game');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    return {
      loadingHidden: document.getElementById('loading').classList.contains('hidden'),
      menuShown: !document.getElementById('menu').classList.contains('hidden'),
      webgl: !!gl,
      glVersion: gl && gl.getParameter(gl.VERSION),
    };
  });

  await page.screenshot({ path: 'shot_menu.png' });

  // start the game
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 1000));
  const probe2 = await page.evaluate(() => ({
    hudShown: !document.getElementById('hud').classList.contains('hidden'),
    score: document.getElementById('score').textContent,
  }));
  await page.screenshot({ path: 'shot_ready.png' });

  // simulate gameplay: flaps + steering for ~8 seconds
  for (let i = 0; i < 22; i++) {
    await page.keyboard.press('ArrowUp');
    await new Promise(r => setTimeout(r, 120));
    if (i % 3 === 0) await page.keyboard.down('ArrowRight');
    if (i % 3 === 2) await page.keyboard.up('ArrowRight');
    if (i % 5 === 0) await page.keyboard.down('ArrowLeft');
    if (i % 7 === 0) await page.keyboard.up('ArrowLeft');
  }
  await new Promise(r => setTimeout(r, 1200));
  const probe3 = await page.evaluate(() => ({
    score: document.getElementById('score').textContent,
    coins: document.getElementById('coins').textContent,
    speed: document.getElementById('speed').textContent,
    hint: document.getElementById('hint').textContent,
  }));
  await page.screenshot({ path: 'shot_play.png' });

  // keep going until death or 20s
  const t0 = Date.now();
  let died = false;
  while (Date.now() - t0 < 20000) {
    await page.keyboard.press('ArrowUp');
    await new Promise(r => setTimeout(r, 300));
    const st = await page.evaluate(() => ({
      over: !document.getElementById('gameover').classList.contains('hidden'),
      score: document.getElementById('score').textContent,
    }));
    if (st.over) { died = true; probe3.finalScore = st.score; break; }
  }
  await page.screenshot({ path: 'shot_end.png' });
  const finalState = await page.evaluate(() => ({
    over: !document.getElementById('gameover').classList.contains('hidden'),
    finalScore: document.getElementById('finalScore').textContent,
    best: document.getElementById('best').textContent,
  }));

  // restart
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 800));
  const probe4 = await page.evaluate(() => ({
    hudShown: !document.getElementById('hud').classList.contains('hidden'),
    overHidden: document.getElementById('gameover').classList.contains('hidden'),
    score: document.getElementById('score').textContent,
  }));

  console.log(JSON.stringify({ probe1, probe2, probe3, finalState, probe4, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });