'use strict';

const request = require('supertest');

process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
process.env.PORT = '0';

jest.mock('../backend/services/edge-tts');
const edgeTts = require('../backend/services/edge-tts');

const app = require('../backend/server');
const { PassThrough } = require('stream');

describe('POST /api/tts', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns HTTP 200 with Content-Type audio/mpeg for valid { text } body', async () => {
    const mockStream = new PassThrough();
    edgeTts.textToSpeech.mockResolvedValue(mockStream);
    setImmediate(() => mockStream.end());

    const res = await request(app)
      .post('/api/tts')
      .set('Origin', 'http://localhost:5173')
      .send({ text: 'Bonjour, comment vas-tu?' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/audio\/mpeg/);
    expect(edgeTts.textToSpeech).toHaveBeenCalledWith('Bonjour, comment vas-tu?');
  });

  it('returns HTTP 400 with { error: "text is required" } when text is missing', async () => {
    const res = await request(app)
      .post('/api/tts')
      .set('Origin', 'http://localhost:5173')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'text is required' });
    expect(edgeTts.textToSpeech).not.toHaveBeenCalled();
  });

  it('returns HTTP 400 with { error: "text is required" } when text is empty string', async () => {
    const res = await request(app)
      .post('/api/tts')
      .set('Origin', 'http://localhost:5173')
      .send({ text: '' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'text is required' });
    expect(edgeTts.textToSpeech).not.toHaveBeenCalled();
  });

  it('returns HTTP 502 with { error: "TTS failed" } when edge-tts throws', async () => {
    edgeTts.textToSpeech.mockRejectedValue(new Error('network timeout'));

    const res = await request(app)
      .post('/api/tts')
      .set('Origin', 'http://localhost:5173')
      .send({ text: 'Bonjour' });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('TTS failed');
    expect(res.body.detail).toBe('network timeout');
  });
});
