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
    g.nextEnemyAt = g.nextTornadoAt = g.nextPortalAt = 1e9;
    g.distance = 1400;
    g.boss.nextSpawnDistance = 1400;
    g._scheduleThreats();

    g.boss.group.position.z = -37.9;
    g.boss.update(0.1, g.speed, g.time, g.player.pos);
    const entranceWave = {
      active: g.boss.minions.length,
      spawned: g.boss._minionsSpawned,
      pool: g.boss._minionPool.length,
    };

    while (g.boss.hp > 2) g.boss.hit(1);
    const enrageWave = {
      phase: g.boss.phase,
      active: g.boss.minions.length,
      spawned: g.boss._minionsSpawned,
      pool: g.boss._minionPool.length,
    };

    for (let i = 0; i < 20; i++) g.boss._summonMinions();
    const capped = {
      active: g.boss.minions.length,
      spawned: g.boss._minionsSpawned,
      pool: g.boss._minionPool.length,
    };

    const target = g.boss.minions[0];
    const hpBefore = g.boss.hp;
    const minionsBefore = g.boss.minions.length;
    const scoreBefore = g.score;
    g.combat.cooldown = 0;
    g.combat.fire(target.obj.position.clone(), null);
    const ball = g.combat.balls[g.combat.balls.length - 1];
    ball.prevPos.copy(target.obj.position).add({ x: 0, y: 0, z: 3 });
    ball.obj.position.copy(target.obj.position).add({ x: 0, y: 0, z: -3 });
    g._combatCollisions();
    const shot = {
      minions: g.boss.minions.length,
      minionsBefore,
      hp: g.boss.hp,
      hpBefore,
      scoreGain: g.score - scoreBefore,
      ballDead: ball.dead,
    };

    const props = g.obstacles.bossProps.map((p) => ({ x: p.x, z: p.z, r: p.r }));
    for (let i = 0; i < 1200; i++) g.obstacles.updateBossArena(1 / 60, 82, g.player);
    const propsAfter = g.obstacles.bossProps.map((p) => ({ x: p.x, z: p.z }));

    return { entranceWave, enrageWave, capped, shot, props, propsAfter };
  });

    const checks = {
    guaranteedEntranceWave: result.entranceWave.active === 3 && result.entranceWave.spawned === 3,
    guaranteedEnrageWave: result.enrageWave.phase === 2 && result.enrageWave.active > result.entranceWave.active && result.enrageWave.spawned >= 6,
    boundedPool: result.capped.active <= 10 && result.capped.active + result.capped.pool === 10,
    minionsAreShootable: result.shot.minions === result.shot.minionsBefore - 1 && result.shot.hp === result.shot.hpBefore && result.shot.scoreGain >= 10 && result.shot.ballDead,
    sparseSideHazards: result.props.length >= 3 && result.propsAfter.length === result.props.length && result.props.every((p) => Math.abs(p.x) >= 17.5 && Math.abs(p.x) <= 22.5),
    noConsoleErrors: errors.length === 0,
  };
  for (const [name, ok] of Object.entries(checks)) console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
  if (errors.length) console.log(errors.join('\n'));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
})().catch((err) => { console.error(err); process.exit(1); });
