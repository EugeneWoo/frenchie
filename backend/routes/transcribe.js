'use strict';

const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const stt = require('../services/stt');

// POST /api/transcribe
// Accepts multipart/form-data with field name 'audio'.
// Forwards audio buffer to ElevenLabs Scribe STT and returns { transcript }.
router.post('/', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'audio file is required' });
  }

  try {
    const transcript = await stt.transcribe(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );
    return res.status(200).json({ transcript });
  } catch (err) {
    console.error('[transcribe] ElevenLabs error:', err.status, err.detail || err.message);
    return res.status(502).json({
      error: 'Transcription failed',
      detail: err.detail || err.message,
    });
  }
});

module.exports = router;
