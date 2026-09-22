import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.dirname(__dirname);

async function generate() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 32, height: 32, deviceScaleFactor: 2 });

  const getSvgHtml = (scaleColor, badgeColor) => {
    return '<html><head><style>body { margin:0; padding:0; background:transparent; display:flex; align-items:center; justify-content:center; width:32px; height:32px; overflow:hidden; }</style></head><body>' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24">' +
      '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" fill="none" stroke="' + scaleColor + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" fill="none" stroke="' + scaleColor + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M7 21h10" fill="none" stroke="' + scaleColor + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M12 3v18" fill="none" stroke="' + scaleColor + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" fill="none" stroke="' + scaleColor + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="18.5" cy="5.5" r="4.5" fill="' + badgeColor + '" stroke="#FFFFFF" stroke-width="1.8"/>' +
      '</svg></body></html>';
  };

  // 1. Online icon
  await page.setContent(getSvgHtml('#E5A93C', '#10B981'));
  await page.screenshot({ path: path.join(serverDir, 'tray-online.png'), omitBackground: true });

  // 2. Offline icon
  await page.setContent(getSvgHtml('#94A3B8', '#EF4444'));
  await page.screenshot({ path: path.join(serverDir, 'tray-offline.png'), omitBackground: true });

  await browser.close();
  console.log('ICONS_GENERATED_SUCCESSFULLY');
}

generate().catch(console.error);
