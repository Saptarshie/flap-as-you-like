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

  // phase 1: 30s at normal distance, sample gates every 3s (7 samples)
  const phase1 = [];
  for (let i = 0; i < 7; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const s = await page.evaluate(() => ({
      dist: Math.round(window.__game.distance),
      gates: window.__game.obstacles.gates.length,
      spacing: +window.__game.obstacles.spacing.toFixed(1),
    }));
    phase1.push(s);
  }
  // phase 2: jump to 12km, keep flying 30s, sample
  await page.evaluate(() => {
    window.__game.distance = 12000;
    window.__game.boss.nextSpawnDistance = 1e9;
    window.__game.boss.active = false;
    window.__game._endBossCorridor();
  });
  const spawnedBefore = await page.evaluate(() => window.__game.obstacles.gatesSpawned);
  const phase2 = [];
  for (let i = 0; i < 7; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const s = await page.evaluate(() => ({
      dist: Math.round(window.__game.distance),
      gates: window.__game.obstacles.gates.length,
      spacing: +window.__game.obstacles.spacing.toFixed(1),
      gap: +window.__game.obstacles.gap.toFixed(1),
      movers: window.__game.obstacles.movers.length,
    }));
    phase2.push(s);
    if (s.gates === 0 && i > 1) break;
  }
  const spawnedAfter = await page.evaluate(() => window.__game.obstacles.gatesSpawned);

  const neverEmpty = phase1.every(s => s.gates > 0) && phase2.every(s => s.gates > 0);
  const keepsSpawning = spawnedAfter - spawnedBefore > 4;
  const hardMode = phase2[phase2.length - 1].spacing <= 35 && phase2[phase2.length - 1].gap <= 9;
  const verdict = {
    phase1, phase2,
    spawnedDelta: spawnedAfter - spawnedBefore,
    neverEmpty, keepsSpawning, hardMode,
    allPass: neverEmpty && keepsSpawning && hardMode,
    errors: errors.slice(0, 3),
  };
  console.log(JSON.stringify(verdict, null, 2));
  await browser.close();
  process.exit(verdict.allPass ? 0 : 1);
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
