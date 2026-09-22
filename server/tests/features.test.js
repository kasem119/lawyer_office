import request from 'supertest';
import app from '../index.js';

describe('Audit Enhancements & Features Integration Tests', () => {
  let adminToken = '';
  let lawyerToken = '';

  beforeAll(async () => {
    // Admin login
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@lawyer.com', password: 'admin123' });
    adminToken = adminRes.body.accessToken;

    // Lawyer login
    const lawyerRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'lawyer@lawyer.com', password: 'lawyer123' });
    lawyerToken = lawyerRes.body.accessToken;
  });

  test('GET /api/documents returns paginated documents list', async () => {
    const res = await request(app)
      .get('/api/documents?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.documents)).toBe(true);
    expect(res.body).toHaveProperty('pagination');
  });

  test('POST /api/conflict/check checks opponent names and client records', async () => {
    const res = await request(app)
      .post('/api/conflict/check')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'سالم' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('hasConflict');
    expect(Array.isArray(res.body.conflicts)).toBe(true);
  });

  test('GET /api/reports/financial-summary is accessible to lawyers with net profit', async () => {
    const res = await request(app)
      .get('/api/reports/financial-summary')
      .set('Authorization', `Bearer ${lawyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('total_paid');
    expect(res.body.data).toHaveProperty('net_profit');
  });

  test('POST /api/ai/assist generates legal clauses and advice', async () => {
    const res = await request(app)
      .post('/api/ai/assist')
      .set('Authorization', `Bearer ${lawyerToken}`)
      .send({
        mode: 'draft_clause',
        prompt: 'صياغة شرط التحكيم وفض المنازعات'
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('title');
    expect(res.body.data.content).toContain('التحكيم');
  });

  test('POST /api/portal/login validates client phone or national ID', async () => {
    const res = await request(app)
      .post('/api/portal/login')
      .send({ identifier: 'nonexistent_phone_123' });
    expect(res.status).toBe(404);
  });
});
