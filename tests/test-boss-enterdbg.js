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
  await new Promise(r => setTimeout(r, 1500));

  const dbg = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    g.boss.maybeSpawn(999999, 40);
    await sleep(300);
    const s0 = { active: g.boss.active, enterCalls: window.__bossEnterCalls || 0, bossZ: window.__bossZ, bossActiveFrame: window.__bossActiveFrame };
    await sleep(2000);
    const s1 = { enterCalls: window.__bossEnterCalls || 0, bossZ: window.__bossZ, bossActiveFrame: window.__bossActiveFrame, phase: g.boss.phase, posZ: +g.boss.pos.z.toFixed(1) };
    await sleep(3000);
    const s2 = { enterCalls: window.__bossEnterCalls || 0, bossZ: window.__bossZ, bossActiveFrame: window.__bossActiveFrame, phase: g.boss.phase, posZ: +g.boss.pos.z.toFixed(1), hp: g.boss.hp };
    return { s0, s1, s2 };
  });
  console.log(JSON.stringify(dbg, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });