import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';

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
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  try {
    const page = await browser.newPage();
    
    // Set content and wait for fonts/images to load
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

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

    return pdfBuffer;
  } finally {
    await browser.close();
  }
};
