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

  const samples = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const s = await page.evaluate(() => {
      const g = window.__game;
      if (!g.boss.active) {
        g.boss.maybeSpawn(999999, 40);
        if (!g.boss.active) return null;
      }
      const bp = g.boss.pos;
      const bz = g.player.pos.z;
      let best = null;
      for (const gt of g.obstacles.gates) if (gt.z < bz - 4 && (!best || gt.z > best.z)) best = gt;
      return {
        phase: g.boss.phase, bossZ: +bp.z.toFixed(1), bossY: +bp.y.toFixed(1), bossX: +bp.x.toFixed(1),
        birdY: +g.player.pos.y.toFixed(1), target: best ? +best.gapY.toFixed(1) : 14,
        swooping: g.boss._swoopState || null,
        dist: Math.round(g.distance),
      };
    });
    if (s) {
      samples.push(s);
      // autopilot: avoid boss Z band, else track gate
      if (s.swooping || Math.abs(s.bossZ - 0) < 42) {
        // dodge: go to y opposite of boss
        const dodgeY = s.bossY > 16 ? 8 : 22;
        if (s.y < dodgeY - 1) await page.keyboard.press('ArrowUp');
      } else if (s.y < s.target - 0.35) await page.keyboard.press('ArrowUp');
    } else {
      await new Promise(r => setTimeout(r, 80));
      continue;
    }
    await new Promise(r => setTimeout(r, 70));
    if (samples.length > 700) break;
  }
  // summarize: swoop cadence + how often boss enters z > -10 (player zone)
  const analysis = await page.evaluate((samples) => {
    let swoops = 0, inZone = 0, maxZ = -999;
    for (const s of samples) {
      if (s.swooping === 'out') swoops++;
      if (s.bossZ > -12) inZone++;
      maxZ = Math.max(maxZ, s.bossZ);
    }
    return { samples: samples.length, swoopOutFrames: swoops, framesBossInPlayerZone: inZone, maxBossZ: maxZ };
  }, samples);
  console.log(JSON.stringify(analysis, null, 2));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });