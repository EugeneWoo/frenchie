'use strict';

const express = require('express');
const router = express.Router();
const elevenlabs = require('../services/elevenlabs');

// POST /api/tts
router.post('/', async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: 'text is required' });
  }

  try {
    const response = await elevenlabs.textToSpeech(text);
    res.setHeader('Content-Type', 'audio/mpeg');
    response.body.pipe(res);
  } catch (err) {
    return res.status(502).json({
      error: 'TTS failed',
      detail: err.detail || err.message,
    });
  }
});

module.exports = router;
