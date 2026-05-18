'use strict';

const express = require('express');
const router = express.Router();
const claude = require('../services/claude');

// POST /api/evaluate
router.post('/', async (req, res) => {
  const { question, studentResponse, modelAnswer = null, priorAttempts = [] } = req.body;

  if (!question || !studentResponse) {
    return res.status(400).json({ error: 'question and studentResponse are required' });
  }

  // Cap priorAttempts to last 3
  const cappedPriorAttempts = Array.isArray(priorAttempts) ? priorAttempts.slice(-3) : [];

  try {
    const result = await claude.evaluateResponse({
      question,
      studentResponse,
      modelAnswer: modelAnswer || null,
      priorAttempts: cappedPriorAttempts,
    });

    return res.status(200).json(result);
  } catch (err) {
    return res.status(502).json({ error: 'Evaluation failed', detail: err.message });
  }
});

module.exports = router;
