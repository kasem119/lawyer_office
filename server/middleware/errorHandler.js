export function errorHandler(err, req, res, next) {
  console.error('[API Error]:', err);
  const applicationStatus = err.name === 'ApplicationError' ? ({ INVALID_INPUT: 400, FORBIDDEN: 403, NOT_FOUND: 404 })[err.code] : undefined;
  const status = err.name === 'MulterError' || err.message === 'نوع الملف غير مسموح به' ? 400 : (applicationStatus || err.status || 500);
  const message = status === 500 ? 'حدث خطأ غير متوقع في الخادم' : (err.message || 'الطلب غير صالح');
  res.status(status).json({ success: false, message });
}
