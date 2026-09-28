const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8321/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!(window.__game && window.__game.player), { timeout: 60000 });
  await page.keyboard.press('Space');
  await sleep(100);
  await page.keyboard.press('Space');
  await sleep(100);

  const result = await page.evaluate(() => {
    const g = window.__game;
    g.obstacles.isBlocked = () => true;
    g.obstacles.clearSpan(-1000, 100);
    g.nextEnemyAt = g.nextTornadoAt = g.nextPotionAt = g.nextPortalAt = 1e9;
    g.noDeath = false;

    const start = g.player.health;
    g.damagePlayer('test');
    const afterOne = { health: g.player.health, state: g.state, alive: g.player.alive };
    g.player.hitInvuln = 0;
    g.player.healT = 5.9;
    g.player.update(0.2, 34, 0, 0, null, 0);
    const afterHeal = g.player.health;

    g.player.hitInvuln = 0;
    g.damagePlayer('test');
    g.player.hitInvuln = 0;
    g.damagePlayer('test');
    g.player.hitInvuln = 0;
    g.damagePlayer('test');
    const depleted = { health: g.player.health, state: g.state, alive: g.player.alive };

    g.startRun();
    g.state = 2;
    g.noDeath = true;
    g.boss.maybeSpawn(1400, 34);
    g.boss.group.position.set(0, 12, -20);
    g.boss.phase = 1;
    const hp0 = g.boss.hp;
    g.combat.fire(g.boss.pos.clone(), null);
    const ball = g.combat.balls[g.combat.balls.length - 1];
    ball.obj.position.copy(g.boss.pos);
    g._combatCollisions();
    const hp1 = g.boss.hp;
    g.ui.setBoss(g.boss.hp, g.boss.maxHp, g.boss.name, g.boss.active);

    g.tornados.reset();
    const tt = g.tornados.spawn(-30);
    const tornadoVisual = {
      helix: !!tt.rig.helix,
      dust: tt.rig.dust.length,
      broadInflow: tt.rig.dust.some((p) => p.outerR > 15),
      duplicateCore: !!tt.rig.core,
    };

    return {
      start,
      afterOne,
      afterHeal,
      depleted,
      hp0,
      hp1,
      bossShown: !document.getElementById('bossBar').classList.contains('hidden'),
      bossText: document.getElementById('bossHp').textContent,
      healthText: document.getElementById('healthText').textContent,
      tornadoVisual,
      terrainTexture: g.terrain.material.map.image.width,
      waterTexture: !!g.terrain.water.material.map,
    };
  });

  const checks = {
    startsAtThree: result.start === 3,
    oneHitContinues: result.afterOne.health === 2 && result.afterOne.state === 2 && result.afterOne.alive,
    healsOneAtSixSeconds: result.afterHeal === 3,
    zeroEndsRun: result.depleted.health === 0 && result.depleted.state === 3 && !result.depleted.alive,
    bossSpawnsEarlier: result.hp0 === 6 && result.bossShown,
    ballDamagesBoss: result.hp1 === result.hp0 - 1 && result.bossText === '5 / 6',
    tornadoShowsInflow: result.tornadoVisual.helix && result.tornadoVisual.dust === 120 && result.tornadoVisual.broadInflow && !result.tornadoVisual.duplicateCore,
    environmentDetailed: result.terrainTexture === 256 && result.waterTexture,
    noConsoleErrors: errors.length === 0,
  };
  for (const [name, ok] of Object.entries(checks)) console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
  if (errors.length) console.log(errors.join('\n'));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
})().catch((err) => { console.error(err); process.exit(1); });
