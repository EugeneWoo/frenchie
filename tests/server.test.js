'use strict';

const request = require('supertest');

// Set env vars before requiring the app
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
process.env.PORT = '0'; // use random port for tests

const app = require('../backend/server');

describe('GET /api/health', () => {
  it('returns { status: "ok" } with HTTP 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('CORS', () => {
  it('allows the configured FRONTEND_ORIGIN', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('rejects a non-allowlisted origin (no CORS header returned)', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://evil.example.com');
    // cors middleware should NOT echo back the disallowed origin
    expect(res.headers['access-control-allow-origin']).not.toBe('http://evil.example.com');
  });
});

describe('Static file serving', () => {
  it('GET / returns index.html with HTTP 200', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});

// All four route stubs (/api/tts, /api/transcribe, /api/evaluate, /api/generate-questions)
// have been implemented by their respective Phase B groups (B1–B4).
// Stub tests have been removed; each route has its own dedicated test file.
