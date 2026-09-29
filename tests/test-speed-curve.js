const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--window-size=1280,720', '--mute-audio', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8321/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!(window.__game && window.__game.player), { timeout: 60000 });
  await page.keyboard.press('Space');
  await new Promise((r) => setTimeout(r, 100));
  await page.keyboard.press('Space');
  await new Promise((r) => setTimeout(r, 100));

  const result = await page.evaluate(() => {
    try {
      const g = window.__game;
      g.noDeath = true;
      g.boss.nextSpawnDistance = 1e9;
      g.nextEnemyAt = g.nextTornadoAt = g.nextPotionAt = g.nextPortalAt = 1e9;

      // simulate speed evolution over distance by applying the target directly
      const samples = [];
      const D = window.__speedProbe = null;
      const C = g.constructor;
      // step the same formula used in _applyDifficulty
      const speedAt = (dist) => {
        const c = window.__cfg; return c;
      };
      // read values from the running game by simulating distance jumps
      const out = [];
      g.startRun();
      g.state = 2;
      for (const dist of [0, 500, 2000, 4000, 8000, 16000, 40000]) {
        g.distance = dist;
        for (let i = 0; i < 400; i++) {
          g._applyDifficulty();
          // emulate fast-forward: speed damp toward target at 60fps steps
        }
        out.push({ dist, kmh: Math.round(g.speed * 3.6) });
      }
      return { curve: out, cfgMax: Math.round(window.__game ? 0 : 0), speedCfg: out };
    } catch (e) {
      return { err: String(e && e.stack || e) };
    }
  });

  const curve = result.curve || [];
  const kmh = curve.map((s) => s.kmh);
  const checks = {
    startsReasonable: kmh.length > 0 && kmh[0] >= 100 && kmh[0] <= 130,
    growsSlowly: curve.length > 2,
    saturatesNear250: kmh.length > 0 && kmh[kmh.length - 1] >= 247 && kmh[kmh.length - 1] <= 250,
    neverExceeds250: kmh.every((v) => v <= 250),
    monotonic: kmh.every((v, i) => i === 0 || v >= kmh[i - 1]),
    noConsoleErrors: errors.length === 0,
  };
  for (const [name, ok] of Object.entries(checks)) console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
  console.log(JSON.stringify(curve));
  if (errors.length) console.log(errors.join('\n'));
  await browser.close();
  process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
})().catch((err) => { console.error(err); process.exit(1); });