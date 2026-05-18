/**
 * gaps.test.js — D3: Gap Analysis Tests (Node environment)
 *
 * Contains tests that run in the Node environment:
 *   - CORS with no Origin header
 *   - priorAttempts cap at server route level
 *
 * Tests requiring jsdom (DOM access) are in gaps-jsdom.test.js.
 */

'use strict';

// ---------------------------------------------------------------------------
// Gap 1: CORS — request with no Origin header is allowed (same-origin curl)
// ---------------------------------------------------------------------------
describe('CORS — no Origin header (same-origin request)', () => {
  beforeAll(() => {
    process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
    process.env.PORT = '0';
  });

  it('returns HTTP 200 for GET /api/health when no Origin header is sent', async () => {
    jest.resetModules();
    const request = require('supertest');
    const app = require('../backend/server');

    // No .set('Origin', ...) — mimics a same-origin browser request or curl without Origin
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

// ---------------------------------------------------------------------------
// Gap 2: priorAttempts cap at route level — 3 most recent of 5 forwarded to Claude
// ---------------------------------------------------------------------------
describe('POST /api/evaluate — priorAttempts: only last 3 forwarded to Claude', () => {
  beforeAll(() => {
    process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
    process.env.PORT = '0';
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('sends only the 3 most recent attempts to Claude when 5 are provided in request body', async () => {
    jest.resetModules();
    jest.mock('../backend/services/claude', () => ({ evaluateResponse: jest.fn() }));

    const request = require('supertest');
    const claudeService = require('../backend/services/claude');
    const app = require('../backend/server');

    const VALID_RESULT = {
      overallScore: 7, communicationScore: 4, rangeAccuracyScore: 7,
      rawResponse: 'R', correctedAnswer: 'C', modelAnswer: null, comments: 'Good.',
    };
    claudeService.evaluateResponse.mockResolvedValue(VALID_RESULT);

    const fiveAttempts = [
      { response: 'a1', overallScore: 1, comments: 'c1' },
      { response: 'a2', overallScore: 2, comments: 'c2' },
      { response: 'a3', overallScore: 3, comments: 'c3' },
      { response: 'a4', overallScore: 4, comments: 'c4' },
      { response: 'a5', overallScore: 5, comments: 'c5' },
    ];

    const res = await request(app)
      .post('/api/evaluate')
      .set('Origin', 'http://localhost:5173')
      .send({
        question: 'Où habites-tu?',
        studentResponse: 'Je vis à Londres.',
        priorAttempts: fiveAttempts,
      });

    expect(res.status).toBe(200);

    const callArgs = claudeService.evaluateResponse.mock.calls[0][0];
    expect(callArgs.priorAttempts).toHaveLength(3);
    // Route takes last 3: a3, a4, a5
    expect(callArgs.priorAttempts[0].response).toBe('a3');
    expect(callArgs.priorAttempts[1].response).toBe('a4');
    expect(callArgs.priorAttempts[2].response).toBe('a5');
  });
});
