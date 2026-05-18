'use strict';

const fetch = require('node-fetch');

/**
 * Stream TTS audio from ElevenLabs.
 * Returns the raw Response so the caller can pipe it.
 * Throws on non-2xx with a structured { status, message } error.
 */
async function textToSpeech(text) {
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    const err = new Error('ElevenLabs error');
    err.status = response.status;
    err.detail = detail;
    throw err;
  }

  return response;
}

module.exports = { textToSpeech };
