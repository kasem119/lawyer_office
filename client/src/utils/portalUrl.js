export function getPortalUrl(serverUrl, publicUrl = '') {
  const url = new URL(publicUrl || serverUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('يرجى إعداد عنوان ويب صالح لبوابة الموكل');
  }
  if (['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(url.hostname)) {
    throw new Error('يرجى إعداد عنوان خادم يمكن للموكل الوصول إليه قبل مشاركة البوابة');
  }
  url.pathname = url.pathname.replace(/\/api\/?$/, '').replace(/\/+$/, '') || '/';
  url.search = '';
  url.hash = 'portal';
  return url.toString();
}
