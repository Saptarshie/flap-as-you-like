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
    g.noDeath = true;
    g.obstacles.clearSpan(-1000, 100);
    g.obstacles._spawnGate(-100);
    g.enemies.spawn(-80, 'chase', 0);
    g.tornados.spawn(-70);
    g.landmarks._spawnTunnel(-120);
    g.bonus.scheduleAt(0);
    g.bonus.update(0.1, 34, g.time, g.player.pos);

    g.distance = 1400;
    g.boss.nextSpawnDistance = 1400;
    g._scheduleThreats();
    const entered = {
      corridor: g.bossCorridorActive,
      gates: g.obstacles.gates.length,
      movers: g.obstacles.movers.length,
      enemies: g.enemies.count,
      tornados: g.tornados.count,
      tunnels: g.landmarks.tunnels.length,
      portal: g.bonus.portalActive,
      bossProps: g.obstacles.bossProps.length,
      spawnZ: g.obstacles.spawnZ,
    };

    const frozenZ = g.obstacles.spawnZ;
    for (let i = 0; i < 600; i++) {
      g.obstacles.update(1 / 60, 60, g.player, g.time + i / 60, null, true, false);
      g.obstacles.updateBossArena(1 / 60, 60, g.player);
      g._scheduleThreats();
    }
    const held = {
      gates: g.obstacles.gates.length,
      enemies: g.enemies.count,
      tornados: g.tornados.count,
      tunnels: g.landmarks.tunnels.length,
      portal: g.bonus.portalActive,
      cursorFrozen: g.obstacles.spawnZ === frozenZ,
      bossProps: g.obstacles.bossProps.length,
    };

    g.boss.group.position.set(0, 12, -20);
    g.boss.phase = 1;
    const hp0 = g.boss.hp;
    g.combat.cooldown = 0;
    g.combat.fire(g.boss.pos.clone(), null);
    const ball = g.combat.balls[g.combat.balls.length - 1];
    ball.obj.position.copy(g.boss.pos);
    g._combatCollisions();
    const shotDamaged = g.boss.hp === hp0 - 1;

    g.boss.active = false;
    g._syncBossCorridor();
    const resumed = {
      corridor: g.bossCorridorActive,
      enemyDelay: g.nextEnemyAt - g.distance,
      tornadoDelay: g.nextTornadoAt - g.distance,
      tunnelDelay: g.landmarks.nextTunnelAt - g.distance,
      bossDelay: g.boss.nextSpawnDistance - g.distance,
      spawnZ: g.obstacles.spawnZ,
    };

    const meshes = [];
    g.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    return {
      entered,
      held,
      shotDamaged,
      resumed,
      renderRatio: g.renderRatio,
      bloom: g.bloom.enabled,
      shadowSize: g.sun.shadow.mapSize.x,
      shadowCasters: meshes.filter((o) => o.castShadow).length,
      meshes: meshes.length,
      tornadoDust: g.tornados.pool[0]?.dust.length || 0,
    };
  });

  const checks = {
    clearsArena: result.entered.corridor && result.entered.gates === 0 && result.entered.movers === 0 && result.entered.enemies === 0 && result.entered.tornados === 0 && result.entered.tunnels === 0 && !result.entered.portal && result.entered.bossProps === 3,
    staysClear: result.held.gates === 0 && result.held.enemies === 0 && result.held.tornados === 0 && result.held.tunnels === 0 && !result.held.portal && result.held.cursorFrozen && result.held.bossProps === 3,
    shootingWorks: result.shotDamaged,
    resumesWithoutBurst: !result.resumed.corridor && result.resumed.enemyDelay === 240 && result.resumed.tornadoDelay === 320 && result.resumed.tunnelDelay >= 700 && result.resumed.bossDelay === 2200,
    optimizedPipeline: result.renderRatio <= 1.25 && !result.bloom && result.shadowSize === 512 && result.shadowCasters < result.meshes * 0.2 && result.tornadoDust === 120,
    noConsoleErrors: errors.length === 0,
  };
  for (const [name, ok] of Object.entries(checks)) console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
  if (errors.length) console.log(errors.join('\n'));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
})().catch((err) => { console.error(err); process.exit(1); });
