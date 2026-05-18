'use strict';

const fetch = require('node-fetch');
const FormData = require('form-data');

/**
 * Transcribe audio via ElevenLabs Scribe STT.
 * Same API key as TTS — no separate OpenAI key needed.
 * @param {Buffer} audioBuffer
 * @param {string} mimeType  e.g. 'audio/webm', 'audio/mp4'
 * @param {string} filename  e.g. 'audio.webm'
 * @returns {Promise<string>} transcript text
 */
async function transcribe(audioBuffer, mimeType, filename = 'audio.webm') {
  const form = new FormData();
  form.append('file', audioBuffer, { filename, contentType: mimeType });
  form.append('model_id', 'scribe_v2');
  form.append('language_code', 'fr');

  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    const err = new Error('ElevenLabs STT error');
    err.status = response.status;
    err.detail = detail;
    throw err;
  }

  const data = await response.json();
  return data.text;
}

module.exports = { transcribe };
