import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import db from '../database/db.js';
import { generateLegalAssist } from '../services/llmService.js';

const router = express.Router();
router.use(authenticateToken);

// POST /api/ai/assist
router.post('/assist', async (req, res, next) => {
  try {
    const { prompt, mode = 'legal_advice', case_id = null } = req.body;

    if (!prompt && mode !== 'summarize_case') {
      return res.status(400).json({ success: false, message: 'يرجى كتابة نص الاستفسار أو الطلب' });
    }

    let caseData = null;
    if (case_id) {
      caseData = db.prepare(`
        SELECT c.*, cl.name as client_name 
        FROM cases c
        LEFT JOIN clients cl ON c.client_id = cl.id
        WHERE c.id = ?
      `).get(case_id);
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
