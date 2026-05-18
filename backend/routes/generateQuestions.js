'use strict';

const express = require('express');
const router = express.Router();
const { generateQuestions, EDEXCEL_THEMES } = require('../services/claude');

// POST /api/generate-questions
router.post('/', async (req, res) => {
  const { theme, count } = req.body;

  // Validate theme is present
  if (!theme) {
    return res.status(400).json({ error: 'theme is required' });
  }

  // Validate theme is one of the 6 valid Edexcel slugs
  const validThemes = Object.keys(EDEXCEL_THEMES);
  if (!validThemes.includes(theme)) {
    return res.status(400).json({ error: 'Invalid theme', validThemes });
  }

  // Default count to 5; cap at 10
  const resolvedCount = Math.min(typeof count === 'number' ? count : 5, 10);

  try {
    const questions = await generateQuestions(theme, resolvedCount);
    return res.status(200).json({ questions });
  } catch (err) {
    return res.status(502).json({ error: 'Generation failed', detail: err.message });
  }
});

module.exports = router;
