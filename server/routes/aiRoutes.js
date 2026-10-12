import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { canAccessCase } from '../middleware/permissions.js';
import db from '../database/db.js';
import { generateLegalAssist } from '../services/llmService.js';

const router = express.Router();
router.use(authenticateToken);

// POST /api/ai/assist
router.post('/assist', async (req, res, next) => {
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

    const result = await generateLegalAssist(mode, prompt, caseData);

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
