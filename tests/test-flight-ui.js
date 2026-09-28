const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--window-size=1280,720', '--mute-audio', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  const results = [];
  const check = (name, ok) => {
    results.push({ name, ok });
    console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
  };

  await page.goto('http://localhost:8321/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!(window.__game && window.__game.player), { timeout: 60000 });

  await page.keyboard.press('Space');
  await sleep(300);
  await page.keyboard.press('ArrowUp');
  await sleep(150);

  await page.evaluate(() => {
    const g = window.__game;
    g.noDeath = true;
    g.obstacles.isBlocked = () => true;
    g.obstacles.clearSpan(-500, 60);
    g.nextTornadoAt = 9e9;
    g.nextEnemyAt = 9e9;
    g.nextPotionAt = 9e9;
    g.nextPortalAt = 9e9;
  });

  const pin = (frames) =>
    page.evaluate(
      (n) =>
        new Promise((resolve) => {
          const g = window.__game;
          let i = 0;
          const id = setInterval(() => {
            g.player.pos.y = 13;
            g.player.vy = 0;
            if (++i >= n) {
              clearInterval(id);
              resolve();
            }
          }, 16);
        }),
      frames
    );

  await pin(8);
  const altA = await page.evaluate(() => Number(document.getElementById('alt').textContent));
  await page.evaluate(() => window.__game.player.flap(null));
  await sleep(450);
  const altB = await page.evaluate(() => Number(document.getElementById('alt').textContent));
  check(
    'altitude readout present and tracks climb (A=' + altA.toFixed(1) + ' B=' + altB.toFixed(1) + ')',
    altA > 5 && altA < 20 && altB > altA + 1
  );

  const apexAt = async (lvl) => {
    await pin(8);
    return page.evaluate(
      (n) =>
        new Promise((resolve) => {
          const g = window.__game;
          g.setFlapLevel(n);
          g.player.vy = 0;
          const y0 = g.player.pos.y;
          g.player.flap(null);
          let best = y0;
          let i = 0;
          const id = setInterval(() => {
            best = Math.max(best, g.player.pos.y);
            if (++i > 55) {
              clearInterval(id);
              resolve(best - y0);
            }
          }, 16);
        }),
      lvl
    );
  };
  const apex1 = await apexAt(1);
  const apex5 = await apexAt(5);
  const apex9 = await apexAt(9);
  const flapHud = await page.evaluate(() => {
    const el = document.getElementById('flapLvl').textContent;
    window.__game.setFlapLevel(3);
    return { el, after: document.getElementById('flapLvl').textContent };
  });
  check(
    'flap power 1-9 scales lift (L1=' + apex1.toFixed(2) + ' L5=' + apex5.toFixed(2) + ' L9=' + apex9.toFixed(2) + ') HUD=' + flapHud.after,
    apex1 < 2.2 && apex5 > 2.8 && apex5 < 5.2 && apex9 > 6 && apex1 < apex5 && apex5 < apex9 && flapHud.after === '3'
  );

  const digitBind = await page.evaluate(() => {
    const g = window.__game;
    g.setFlapLevel(5);
    return g.player.flapLevel;
  });
  await page.keyboard.press('Digit7');
  await sleep(60);
  const afterDigit = await page.evaluate(() => window.__game.player.flapLevel);
  check('number key 7 sets flap power live (' + digitBind + '->' + afterDigit + ')', digitBind === 5 && afterDigit === 7);

  await pin(8);
  const diveDrop = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const g = window.__game;
        const y0 = g.player.pos.y;
        g.player.dive();
        setTimeout(() => resolve(y0 - g.player.pos.y), 800);
      })
  );
  await pin(8);
  await page.keyboard.press('ArrowDown');
  await sleep(50);
  const keyDiveVy = await page.evaluate(() => window.__game.player.vy);
  check(
    'down-arrow dives (drop ' + diveDrop.toFixed(2) + 'm/0.8s, key vy=' + keyDiveVy.toFixed(1) + ')',
    diveDrop > 4 && keyDiveVy < -8
  );

  const tornado = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const g = window.__game;
        g.tornados.reset();
        const tt = g.tornados.spawn(g.player.pos.z);
        tt.x = g.player.pos.x + 9;
        const x0 = g.player.pos.x;
        let i = 0;
        let netX = 0;
        const id = setInterval(() => {
          g.player.pos.y = 13;
          g.player.vy = 0;
          netX = g.player.pos.x - x0;
          if (++i > 150) {
            clearInterval(id);
            g.tornados.reset();
            resolve({ netX, alive: g.player.alive, toFunnel: Math.sign(tt.x - x0) === Math.sign(netX) && Math.abs(netX) > 1.2 });
          }
        }, 16);
      })
  );
  check(
    'tornado air field drifts+sucks path (dx=' + tornado.netX.toFixed(2) + 'u toward funnel, alive=' + tornado.alive + ')',
    tornado.alive === true && tornado.toFunnel
  );

  const coreSurvive = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const g = window.__game;
        g.noDeath = false;
        g.tornados.reset();
        const tt = g.tornados.spawn(g.player.pos.z);
        tt.x = g.player.pos.x;
        let i = 0;
        const id = setInterval(() => {
          g.player.pos.y = 13;
          g.player.vy = 0;
          if (++i > 120) {
            clearInterval(id);
            g.tornados.reset();
            resolve({ alive: g.player.alive });
          }
        }, 16);
      })
  );
  check('tornado is not a collider (sitting in core 2s alive=' + coreSurvive.alive + ')', coreSurvive.alive === true);

  await page.evaluate(() => {
    window.__game.noDeath = true;
  });
  const tunnelClean = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const g = window.__game;
        g.obstacles.clearSpan(-500, 60);
        g.obstacles.isBlocked = (z) => g.landmarks.blockedAt(z);
        for (const t of g.landmarks.tunnels) t.obj.visible = false;
        g.landmarks.tunnels.length = 0;
        g.obstacles.spawnZ = -200;
        g.obstacles._spawnGate(-200);
        const preGate = g.obstacles.gates.length;
        g.landmarks._spawnTunnel(g.player.pos.z - 200);
        const cleared = preGate - g.obstacles.gates.length;
        g.obstacles.spawnZ = -180;
        g.obstacles.ensureAhead(0);
        g.obstacles.ensureAhead(0);
        const t = g.landmarks.tunnels[0];
        const inSpan = (z) => Math.abs(z - t.z) < 26;
        const offenders = []
          .concat(g.obstacles.gates.map((o) => o.z))
          .concat(g.obstacles.movers.map((o) => o.z))
          .concat(g.obstacles.drifters.map((o) => o.z))
          .concat(g.obstacles.coins.map((o) => o.z))
          .filter(inSpan);
        resolve({ tzs: g.landmarks.tunnels.map((x) => x.z), offenders, gates: g.obstacles.gates.length, cleared });
      })
  );
  check(
    'no obstacles inside tunnel spans (cleared pre=' + tunnelClean.cleared + ', offenders=' + tunnelClean.offenders.length + ', gates outside=' + tunnelClean.gates + ')',
    tunnelClean.tzs.length > 0 && tunnelClean.cleared >= 1 && tunnelClean.offenders.length === 0 && tunnelClean.gates > 0
  );

  const blob = await page.evaluate(() => {
    const g = window.__game;
    const p = g.player;
    return {
      hasBlob: !!p.blob && p.blob.visible,
      blobOnGround: p.blob ? Math.abs(p.blob.position.y - g.terrain.groundHeightAt(p.pos.x, 0)) < 1 : false,
    };
  });
  check('blob shadow rests on terrain under bird (depth cue)', blob.hasBlob && blob.blobOnGround);

  const shotPath = path.join(__dirname, 'qa-flight-ui.png');
  await page.screenshot({ path: shotPath });
  check('no console errors during flight-UI suite', errors.length === 0);
  if (errors.length) console.log('ERRORS:', errors.slice(0, 5).join(' | '));

  const passed = results.filter((r) => r.ok).length;
  console.log('RESULT: ' + passed + '/' + results.length);
  await browser.close();
  try {
    fs.unlinkSync(shotPath);
  } catch {}
  process.exit(passed === results.length ? 0 : 1);
})();
