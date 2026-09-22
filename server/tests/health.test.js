import request from 'supertest';
import app from '../index.js';

describe('Health & Discovery routes', () => {
  test('GET /api/health returns status ok', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
  });

  test('GET /api/discovery returns discovery payload with signature and IPs', async () => {
    const response = await request(app).get('/api/discovery');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('signature', 'lawyer-office-server');
    expect(response.body).toHaveProperty('name', 'خادم منظومة مكتب المحاماة');
    expect(response.body).toHaveProperty('port');
    expect(response.body).toHaveProperty('ip');
    expect(response.body).toHaveProperty('url');
    expect(response.body).toHaveProperty('status', 'online');
  });
});

