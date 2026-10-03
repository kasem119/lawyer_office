/**
 * يولّد أيقونات PWA بصيغة PNG من الشعار SVG الحالي.
 * تشغيل: node scripts/generate-icons.cjs (من جذر المشروع)
 * يستخدم Chrome المثبت محلياً (puppeteer-core يبحث في مواقع معروفة).
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'client', 'public', 'icons');
const SVG_PATH = path.join(PROJECT_ROOT, 'client', 'public', 'favicon.svg');

// عناصر واجهة الوندوز/ماك يبحث فيها puppeteer-core
const CANDIDATE_CHROME_PATHS = [
  process.env.CHROME_PATH,
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);

function findChrome() {
  for (const p of CANDIDATE_CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function main() {
  let chromium;
  // puppeteer مثبت في server/node_modules — جرّب المسار المباشر
  const candidates = [
    'puppeteer-core',
    'puppeteer',
    path.join(PROJECT_ROOT, 'server', 'node_modules', 'puppeteer-core'),
    path.join(PROJECT_ROOT, 'server', 'node_modules', 'puppeteer')
  ];
  for (const candidate of candidates) {
    try { chromium = require(candidate); break; } catch {}
  }
  if (!chromium) {
    console.error('لا يوجد puppeteer ولا puppeteer-core في node_modules');
    process.exit(1);
  }

  const chromePath = findChrome();
  const launchOptions = chromePath
    ? { executablePath: chromePath }
    : {};

  const browser = await chromium.launch({ ...launchOptions, headless: true });
  const page = await browser.newPage();

  const svg = fs.readFileSync(SVG_PATH, 'utf8');

  // خلفية داكنة مطابقة لهوية التطبيق (bg-dark #0b1120) مع الشعار الذهبي بالوسط
  const sizes = [
    { name: 'icon-192.png', size: 192, padding: 0.14 },
    { name: 'icon-512.png', size: 512, padding: 0.14 },
    { name: 'icon-maskable-192.png', size: 192, padding: 0.22 },
    { name: 'icon-maskable-512.png', size: 512, padding: 0.22 },
    { name: 'apple-touch-icon.png', size: 180, padding: 0.16 }
  ];

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const { name, size, padding } of sizes) {
    const logoSize = Math.round(size * (1 - padding * 2));
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;}
  .canvas{width:${size}px;height:${size}px;background:#0b1120;display:flex;align-items:center;justify-content:center;}
  .logo{width:${logoSize}px;height:${logoSize}px;}
</style></head>
<body><div class="canvas"><div class="logo">${svg}</div></div></body></html>`;

    // setContent قد يعلق أحياناً — نعيد المحاولة حتى 3 مرات مع انتظار بسيط بدل networkidle0
    let captured = false;
    for (let attempt = 1; attempt <= 3 && !captured; attempt++) {
      try {
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise((r) => setTimeout(r, 150));
        const el = await page.$('.canvas');
        await el.screenshot({ path: path.join(OUT_DIR, name), omitBackground: false });
        captured = true;
        console.log(`\u2714 ${name} (${size}x${size})`);
      } catch (err) {
        console.warn(`\u26a0 ${name}: attempt ${attempt} failed (${err.message.split('\n')[0]})`);
        if (attempt === 3) throw err;
      }
    }
  }

  await browser.close();
  console.log('تم توليد جميع الأيقونات في client/public/icons');
}

main().catch((err) => { console.error(err); process.exit(1); });
