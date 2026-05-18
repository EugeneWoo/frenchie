'use strict';

const express = require('express');
const router = express.Router();
const edgeTts = require('../services/edge-tts');

// POST /api/tts
router.post('/', async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: 'text is required' });
  }

  try {
    const audioStream = await edgeTts.textToSpeech(text);
    res.setHeader('Content-Type', 'audio/mpeg');
    audioStream.pipe(res);
  } catch (err) {
    return res.status(502).json({
      error: 'TTS failed',
      detail: err.message,
    });
  }
});

module.exports = router;
