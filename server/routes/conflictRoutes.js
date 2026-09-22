import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { checkConflict } from '../services/conflictService.js';

const router = express.Router();
router.use(authenticateToken);

// POST /api/conflict/check
router.post('/check', (req, res, next) => {
  try {
    const { clientName, nationalId, title, opponentName, opponentId, excludeClientId, excludeCaseId } = req.body;
    const result = checkConflict({ clientName, nationalId, title, opponentName, opponentId, excludeClientId, excludeCaseId });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
