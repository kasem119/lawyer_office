import express from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { authenticateToken } from '../middleware/auth.js';
import { canAccessCase, requireOfficeAccount } from '../middleware/permissions.js';
import db from '../database/db.js';
import { generateLegalAssist } from '../services/llmService.js';
import { getMustasharStatus, getLaws, getLawPdf } from '../services/mustasharService.js';

const router = express.Router();
router.use(authenticateToken, requireOfficeAccount);

const requests = new Map();
let activeRequests = 0;
function requestBudget(req, res, next) {
  const now = Date.now();
  // Purge expired entries, so user IDs cannot cause unbounded growth.
  for (const [key, value] of requests) if (value.expires <= now) requests.delete(key);
  const key = `${req.user.tenant_id}:${req.user.id}`;
  const entry = requests.get(key) || { count: 0, expires: now + 60000 };
  if (entry.count >= 10 || activeRequests >= 4) {
    res.set('Retry-After', String(entry.count >= 10 ? Math.max(1, Math.ceil((entry.expires - now) / 1000)) : 5));
    return res.status(429).json({ success: false, message: 'بلغت حد طلبات المساعد أو الخدمة مشغولة. حاول بعد قليل.' });
  }
  entry.count++; requests.set(key, entry); activeRequests++;
  let released = false;
  const release = () => { if (!released) { released = true; activeRequests--; } };
  res.once('finish', release); res.once('close', release);
  next();
}

router.get('/status', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: await getMustasharStatus() });
});

router.get('/laws', async (req, res, next) => {
  try { res.json({ success: true, data: await getLaws() }); } catch (error) { next(error); }
});

router.get('/laws/:id/pdf', async (req, res, next) => {
  const controller = new AbortController();
  res.once('close', () => controller.abort());
  try {
    const upstream = await getLawPdf(req.params.id, controller.signal);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="law-${req.params.id}.pdf"`,
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
    await pipeline(Readable.fromWeb(upstream.body), res, { signal: controller.signal });
  } catch (error) {
    if (!res.headersSent && !controller.signal.aborted) next(error);
    else res.destroy();
  }
});

// POST /api/ai/assist
router.post('/assist', requestBudget, async (req, res, next) => {
  const controller = new AbortController();
  res.once('close', () => { if (!res.writableEnded) controller.abort(); });
  try {
    const { prompt, mode = 'legal_advice', case_id = null } = req.body;

    if (!['legal_advice', 'draft_clause', 'summarize_case'].includes(mode)
        || (prompt !== undefined && (typeof prompt !== 'string' || prompt.length > 16000))) {
      return res.status(400).json({ success: false, message: 'نوع الطلب أو نص الاستفسار غير صالح' });
    }
    if (mode === 'summarize_case' && !case_id) {
      return res.status(400).json({ success: false, message: 'يرجى تحديد القضية المراد تلخيصها' });
    }

    if (!prompt?.trim() && mode !== 'summarize_case') {
      return res.status(400).json({ success: false, message: 'يرجى كتابة نص الاستفسار أو الطلب' });
    }

    let caseData = null;
    if (case_id) {
      const tenantId = req.user.tenant_id || 1;
      const normalizedCaseId = typeof case_id === 'number'
        ? case_id
        : typeof case_id === 'string' && /^[1-9]\d*$/.test(case_id)
          ? Number(case_id)
          : NaN;
      if (!Number.isSafeInteger(normalizedCaseId) || normalizedCaseId <= 0) {
        return res.status(400).json({ success: false, message: 'معرّف القضية غير صالح' });
      }

      caseData = db.prepare(`
        SELECT c.*, cl.name as client_name 
        FROM cases c
        LEFT JOIN clients cl ON c.client_id = cl.id
        WHERE c.id = ? AND c.tenant_id = ?
      `).get(normalizedCaseId, tenantId);

      if (!caseData || !canAccessCase(req.user, normalizedCaseId)) {
        return res.status(404).json({ success: false, message: 'القضية غير موجودة' });
      }
    }

    const result = await generateLegalAssist(mode, prompt, caseData, { signal: controller.signal });

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
