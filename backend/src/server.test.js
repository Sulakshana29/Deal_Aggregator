const request = require('supertest');
const app = require('./server');
const escapeRegex = require('./utils/escapeRegex');

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

  it('GET /ready should return 503 when MongoDB is not connected', async () => {
    const res = await request(app).get('/ready');
    expect(res.statusCode).toBe(503);
    expect(res.body).toHaveProperty('db', false);
  });
});

describe('Security hardening', () => {
  it('does not expose write endpoints', async () => {
    const post = await request(app).post('/deals').send({ brand: 'x' });
    const del = await request(app).delete('/deals/123');
    expect(post.statusCode).toBe(404);
    expect(del.statusCode).toBe(404);
  });

  it('does not leak the X-Powered-By header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers).not.toHaveProperty('x-powered-by');
    expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
  });

  it('rejects overly long search queries', async () => {
    const res = await request(app).get(`/deals?search=${'a'.repeat(101)}`);
    expect(res.statusCode).toBe(400);
  });
});

describe('escapeRegex', () => {
  it('escapes all regex metacharacters', () => {
    expect(escapeRegex('(a+)+$')).toBe('\\(a\\+\\)\\+\\$');
    expect(escapeRegex('a.b*c?')).toBe('a\\.b\\*c\\?');
  });

  it('produces a regex that matches the input literally', () => {
    const input = '[HNB] 20% (off)';
    expect(new RegExp(`^${escapeRegex(input)}$`).test(input)).toBe(true);
  });
});
