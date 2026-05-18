'use strict';

const express = require('express');
const router = express.Router();
const { translateQuestion } = require('../services/claude');

// POST /api/translate
router.post('/', async (req, res) => {
  const { question } = req.body;
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'question is required' });
  }
  try {
    const translation = await translateQuestion(question.trim());
    return res.status(200).json({ translation });
  } catch (err) {
    return res.status(502).json({ error: 'Translation failed', detail: err.message });
  }
});

module.exports = router;
