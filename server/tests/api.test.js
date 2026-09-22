import request from 'supertest';
import app from '../index.js';

describe('Server APIs Integration Tests', () => {
  test('GET /api/health returns status ok', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
  });

  test('POST /api/auth/login requires valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'invalid@test.com', password: 'wrong' });
    expect(response.status).toBe(401);
  });

  test('POST /api/auth/login logs in admin successfully', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@lawyer.com', password: 'admin123' });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('user');
  });

  test('POST /api/auth/register is closed after initial setup', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Unauthorized Admin', email: 'unauthorized@example.com', password: 'a-secure-password' });
    expect(response.status).toBe(403);
  });

  test('POST /api/documents/upload rejects a lawyer without case access', async () => {
    const lawyerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'lawyer@lawyer.com', password: 'lawyer123' });

    const response = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${lawyerLogin.body.accessToken}`)
      .field('case_id', '999999')
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'test.pdf', contentType: 'application/pdf' });
    expect(response.status).toBe(403);
  });

  test('DELETE /api/users/:id deletes an unused lawyer account', async () => {
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@lawyer.com', password: 'admin123' });
    const adminToken = adminLogin.body.accessToken;
    const createResponse = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'حساب اختبار للحذف', email: 'delete-test@example.com', password: 'a-secure-password', role: 'lawyer' });
    expect(createResponse.status).toBe(201);

    const deleteResponse = await request(app)
      .delete(`/api/users/${createResponse.body.userId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteResponse.status).toBe(200);
  });

  test('GET /api/activities requires authentication (401)', async () => {
    const response = await request(app).get('/api/activities');
    expect(response.status).toBe(401);
  });

  test('GET /api/activities rejects lawyer access (403)', async () => {
    const lawyerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'lawyer@lawyer.com', password: 'lawyer123' });
    const lawyerToken = lawyerLogin.body.accessToken;

    const response = await request(app)
      .get('/api/activities')
      .set('Authorization', `Bearer ${lawyerToken}`);
    expect(response.status).toBe(403);
  });

  test('GET /api/activities allows admin access and returns paginated data (200)', async () => {
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@lawyer.com', password: 'admin123' });
    const adminToken = adminLogin.body.accessToken;

    const response = await request(app)
      .get('/api/activities?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.activities)).toBe(true);
    expect(response.body).toHaveProperty('pagination');
    expect(response.body.pagination).toHaveProperty('page', 1);
    expect(response.body.pagination).toHaveProperty('limit', 10);
    expect(response.body.pagination).toHaveProperty('total');
  });

  test('GET /api/activities/stats returns activity metrics (200)', async () => {
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@lawyer.com', password: 'admin123' });
    const adminToken = adminLogin.body.accessToken;

    const response = await request(app)
      .get('/api/activities/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.stats).toHaveProperty('total');
    expect(response.body.stats).toHaveProperty('today');
    expect(response.body.stats).toHaveProperty('thisWeek');
    expect(response.body.stats).toHaveProperty('thisMonth');
    expect(Array.isArray(response.body.stats.byEntityType)).toBe(true);
    expect(Array.isArray(response.body.stats.topUsers)).toBe(true);
  });

  test('authorization: exports require login and cases export uses valid columns', async () => {
    const unauth = await request(app).get('/api/exports/cases?format=excel');
    expect(unauth.status).toBe(401);

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@lawyer.com', password: 'admin123' });
    const adminToken = adminLogin.body.accessToken;

    const exportRes = await request(app)
      .get('/api/exports/cases?format=excel')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['content-type']).toMatch(/spreadsheetml|octet-stream|excel/i);
  });

  test('authorization: outsider lawyer cannot access another case, client, invoice, or task', async () => {
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@lawyer.com', password: 'admin123' });
    const adminToken = adminLogin.body.accessToken;
    const adminId = adminLogin.body.user.id;

    const clientRes = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'عميل محمي للاختبار',
        email: 'protected-client@example.com',
        phone: '0910000001',
        national_id: '119911122233',
        force: true
      });
    expect(clientRes.status).toBe(201);
    const clientId = clientRes.body.clientId;

    const caseRes = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        case_number: `CASE-AUTH-${Date.now()}`,
        title: 'قضية محمية للاختبار',
        client_id: clientId,
        case_type: 'civil',
        lead_lawyer_id: adminId,
        force: true
      });
    expect(caseRes.status).toBe(201);
    const caseId = caseRes.body.caseId;

    const invoiceRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        case_id: caseId,
        client_id: clientId,
        due_date: '2026-12-31',
        items: [{ description: 'أتعاب', quantity: 1, unit_price: 100 }]
      });
    expect(invoiceRes.status).toBe(200);
    const invoiceId = invoiceRes.body.data.id;

    const invoiceLookup = await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const invoiceNumber = invoiceLookup.body.data.invoice_number;

    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'مهمة محمية للاختبار',
        assigned_to: adminId,
        priority: 'medium',
        case_id: caseId
      });
    expect(taskRes.status).toBe(201);
    const taskId = taskRes.body.taskId;

    const outsiderEmail = `outsider-${Date.now()}@example.com`;
    const createUser = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'محامي خارج القضية', email: outsiderEmail, password: 'a-secure-password', role: 'lawyer' });
    expect(createUser.status).toBe(201);

    const outsiderLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: outsiderEmail, password: 'a-secure-password' });
    const outsiderToken = outsiderLogin.body.accessToken;

    const statusRes = await request(app)
      .patch(`/api/cases/${caseId}/status`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ status: 'closed' });
    expect(statusRes.status).toBe(403);

    const clientDetails = await request(app)
      .get(`/api/clients/${clientId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(clientDetails.status).toBe(403);

    const invoiceById = await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(invoiceById.status).toBe(403);

    const invoiceByNumber = await request(app)
      .get(`/api/invoices/${invoiceNumber}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(invoiceByNumber.status).toBe(403);

    const taskStatus = await request(app)
      .put(`/api/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ status: 'done' });
    expect(taskStatus.status).toBe(403);
  });
});
