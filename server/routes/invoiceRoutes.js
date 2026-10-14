import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { invoices } from '../composition/invoices.js';

const router = express.Router();
router.use(authenticateToken);
const handle = action => (req, res, next) => Promise.resolve().then(() => action(req, res)).catch(next);

router.get('/', handle((req, res) => res.json({ success: true, data: invoices.list(req.user, req.query.case_id) })));
router.get('/:id', handle((req, res) => res.json({ success: true, data: invoices.get(req.user, req.params.id) })));
router.post('/', handle((req, res) => {
  const id = invoices.create(req.user, req.body);
  res.json({ success: true, message: 'تم إنشاء الفاتورة بنجاح', data: { id } });
}));
router.put('/:id/status', handle((req, res) => {
  invoices.setStatus(req.user, req.params.id, req.body.status);
  res.json({ success: true, message: 'تم تحديث حالة الفاتورة بنجاح' });
}));
router.put('/:id', handle((req, res) => {
  invoices.update(req.user, req.params.id, req.body);
  res.json({ success: true, message: 'تم تحديث بيانات الفاتورة بنجاح' });
}));
router.delete('/:id', handle((req, res) => {
  invoices.remove(req.user, req.params.id);
  res.json({ success: true, message: 'تم حذف الفاتورة بنجاح' });
}));
router.post('/:id/send-email', handle(async (req, res) => {
  const result = await invoices.send(req.user, req.params.id);
  res.json({ success: true, message: `تم إرسال الفاتورة بنجاح إلى ${result.recipient}`, data: result });
}));

export default router;
