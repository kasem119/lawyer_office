import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Generate Excel buffer from data
 * @param {Array} columns - Array of { header: 'Name', key: 'name', width: 20 }
 * @param {Array} data - Array of objects
 * @param {String} sheetName - Name of the worksheet
 * @returns {Promise<Buffer>}
 */
export const generateExcel = async (columns, data, sheetName = 'Sheet 1') => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ rightToLeft: true }] // RTL for Arabic
  });

  // Set columns
  worksheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width || 20
  }));

  // Style header row
  worksheet.getRow(1).font = { bold: true, size: 12 };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' }
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // Add data
  worksheet.addRows(data);

  // Style all cells
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  return await workbook.xlsx.writeBuffer();
};

/**
 * Generate PDF buffer from HTML string
 * @param {String} htmlContent - HTML string
 * @param {Object} options - pdf options (header, footer, etc.)
 * @returns {Promise<Buffer>}
 */
export const generatePDF = async (htmlContent, options = {}) => {
  // Services with ProtectHome cannot write Chrome's crash/config directories.
  // Give each render a private, writable home without weakening its sandbox.
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lawyer-pdf-'));
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      env: {
        ...process.env,
        ...(process.platform === 'linux' ? {
          HOME: runtimeDir,
          XDG_CONFIG_HOME: runtimeDir,
          XDG_CACHE_HOME: runtimeDir
        } : {})
      },
      args: [
        '--disable-dev-shm-usage',
        '--disable-crash-reporter'
      ]
    });

    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      let protocol;
      try {
        protocol = new URL(request.url()).protocol;
      } catch {
        protocol = '';
      }

      if (protocol === 'data:') {
        request.continue().catch(() => {});
      } else {
        request.abort('blockedbyclient').catch(() => {});
      }
    });

    // PDF output is self-contained: deny network and executable content so
    // record fields cannot make Chromium reach server-local destinations.
    const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline' data:; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'">`;
    const html = String(htmlContent ?? '');
    const secureHtml = /<head\b[^>]*>/i.test(html)
      ? html.replace(/<head\b([^>]*)>/i, `<head$1>${csp}`)
      : `<!doctype html><html><head>${csp}</head><body>${html}</body></html>`;
    await page.setContent(secureHtml, { waitUntil: 'networkidle0' });

    // Emulate screen for CSS media print
    await page.emulateMediaType('print');

    // Default header/footer for branding
    const officeName = options.officeName || 'منظومة مكتب المحاماة';
    
    const defaultHeaderTemplate = `
      <div style="width: 100%; font-size: 10px; padding: 10px 30px; display: flex; justify-content: space-between; font-family: sans-serif; direction: rtl; border-bottom: 1px solid #ddd;">
        <div style="font-weight: bold; color: #1e3a8a;">${officeName}</div>
        <div style="color: #6b7280;">تاريخ الطباعة: <span class="date"></span></div>
      </div>
    `;

    const defaultFooterTemplate = `
      <div style="width: 100%; font-size: 10px; padding: 10px 30px; text-align: center; font-family: sans-serif; direction: rtl; border-top: 1px solid #ddd; color: #6b7280;">
        الصفحة <span class="pageNumber"></span> من <span class="totalPages"></span>
      </div>
    `;

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: options.headerTemplate || defaultHeaderTemplate,
      footerTemplate: options.footerTemplate || defaultFooterTemplate,
      margin: {
        top: '80px',
        bottom: '60px',
        right: '40px',
        left: '40px'
      }
    });

    // Puppeteer returns Uint8Array; Express otherwise serializes it as JSON.
    return Buffer.from(pdfBuffer);
  } finally {
    try {
      await browser?.close();
    } finally {
      await fs.rm(runtimeDir, { recursive: true, force: true });
    }
  }
};
