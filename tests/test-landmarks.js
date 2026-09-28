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
  await page.evaluate(() => {
    const g = window.__game;
    g.noDeath = true;
    window.__hold = true;
    const tick = () => {
      if (!window.__hold) return;
      if (g.state === 2) {
        if (g.player.pos.y < 11.5) g.player.flap(null);
        if (g.player.pos.y > 12.8) g.player.vy = Math.min(g.player.vy, 0);
      }
      requestAnimationFrame(tick);
    };
    tick();
    g.distance = 700;
  });

  // 1) tunnel pass on the centreline: expect inTunnel flip + +10 score within 40s
  const centre = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const s0 = g.score;
    let sawIn = false;
    for (let i = 0; i < 220; i++) {
      g.player.pos.x = 0;
      g.player.vel.x = 0;
      if (g.player.pos.y < 11.5) g.player.flap(null);
      if (g.landmarks.inTunnel) sawIn = true;
      await sleep(50);
      if (sawIn && g.score - s0 >= 10) break;
    }
    return { sawIn, scoreGain: g.score - s0, pass: sawIn && g.score - s0 >= 10 };
  });

  // 2) wall hit: pin bird at x=8.5 (outside clear radius 6.4) and expect one charge lost
  const wall = await page.evaluate(async () => {
    const g = window.__game;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    g.startRun();
    g.state = 2;
    g.noDeath = false;
    g.player.shield = 0;
    g.player.health = 3;
    g.player.hitInvuln = 0;
    g.distance = 700;
    let hit = false;
    let stuck = 0;
    for (let i = 0; i < 120; i++) {
      g.player.pos.x = 8.5;
      g.player.vel.x = 0;
      if (g.player.pos.y < 11.5) g.player.flap(null);
      await sleep(50);
      if (g.player.health === 2) { hit = true; break; }
      if (g.state !== 2) { stuck++; if (stuck > 4) break; }
    }
    g.noDeath = true;
    window.__hold = false;
    return { hit, health: g.player.health, state: g.state, pass: hit && g.state === 2 };
  });

  const verdict = { centre, wall, allPass: centre.pass && wall.pass, errors: errors.slice(0, 3) };
  console.log(JSON.stringify(verdict, null, 2));
  await browser.close();
  process.exit(verdict.allPass ? 0 : 1);
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
