import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer from '../server/node_modules/puppeteer/lib/puppeteer/puppeteer.js';

const output = new URL('../artifacts/qa-2026-10-12/production/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ headless: true });
const errors = [];
const failedRequests = [];
const results = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/api/auth/me')) failedRequests.push({ status: response.status(), url: response.url() });
  });
  page.setDefaultTimeout(25000);
  await page.setViewport({ width: 1440, height: 1000 });
  const response = await page.goto('https://muhami.ly/?review=20261012', { waitUntil: 'networkidle2' });
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => document.body.innerText.length > 100);
  results.push({ check: 'Public web app loads', pass: true, title: await page.title() });
  for (const width of [1440, 375]) {
    await page.setViewport({ width, height: 1000 });
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.evaluate(() => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth }));
    assert.ok(layout.documentWidth <= layout.viewport + 1, 'Public page horizontal overflow');
    await page.screenshot({ path: fileURLToPath(new URL(`public-${width}.png`, output)), fullPage: false });
    results.push({ check: 'Public responsive layout', width, ...layout, pass: true });
  }
  await page.setViewport({ width: 1440, height: 1000 });
  const login = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button,a')].find(element => element.innerText.trim() === 'دخول' || /تسجيل الدخول|دخول النظام/.test(element.innerText));
    if (!button) return false;
    button.click();
    return true;
  });
  assert.ok(login, 'Login navigation missing');
  await page.waitForSelector('input[type="password"]');
  assert.ok(await page.$('input[type="email"]'), 'Login email input missing');
  results.push({ check: 'Public login form opens', pass: true });
  await page.screenshot({ path: fileURLToPath(new URL('login.png', output)) });
  assert.deepEqual(errors, [], 'Uncaught public JavaScript errors');
  assert.deepEqual(failedRequests, [], 'Unexpected public request failures');
  const report = { status: 'verified', results, errors, failedRequests, expected: 'Anonymous /api/auth/me 401 allowed; no real login or production mutation' };
  await fs.writeFile(new URL('browser-results.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
