'use strict';

const request = require('supertest');

// Set env vars before requiring the app
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
process.env.PORT = '0';
process.env.ANTHROPIC_API_KEY = 'test-key';

// Mock the claude service before requiring the app
jest.mock('../backend/services/claude', () => ({
  evaluateResponse: jest.fn(),
}));

const claudeService = require('../backend/services/claude');
const app = require('../backend/server');

const VALID_EVAL_RESULT = {
  overallScore: 7,
  communicationScore: 4,
  rangeAccuracyScore: 7,
  rawResponse: 'Je vais à Paris avec ma famille.',
  correctedAnswer: 'Je vais à Paris avec ma famille chaque été.',
  modelAnswer: null,
  comments: 'Good use of verb aller. Try to add more detail.',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/evaluate', () => {
  it('returns HTTP 200 with all 7 required fields when question and studentResponse are provided', async () => {
    claudeService.evaluateResponse.mockResolvedValue(VALID_EVAL_RESULT);

    const res = await request(app)
      .post('/api/evaluate')
      .set('Origin', 'http://localhost:5173')
      .send({
        question: 'Où vas-tu en vacances?',
        studentResponse: 'Je vais à Paris avec ma famille.',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('overallScore');
    expect(res.body).toHaveProperty('communicationScore');
    expect(res.body).toHaveProperty('rangeAccuracyScore');
    expect(res.body).toHaveProperty('rawResponse');
    expect(res.body).toHaveProperty('correctedAnswer');
    expect(res.body).toHaveProperty('modelAnswer');
    expect(res.body).toHaveProperty('comments');
  });

  it('returns progressComparison field when priorAttempts are provided', async () => {
    const resultWithProgress = {
      ...VALID_EVAL_RESULT,
      progressComparison: 'Better than last time — you used more vocabulary.',
    };
    claudeService.evaluateResponse.mockResolvedValue(resultWithProgress);

    const res = await request(app)
      .post('/api/evaluate')
      .set('Origin', 'http://localhost:5173')
      .send({
        question: 'Où vas-tu en vacances?',
        studentResponse: 'Je vais à Paris avec ma famille.',
        priorAttempts: [
          { response: 'Je vais à Paris.', overallScore: 5, comments: 'Short answer.' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('progressComparison');
    expect(res.body.progressComparison).toBe('Better than last time — you used more vocabulary.');
  });

  it('returns HTTP 400 when question is missing', async () => {
    const res = await request(app)
      .post('/api/evaluate')
      .set('Origin', 'http://localhost:5173')
      .send({ studentResponse: 'Je vais à Paris.' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns HTTP 400 when studentResponse is missing', async () => {
    const res = await request(app)
      .post('/api/evaluate')
      .set('Origin', 'http://localhost:5173')
      .send({ question: 'Où vas-tu en vacances?' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns HTTP 502 with structured error when Claude service throws', async () => {
    claudeService.evaluateResponse.mockRejectedValue(
      new Error('Unexpected token < in JSON at position 0')
    );

    const res = await request(app)
      .post('/api/evaluate')
      .set('Origin', 'http://localhost:5173')
      .send({
        question: 'Où vas-tu en vacances?',
        studentResponse: 'Je vais à Paris.',
      });

    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error', 'Evaluation failed');
    expect(res.body).toHaveProperty('detail');
    expect(res.body.detail).toBe('Unexpected token < in JSON at position 0');
  });

  it('returns modelAnswer as null when modelAnswer is not supplied in request', async () => {
    claudeService.evaluateResponse.mockResolvedValue(VALID_EVAL_RESULT);

    const res = await request(app)
      .post('/api/evaluate')
      .set('Origin', 'http://localhost:5173')
      .send({
        question: 'Où vas-tu en vacances?',
        studentResponse: 'Je vais à Paris.',
      });

    expect(res.status).toBe(200);
    expect(res.body.modelAnswer).toBeNull();
  });

  it('passes priorAttempts capped to last 3 when more than 3 are provided', async () => {
    claudeService.evaluateResponse.mockResolvedValue(VALID_EVAL_RESULT);

    const fiveAttempts = [
      { response: 'attempt 1', overallScore: 3, comments: 'c1' },
      { response: 'attempt 2', overallScore: 4, comments: 'c2' },
      { response: 'attempt 3', overallScore: 5, comments: 'c3' },
      { response: 'attempt 4', overallScore: 6, comments: 'c4' },
      { response: 'attempt 5', overallScore: 7, comments: 'c5' },
    ];

    const res = await request(app)
      .post('/api/evaluate')
      .set('Origin', 'http://localhost:5173')
      .send({
        question: 'Où vas-tu en vacances?',
        studentResponse: 'Je vais à Paris.',
        priorAttempts: fiveAttempts,
      });

    expect(res.status).toBe(200);
    // The service should have been called with only 3 most recent attempts
    const callArgs = claudeService.evaluateResponse.mock.calls[0][0];
    expect(callArgs.priorAttempts).toHaveLength(3);
    expect(callArgs.priorAttempts[0].response).toBe('attempt 3');
    expect(callArgs.priorAttempts[1].response).toBe('attempt 4');
    expect(callArgs.priorAttempts[2].response).toBe('attempt 5');
  });
});
