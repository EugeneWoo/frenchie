'use strict';

const fetch = require('node-fetch');
const FormData = require('form-data');

/**
 * Transcribe audio via Groq Whisper (whisper-large-v3-turbo).
 * @param {Buffer} audioBuffer
 * @param {string} mimeType  e.g. 'audio/webm', 'audio/mp4'
 * @param {string} filename  e.g. 'audio.webm'
 * @returns {Promise<string>} transcript text
 */
async function transcribe(audioBuffer, mimeType, filename = 'audio.webm') {
  const form = new FormData();
  form.append('file', audioBuffer, { filename, contentType: mimeType });
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'fr');
  form.append('response_format', 'json');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    const err = new Error('Groq STT error');
    err.status = response.status;
    err.detail = detail;
    throw err;
  }

  const data = await response.json();
  return data.text;
}

module.exports = { transcribe };
