import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer from '../../server/node_modules/puppeteer/lib/puppeteer/puppeteer.js';

const dist = new URL('../dist/', import.meta.url);
const output = new URL('../../deploy/.server-review/mobile/', import.meta.url);
await mkdir(output, { recursive: true });
const captureOnly = process.argv.includes('--capture-only');
const caseItem = { id: 1, case_number: '2026/124', title: 'دعوى المطالبة بالتعويض عن الأضرار والإخلال بشروط العقد', client_name: 'أحمد محمد علي', status: 'active', case_type: 'مدني', court_name: 'محكمة طرابلس الابتدائية', lead_lawyer_name: 'محمد عبد الله' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    const data = path === '/api/auth/me'
      ? { user: { id: 1, name: 'محمد عبد الله', role: 'admin' }, tenant: { name: 'مكتب العدالة', plan: 'pro' }, subscription: { status: 'active' } }
      : { cases: [caseItem], clients: [{ id: 1, name: caseItem.client_name, phone: '0912345678' }], tasks: [{ id: 1, title: 'مراجعة مذكرة الدفاع', assigned_to_name: 'محمد عبد الله', priority: 'urgent', status: 'todo', due_date: '2026-10-12' }], events: [], data: [], documents: [], notifications: [], users: [] };
    res.end(JSON.stringify(data)); return;
  }
  try {
    const file = new URL(path === '/' ? 'index.html' : `.${path}`, dist);
    assert.ok(file.href.startsWith(dist.href));
    res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setBypassServiceWorker(true);
  // The fixture server has no release lifecycle; keep SW update reloads out of layout checks.
  await page.evaluateOnNewDocument(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register = async () => { throw new Error('Service worker disabled in layout fixture'); };
  });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => document.body.innerText.includes('نظرة عامة على المكتب'));
  await page.evaluate(() => document.fonts.ready);
  const click = async (text, selector = 'button') => {
    await page.waitForFunction((value, query) => [...document.querySelectorAll(query)].some((el) => el.innerText.trim() === value), {}, text, selector);
    return page.evaluate((value, query) => {
    const element = [...document.querySelectorAll(query)].find((el) => el.innerText.trim() === value);
    if (!element) throw new Error('Button not found: ' + value);
    element.click();
    }, text, selector);
  };
  for (const theme of ['dark', 'light']) {
    await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
    await page.evaluate(() => Promise.all(document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => {}))));
    await page.screenshot({ path: fileURLToPath(new URL(`${captureOnly ? 'before' : 'after'}-dashboard-${theme}.png`, output)) });
    if (!captureOnly) await (await page.$('.mobile-bottom-nav')).screenshot({ path: fileURLToPath(new URL(`nav-${theme}.png`, output)) });
  }
  await click('القضايا', '.mobile-bottom-nav button');
  await page.waitForSelector('.datatable-mobile-card');
  await page.screenshot({ path: fileURLToPath(new URL(`${captureOnly ? 'before' : 'after'}-cases.png`, output)) });
  if (!captureOnly) {
    for (const width of [320, 390, 768]) {
      await page.setViewport({ width, height: 844, isMobile: true, hasTouch: true });
      await page.waitForFunction(() => !!document.querySelector('.datatable-mobile-card'));
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const geometry = await page.evaluate(() => {
        const header = document.querySelector('.app-header');
        const card = document.querySelector('.datatable-mobile-card');
        const targets = [...card.querySelectorAll('button')].map((el) => el.getBoundingClientRect());
        return { headerFits: header.scrollWidth <= header.clientWidth + 1, cardFits: card.scrollWidth <= card.clientWidth + 1, targetsFit: targets.every((rect) => rect.width >= 43.5 && rect.height >= 43.5 && rect.left >= 0 && rect.right <= innerWidth), targets: targets.map((rect) => rect.toJSON()), viewport: innerWidth };
      });
      assert.ok(geometry.headerFits, `Header overflow at ${width}`);
      assert.ok(geometry.cardFits, `Card overflow at ${width}`);
      assert.ok(geometry.targetsFit, `Small or clipped card actions at ${width}: ${JSON.stringify(geometry)}`);
      const navFits = await page.$eval('.mobile-bottom-nav', (nav) => [...nav.querySelectorAll('button')].every((button) => {
        const rect = button.getBoundingClientRect();
        const label = button.querySelector('span');
        return rect.width >= 44 && rect.height >= 44 && rect.left >= 0 && rect.right <= innerWidth && label.scrollWidth <= label.clientWidth;
      }));
      assert.ok(navFits, `Navigation labels or targets do not fit at ${width}`);
      assert.equal(await page.$eval('.mobile-bottom-nav [aria-current="page"]', (button) => button.textContent.trim()), 'القضايا');
    }
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.click('button[aria-label="القائمة الرئيسية"]');
    console.log('Checking drawer Escape');
    await page.waitForSelector('.sidebar-container.mobile-open');
    assert.equal(await page.$eval('button[aria-label="القائمة الرئيسية"]', (button) => button.getAttribute('aria-expanded')), 'true');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.sidebar-container.mobile-open'));
    await page.click('button[aria-label="القائمة الرئيسية"]');
    console.log('Checking drawer navigation');
    await click('المستندات والملفات', 'aside button');
    await page.waitForFunction(() => document.body.innerText.includes('متصفح الأرشيف والمستندات'));
    assert.equal(await page.$('.sidebar-container.mobile-open'), null);
    await click('إرفاق / تصوير مستند');
    console.log('Checking upload dialog');
    await page.waitForSelector('[role="dialog"]');
    const dialog = await page.$eval('[role="dialog"]', (el) => ({ width: el.getBoundingClientRect().width, scroll: el.scrollWidth, client: el.clientWidth }));
    assert.ok(dialog.width <= 390 && dialog.scroll <= dialog.client + 1, 'Dialog overflows mobile');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    await page.setViewport({ width: 1280, height: 900, isMobile: true, hasTouch: true });
    console.log('Checking desktop and mobile resize');
    await click('إدارة القضايا', 'aside button');
    await page.waitForSelector('table');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.waitForSelector('.datatable-mobile-card');
    await page.screenshot({ path: fileURLToPath(new URL('after-cases.png', output)) });
    assert.deepEqual(errors, []);
    console.log('PASS: 320/390/768 mobile layouts, 44px actions, drawer Escape/navigation, upload dialog, desktop table and mobile resize; no runtime errors.');
  }
  console.log('Screenshots: ' + fileURLToPath(output));
} finally {
  await browser.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
}
