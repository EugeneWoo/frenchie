'use strict';

const request = require('supertest');

// Set env vars before requiring the app
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
process.env.PORT = '0';
process.env.ELEVENLABS_API_KEY = 'test-key';

// Mock the stt service before requiring the app
jest.mock('../backend/services/stt');
const stt = require('../backend/services/stt');

const app = require('../backend/server');

describe('POST /api/transcribe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns HTTP 200 with { transcript: string } when a valid audio file is uploaded', async () => {
    stt.transcribe.mockResolvedValue('Bonjour, je mappelle Alice.');

    const res = await request(app)
      .post('/api/transcribe')
      .set('Origin', 'http://localhost:5173')
      .attach('audio', Buffer.from('fake-audio-data'), {
        filename: 'recording.webm',
        contentType: 'audio/webm',
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ transcript: 'Bonjour, je mappelle Alice.' });
    expect(stt.transcribe).toHaveBeenCalledTimes(1);
  });

  it('returns HTTP 400 when no audio file is attached', async () => {
    // Send a multipart form with a non-audio field — multer parses it fine
    // but req.file will be absent since no 'audio' field was attached
    const res = await request(app)
      .post('/api/transcribe')
      .set('Origin', 'http://localhost:5173')
      .field('other', 'value');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'audio file is required' });
    expect(stt.transcribe).not.toHaveBeenCalled();
  });

  it('returns HTTP 502 with structured error when the ElevenLabs STT service throws', async () => {
    const serviceError = new Error('ElevenLabs STT error');
    serviceError.detail = 'You have exceeded your API quota.';
    stt.transcribe.mockRejectedValue(serviceError);

    const res = await request(app)
      .post('/api/transcribe')
      .set('Origin', 'http://localhost:5173')
      .attach('audio', Buffer.from('fake-audio-data'), {
        filename: 'recording.webm',
        contentType: 'audio/webm',
      });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Transcription failed');
    expect(res.body.detail).toBe('You have exceeded your API quota.');
  });

  it('falls back to err.message for detail when err.detail is absent', async () => {
    const serviceError = new Error('Network failure');
    stt.transcribe.mockRejectedValue(serviceError);

    const res = await request(app)
      .post('/api/transcribe')
      .set('Origin', 'http://localhost:5173')
      .attach('audio', Buffer.from('fake-audio-data'), {
        filename: 'recording.webm',
        contentType: 'audio/webm',
      });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Transcription failed');
    expect(res.body.detail).toBe('Network failure');
  });
});
