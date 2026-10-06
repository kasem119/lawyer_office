import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { checkConflict } from '../services/conflictService.js';

const router = express.Router();
router.use(authenticateToken);

function getTenantId(req) {
  return req.user.tenant_id || 1;
}

// POST /api/conflict/check
router.post('/check', (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { clientName, nationalId, title, opponentName, opponentId, excludeClientId, excludeCaseId } = req.body;
    const result = checkConflict({
      clientName,
      nationalId,
      title,
      opponentName,
      opponentId,
      excludeClientId,
      excludeCaseId,
      tenantId
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
