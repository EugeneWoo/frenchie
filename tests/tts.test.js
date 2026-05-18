'use strict';

const request = require('supertest');

// Set env vars before requiring the app
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
process.env.PORT = '0';

// Mock the elevenlabs service before requiring the app
jest.mock('../backend/services/elevenlabs');
const elevenlabs = require('../backend/services/elevenlabs');

const app = require('../backend/server');
const { PassThrough } = require('stream');

describe('POST /api/tts', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns HTTP 200 with Content-Type audio/mpeg for valid { text } body', async () => {
    // Create a mock response that is a readable stream with a body property
    const mockStream = new PassThrough();
    const mockResponse = {
      body: mockStream,
    };

    elevenlabs.textToSpeech.mockResolvedValue(mockResponse);

    // End the stream after a tick so supertest can finish reading
    setImmediate(() => mockStream.end());

    const res = await request(app)
      .post('/api/tts')
      .set('Origin', 'http://localhost:5173')
      .send({ text: 'Bonjour, comment vas-tu?' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/audio\/mpeg/);
    expect(elevenlabs.textToSpeech).toHaveBeenCalledWith('Bonjour, comment vas-tu?');
  });

  it('returns HTTP 400 with { error: "text is required" } when text is missing', async () => {
    const res = await request(app)
      .post('/api/tts')
      .set('Origin', 'http://localhost:5173')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'text is required' });
    expect(elevenlabs.textToSpeech).not.toHaveBeenCalled();
  });

  it('returns HTTP 400 with { error: "text is required" } when text is empty string', async () => {
    const res = await request(app)
      .post('/api/tts')
      .set('Origin', 'http://localhost:5173')
      .send({ text: '' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'text is required' });
    expect(elevenlabs.textToSpeech).not.toHaveBeenCalled();
  });

  it('returns HTTP 502 with { error: "TTS failed", detail: "..." } when ElevenLabs throws', async () => {
    const err = new Error('ElevenLabs API unreachable');
    err.detail = 'upstream connection refused';
    elevenlabs.textToSpeech.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/tts')
      .set('Origin', 'http://localhost:5173')
      .send({ text: 'Bonjour' });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('TTS failed');
    expect(res.body.detail).toBe('upstream connection refused');
  });

  it('uses err.message as detail when err.detail is absent', async () => {
    const err = new Error('network timeout');
    // no err.detail set
    elevenlabs.textToSpeech.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/tts')
      .set('Origin', 'http://localhost:5173')
      .send({ text: 'Bonjour' });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('TTS failed');
    expect(res.body.detail).toBe('network timeout');
  });
});
