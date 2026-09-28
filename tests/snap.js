const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--window-size=1280,800']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:8321/', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: 'qa_menu.png' });
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 500));
  await page.keyboard.press('ArrowUp');
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: 'qa_play.png' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'qa_play2.png' });
  console.log('screens saved');
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });