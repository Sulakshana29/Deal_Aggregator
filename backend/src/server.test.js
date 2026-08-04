const request = require('supertest');
const app = require('./server');

describe('API Smoke Test', () => {
  it('GET /health should return 200 and status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /unknown-route should return 404', async () => {
    const res = await request(app).get('/unknown-route');
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('error', 'Route not found');
  });
});
