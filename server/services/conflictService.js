import db from '../database/db.js';
import { decryptText, hashSearchTerm } from './encryptionService.js';

/**
 * فحص تعارض المصالح الشامل:
 * 1. فحص اسم ورقم العميل مقابل العملاء الحاليين
 * 2. فحص اسم ورقم العميل مقابل الخصوم في القضايا السابقة
 * 3. فحص اسم ورقم الخصم مقابل عملاء المكتب الحاليين والسابقين (تعارض صريح)
 * 4. فحص تشابه عناوين القضايا
 */
export function checkConflict({
  clientName,
  nationalId,
  title,
  opponentName,
  opponentId,
  excludeClientId = null,
  excludeCaseId = null
}) {
  const conflicts = [];

  // 1. فحص الخصم مقابل عملاء المكتب الحاليين (التعارض القانوني الأهم!)
  if (opponentName && opponentName.trim()) {
    const oppClean = opponentName.trim();
    const matchingClient = db.prepare(`
      SELECT id, name, phone, email FROM clients
      WHERE name LIKE ? OR name LIKE ?
    `).all(`%${oppClean}%`, oppClean);

    if (matchingClient.length > 0) {
      conflicts.push({
        type: 'opponent_is_client',
        severity: 'critical',
        title: '⚠️ تعارض مصالح حرج: الخصم عميل سابق أو حالي للمكتب!',
        message: `الخصم المحدد (${oppClean}) يتطابق اسمه مع عميل مسجل بالمكتب: ${matchingClient.map(c => c.name).join('، ')}`,
        items: matchingClient
      });
    }

    // فحص هل الخصم خصم في قضايا أخرى مما قد يشكل تضارباً
    let casesQuery = `
      SELECT c.id, c.case_number, c.title, c.opponent_name, cl.name as client_name
      FROM cases c
      JOIN clients cl ON c.client_id = cl.id
      WHERE c.opponent_name LIKE ?
    `;
    const casesParams = [`%${oppClean}%`];
    if (excludeCaseId) {
      casesQuery += ` AND c.id != ?`;
      casesParams.push(excludeCaseId);
    }
    const otherOpponentCases = db.prepare(casesQuery).all(...casesParams);
    if (otherOpponentCases.length > 0) {
      conflicts.push({
        type: 'opponent_in_other_cases',
        severity: 'warning',
        title: 'خصم متكرر في قضايا أخرى',
        message: `الخصم (${oppClean}) مسجل كخصم في ${otherOpponentCases.length} قضية أخرى بالمكتب`,
        items: otherOpponentCases
      });
    }
  }

  // 2. فحص الرقم الوطني للخصم مقابل عملاء المكتب
  if (opponentId && opponentId.trim()) {
    const oppHash = hashSearchTerm(opponentId);
    let matchedClient = null;

    if (oppHash) {
      matchedClient = db.prepare('SELECT id, name, phone FROM clients WHERE national_id_hash = ?').get(oppHash);
    }

    // Fallback if hash was not populated
    if (!matchedClient) {
      const allClients = db.prepare('SELECT id, name, national_id_encrypted FROM clients WHERE national_id_encrypted IS NOT NULL').all();
      matchedClient = allClients.find(c => decryptText(c.national_id_encrypted) === opponentId.trim());
    }

    if (matchedClient) {
      conflicts.push({
        type: 'opponent_id_matches_client',
        severity: 'critical',
        title: '⚠️ تعارض مصالح حرج: الرقم الوطني للخصم ينتمي لعميل بالمكتب!',
        message: `الرقم الوطني للخصم مسجل بالكامل للعميل: ${matchedClient.name}`,
        items: [matchedClient]
      });
    }
  }

  // 3. فحص العميل الجديد: هل كان خصماً في قضية سابقة ضد أحد موكلينا؟
  if (clientName && clientName.trim()) {
    const cleanClient = clientName.trim();

    // فحص تشابه الأسماء مع العملاء الآخرين
    let nameQuery = `SELECT id, name, phone, email FROM clients WHERE (name LIKE ? OR name LIKE ?)`;
    const nameParams = [`%${cleanClient}%`, cleanClient];
    if (excludeClientId) {
      nameQuery += ` AND id != ?`;
      nameParams.push(excludeClientId);
    }
    const existingClients = db.prepare(nameQuery).all(...nameParams);

    if (existingClients.length > 0) {
      conflicts.push({
        type: 'client_name',
        severity: 'warning',
        title: 'تشابه مع عميل موجود',
        message: `تم العثور على عملاء مشابهين بالاسم: ${existingClients.map(c => c.name).join('، ')}`,
        items: existingClients
      });
    }

    // فحص هل هذا العميل كان خصماً في قضايا المكتب السابقة
    const pastOpponentCase = db.prepare(`
      SELECT c.id, c.case_number, c.title, c.opponent_name, cl.name as our_client_name
      FROM cases c
      JOIN clients cl ON c.client_id = cl.id
      WHERE c.opponent_name LIKE ?
    `).all(`%${cleanClient}%`);

    if (pastOpponentCase.length > 0) {
      conflicts.push({
        type: 'client_was_opponent',
        severity: 'warning',
        title: '⚠️ تنبيه: هذا الشخص كان خصماً سابقاً لموكلي المكتب!',
        message: `تم تسجيل (${cleanClient}) كخصم سابق في القضية (${pastOpponentCase.map(c => `${c.case_number}: ${c.title}`).join('، ')}) ضد موكلنا (${pastOpponentCase.map(c => c.our_client_name).join('، ')})`,
        items: pastOpponentCase
      });
    }
  }

  // 4. فحص الرقم الوطني للعميل عبر الهاش السريع O(1)
  if (nationalId && nationalId.trim()) {
    const idHash = hashSearchTerm(nationalId);
    let matchedClient = null;

    if (idHash) {
      let hashQuery = 'SELECT id, name, phone FROM clients WHERE national_id_hash = ?';
      const hashParams = [idHash];
      if (excludeClientId) {
        hashQuery += ' AND id != ?';
        hashParams.push(excludeClientId);
      }
      matchedClient = db.prepare(hashQuery).get(...hashParams);
    }

    if (!matchedClient) {
      const allClients = db.prepare('SELECT id, name, national_id_encrypted FROM clients WHERE national_id_encrypted IS NOT NULL').all();
      matchedClient = allClients.find(c => {
        if (excludeClientId && c.id === Number(excludeClientId)) return false;
        return decryptText(c.national_id_encrypted) === nationalId.trim();
      });
    }

    if (matchedClient) {
      conflicts.push({
        type: 'national_id',
        severity: 'warning',
        title: 'تكرار الرقم الوطني / السجل التجاري',
        message: `الرقم الوطني / السجل ينتمي بالفعل للعميل: ${matchedClient.name}`,
        items: [matchedClient]
      });
    }

    // فحص هل الرقم الوطني للعميل كان رقم خصم في قضية سابقة
    const pastOpponentIdCase = db.prepare(`
      SELECT c.id, c.case_number, c.title, c.opponent_name, cl.name as our_client_name
      FROM cases c
      JOIN clients cl ON c.client_id = cl.id
      WHERE c.opponent_id_number = ?
    `).all(nationalId.trim());

    if (pastOpponentIdCase.length > 0) {
      conflicts.push({
        type: 'client_id_was_opponent_id',
        severity: 'critical',
        title: '⚠️ الرقم الوطني مسجل كخصم سابق في قضية ضد موكل!',
        message: `تم العثور على نفس الرقم كخصم في القضية: ${pastOpponentIdCase.map(c => `${c.case_number} (${c.title})`).join('، ')}`,
        items: pastOpponentIdCase
      });
    }
  }

  // 5. فحص تشابه عنوان القضية
  if (title && title.trim()) {
    let titleQuery = `
      SELECT cases.id, cases.case_number, cases.title, clients.name as client_name
      FROM cases
      JOIN clients ON cases.client_id = clients.id
      WHERE cases.title LIKE ?
    `;
    const titleParams = [`%${title.trim()}%`];
    if (excludeCaseId) {
      titleQuery += ` AND cases.id != ?`;
      titleParams.push(excludeCaseId);
    }
    const matchingCases = db.prepare(titleQuery).all(...titleParams);

    if (matchingCases.length > 0) {
      conflicts.push({
        type: 'case_title',
        severity: 'info',
        title: 'تشابه في عناوين القضايا',
        message: `توجد قضايا مشابهة بالعنوان: ${matchingCases.map(c => `${c.case_number} (${c.title})`).join('، ')}`,
        items: matchingCases
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    hasCriticalConflict: conflicts.some(c => c.severity === 'critical'),
    conflicts
  };
}
