'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// ---------------------------------------------------------------------------
// CORS
// Allow FRONTEND_ORIGIN if set; fall back to * for local development
// ---------------------------------------------------------------------------
const corsOptions = process.env.FRONTEND_ORIGIN
  ? {
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. same-origin, curl) or the configured origin
        if (!origin || origin === process.env.FRONTEND_ORIGIN) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    }
  : { origin: '*' };

app.use(cors(corsOptions));

// ---------------------------------------------------------------------------
// Body parsers
// ---------------------------------------------------------------------------
app.use(express.json());

// ---------------------------------------------------------------------------
// Static files — serve frontend/ directory
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/api/tts', require('./routes/tts'));
app.use('/api/transcribe', require('./routes/transcribe'));
app.use('/api/evaluate', require('./routes/evaluate'));
app.use('/api/generate-questions', require('./routes/generateQuestions'));
app.use('/api/translate', require('./routes/translate'));

// ---------------------------------------------------------------------------
// Start server (only when not required by tests — avoids port conflicts)
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Frenchie server listening on port ${PORT}`);
  });
}

module.exports = app;
