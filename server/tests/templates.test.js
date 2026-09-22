import request from 'supertest';
import app from '../index.js';

describe('Document Templates API Integration Tests', () => {
  let adminToken = '';
  let createdTemplateId = null;

  beforeAll(async () => {
    // Log in admin to get access token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@lawyer.com', password: 'admin123' });
    adminToken = res.body.accessToken;
  });

  test('GET /api/templates requires authentication', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(401);
  });

  test('GET /api/templates returns list of templates for authenticated user', async () => {
    const res = await request(app)
      .get('/api/templates')
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.templates)).toBe(true);
    expect(res.body.templates.length).toBeGreaterThan(0);
  });

  test('POST /api/templates creates a new template', async () => {
    const newTemplate = {
      name: 'قالب اختبار آلي',
      category: 'contract',
      content_html: '<h2>عقد تجريبي للعميل {{client_name}}</h2><p>رقم القضية: {{case_number}}</p>',
      placeholders_json: JSON.stringify(['client_name', 'case_number'])
    };

    const res = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newTemplate);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.template).toBeDefined();
    expect(res.body.template.name).toBe(newTemplate.name);
    expect(res.body.template.placeholders).toEqual(['client_name', 'case_number']);

    createdTemplateId = res.body.template.id;
  });

  test('GET /api/templates/:id returns single template details', async () => {
    const res = await request(app)
      .get(`/api/templates/${createdTemplateId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.template.id).toBe(createdTemplateId);
  });

  test('PUT /api/templates/:id updates an existing template', async () => {
    const res = await request(app)
      .put(`/api/templates/${createdTemplateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'قالب اختبار معدل',
        content_html: '<h2>عقد تجريبي معدل للعميل {{client_name}}</h2><p>التاريخ: {{date}}</p>'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.template.name).toBe('قالب اختبار معدل');
  });

  test('POST /api/templates/:id/generate fills placeholders in template', async () => {
    const res = await request(app)
      .post(`/api/templates/${createdTemplateId}/generate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        values: {
          client_name: 'محمد عبدالله',
          date: '2026-09-02'
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.generated_html).toContain('محمد عبدالله');
    expect(res.body.generated_html).toContain('2026-09-02');
  });

  test('DELETE /api/templates/:id removes the template', async () => {
    const res = await request(app)
      .delete(`/api/templates/${createdTemplateId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const checkRes = await request(app)
      .get(`/api/templates/${createdTemplateId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(checkRes.status).toBe(404);
  });
});
