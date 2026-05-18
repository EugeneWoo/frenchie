'use strict';

const request = require('supertest');

// Set env vars before requiring the app
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
process.env.PORT = '0';
process.env.ANTHROPIC_API_KEY = 'test-key';

// Mock the claude service before requiring the app
jest.mock('../backend/services/claude');
const claude = require('../backend/services/claude');

const app = require('../backend/server');

describe('POST /api/generate-questions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns HTTP 200 with { questions: [...] } array of 5 strings for valid { theme, count } body', async () => {
    const mockQuestions = [
      'Où habites-tu?',
      'Décris ta maison.',
      'Quels sont les avantages de vivre à la campagne?',
      "As-tu déjà voyagé à l'étranger?",
      'Quel est ton endroit préféré en France?',
    ];
    claude.generateQuestions.mockResolvedValue(mockQuestions);

    const res = await request(app)
      .post('/api/generate-questions')
      .set('Origin', 'http://localhost:5173')
      .send({ theme: 'home-abroad', count: 5 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ questions: mockQuestions });
    expect(res.body.questions).toHaveLength(5);
    expect(claude.generateQuestions).toHaveBeenCalledWith('home-abroad', 5);
  });

  it('returns HTTP 400 when theme is missing', async () => {
    const res = await request(app)
      .post('/api/generate-questions')
      .set('Origin', 'http://localhost:5173')
      .send({ count: 5 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(claude.generateQuestions).not.toHaveBeenCalled();
  });

  it('returns HTTP 400 with { error: "Invalid theme", validThemes: [...] } for an invalid theme', async () => {
    const res = await request(app)
      .post('/api/generate-questions')
      .set('Origin', 'http://localhost:5173')
      .send({ theme: 'not-a-real-theme', count: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid theme');
    expect(Array.isArray(res.body.validThemes)).toBe(true);
    expect(res.body.validThemes).toContain('home-abroad');
    expect(res.body.validThemes).toContain('education-employment');
    expect(res.body.validThemes).toContain('personal-life');
    expect(res.body.validThemes).toContain('world-around-us');
    expect(res.body.validThemes).toContain('social-activities');
    expect(res.body.validThemes).toContain('fitness-health');
    expect(claude.generateQuestions).not.toHaveBeenCalled();
  });

  it('returns HTTP 502 with { error: "Generation failed", detail: "..." } when Claude throws', async () => {
    const err = new Error('Anthropic API unreachable');
    claude.generateQuestions.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/generate-questions')
      .set('Origin', 'http://localhost:5173')
      .send({ theme: 'home-abroad', count: 5 });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Generation failed');
    expect(res.body.detail).toBe('Anthropic API unreachable');
  });

  it('defaults count to 5 when not provided', async () => {
    claude.generateQuestions.mockResolvedValue(['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?']);

    const res = await request(app)
      .post('/api/generate-questions')
      .set('Origin', 'http://localhost:5173')
      .send({ theme: 'personal-life' });

    expect(res.status).toBe(200);
    expect(claude.generateQuestions).toHaveBeenCalledWith('personal-life', 5);
  });

  it('caps count at 10 when a value greater than 10 is provided', async () => {
    const mockQuestions = Array.from({ length: 10 }, (_, i) => `Question ${i + 1}?`);
    claude.generateQuestions.mockResolvedValue(mockQuestions);

    const res = await request(app)
      .post('/api/generate-questions')
      .set('Origin', 'http://localhost:5173')
      .send({ theme: 'social-activities', count: 50 });

    expect(res.status).toBe(200);
    expect(claude.generateQuestions).toHaveBeenCalledWith('social-activities', 10);
  });
});
