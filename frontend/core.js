'use strict';

// ---------------------------------------------------------------------------
// core.js — Question Bank, Core UI Loop, and Feedback Panel
// Depends on data.js being loaded first (provides SEEDED_QUESTIONS,
// activeQuestions, activeSource, LS_HISTORY, LS_QUESTION_HISTORY, TTL_MS)
// ---------------------------------------------------------------------------

// Resolve the global object in both browser and Node/jsdom environments
/* global window, global */
var _global = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : {});

// Module-level state
let currentQuestion = null;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the colour class for a score badge based on GCSE bands.
 * Red 0-3, Amber 4-6, Green 7-9.
 * @param {number} score
 * @returns {string} CSS class name
 */
function scoreBandClass(score) {
  if (score <= 3) return 'badge-red';
  if (score <= 6) return 'badge-amber';
  return 'badge-green';
}

/**
 * Apply score value and colour to a badge element.
 * @param {HTMLElement} el
 * @param {number} score
 */
function applyBadge(el, score) {
  el.textContent = String(score);
  el.className = 'score-badge ' + scoreBandClass(score);
}

/**
 * Read the question history map.
 * Prefers window.getQuestionHistory() (provided by history.js, keeps
 * _questionHistory in sync); falls back to reading localStorage directly.
 * @returns {Object} QuestionHistoryMap or {}
 */
function readQuestionHistory() {
  // Use history.js getter when available (keeps in-memory map in sync)
  if (typeof _global.getQuestionHistory === 'function') {
    return _global.getQuestionHistory();
  }
  // Fallback for test environments where history.js may not be loaded
  try {
    const raw = localStorage.getItem(LS_QUESTION_HISTORY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

/**
 * Show an inline error message.
 * @param {HTMLElement} el
 * @param {string} message
 */
function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

/**
 * Clear an inline error message.
 * @param {HTMLElement} el
 */
function clearError(el) {
  el.textContent = '';
  el.hidden = true;
}

// ---------------------------------------------------------------------------
// newQuestion() — pick a random question and display it
// ---------------------------------------------------------------------------

/**
 * Pick a random question from `activeQuestions`, update the display, trigger
 * TTS playback (delegated to audio.js), and reset the response/feedback areas.
 */
function newQuestion() {
  if (!activeQuestions || activeQuestions.length === 0) {
    console.warn('core.js: activeQuestions is empty');
    return;
  }

  const idx = Math.floor(Math.random() * activeQuestions.length);
  currentQuestion = activeQuestions[idx];

  // Update question card text
  const questionEl = document.getElementById('question-text');
  if (questionEl) questionEl.textContent = currentQuestion.q;

  // Clear the feedback panel
  _hideFeedbackPanel();

  // Show submit button now that a question is loaded
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) submitBtn.hidden = false;

  // Clear any existing response
  const textarea = document.getElementById('response-textarea');
  if (textarea) textarea.value = '';

  const transcriptEl = document.getElementById('speech-transcript-text');
  if (transcriptEl) transcriptEl.textContent = '';

  // Clear submit error
  const submitError = document.getElementById('submit-error');
  if (submitError) clearError(submitError);

  // Delegate TTS to audio.js (stub-safe: only call if function exists)
  if (typeof _global.playQuestionAudio === 'function') {
    _global.playQuestionAudio(currentQuestion.q);
  }

  // Dispatch event so other modules (history.js, etc.) can react if needed
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('frenchie:newQuestion', {
      detail: { question: currentQuestion },
    }));
  }
}

// ---------------------------------------------------------------------------
// setMode(mode) — toggle between 'text' and 'speech' modes
// ---------------------------------------------------------------------------

/**
 * Switch the response input mode.
 * @param {'text'|'speech'} mode
 */
function setMode(mode) {
  const textarea = document.getElementById('response-textarea');
  const speechDisplay = document.getElementById('speech-display');
  const recordBtn = document.getElementById('record-btn');
  const textBtn = document.getElementById('mode-text-btn');
  const speechBtn = document.getElementById('mode-speech-btn');

  if (mode === 'text') {
    if (textarea) textarea.hidden = false;
    if (speechDisplay) speechDisplay.hidden = true;
    if (recordBtn) recordBtn.hidden = true;
    if (textBtn) {
      textBtn.classList.add('active');
      textBtn.setAttribute('aria-pressed', 'true');
    }
    if (speechBtn) {
      speechBtn.classList.remove('active');
      speechBtn.setAttribute('aria-pressed', 'false');
    }

    // Copy transcript into textarea if there is one (spec: switching to text
    // mode after recording retains the transcript)
    const transcriptEl = document.getElementById('speech-transcript-text');
    if (transcriptEl && transcriptEl.textContent && textarea) {
      textarea.value = transcriptEl.textContent;
    }
  } else if (mode === 'speech') {
    if (textarea) textarea.hidden = true;
    if (speechDisplay) speechDisplay.hidden = false;
    if (recordBtn) recordBtn.hidden = false;
    if (textBtn) {
      textBtn.classList.remove('active');
      textBtn.setAttribute('aria-pressed', 'false');
    }
    if (speechBtn) {
      speechBtn.classList.add('active');
      speechBtn.setAttribute('aria-pressed', 'true');
    }
  }
}

// ---------------------------------------------------------------------------
// submitResponse() — validate, look up history, call /api/evaluate
// ---------------------------------------------------------------------------

/**
 * Gather the student's response (text or transcript), validate, build the
 * evaluate payload (including up to 3 prior attempts), POST to /api/evaluate,
 * then render feedback on success.
 */
async function submitResponse() {
  if (!currentQuestion) {
    if (typeof alert !== 'undefined') alert('Please get a question first.');
    return;
  }

  // Determine current mode by checking which element is visible
  const textarea = document.getElementById('response-textarea');
  const speechDisplay = document.getElementById('speech-display');
  const isSpeechMode = speechDisplay && !speechDisplay.hidden;

  let studentResponse;
  if (isSpeechMode) {
    // Ask audio.js for the current transcript
    if (typeof _global.getCurrentTranscript === 'function') {
      studentResponse = _global.getCurrentTranscript();
    } else {
      // Fallback: read from transcript display element
      const transcriptEl = document.getElementById('speech-transcript-text');
      studentResponse = transcriptEl ? transcriptEl.textContent.trim() : '';
    }
    // Speech-mode-specific empty message
    if (!studentResponse) {
      const submitError = document.getElementById('submit-error');
      if (submitError) showError(submitError, 'Please record your answer first.');
      return;
    }
  } else {
    studentResponse = textarea ? textarea.value.trim() : '';
    if (!studentResponse) {
      const submitError = document.getElementById('submit-error');
      if (submitError) showError(submitError, 'Please enter or record a response before submitting.');
      return;
    }
  }

  // Clear previous errors
  const submitError = document.getElementById('submit-error');
  if (submitError) clearError(submitError);

  // Look up prior attempts for this question (cap at 3 most recent)
  const qHistory = readQuestionHistory();
  const allPrior = qHistory[currentQuestion.q] || [];
  // allPrior is oldest-first; take the last 3 entries (most recent)
  const priorAttempts = allPrior.slice(-3).map(a => ({
    response: a.response,
    overallScore: a.overallScore,
    comments: a.comments || '',
  }));

  // Build payload
  const payload = {
    question: currentQuestion.q,
    studentResponse,
  };
  if (currentQuestion.answer) {
    payload.modelAnswer = currentQuestion.answer;
  }
  if (priorAttempts.length > 0) {
    payload.priorAttempts = priorAttempts;
  }

  // Show loading state on submit button
  const submitBtn = document.getElementById('submit-btn');
  const originalBtnText = submitBtn ? submitBtn.textContent : '';
  if (submitBtn) {
    submitBtn.textContent = 'Evaluating…';
    submitBtn.disabled = true;
  }

  try {
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let detail = res.statusText;
      try { detail = (await res.json()).detail || detail; } catch (_) {}
      throw new Error(detail);
    }

    const evalResult = await res.json();

    // Render feedback
    renderFeedback(evalResult);

    // Hide submit button after successful submission (student clicks New Question next)
    if (submitBtn) submitBtn.hidden = true;

    // Save history — call history.js directly if available
    if (typeof _global.saveHistory === 'function') {
      const entry = {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : String(Date.now()) + '-' + Math.random(),
        question: currentQuestion.q,
        userResponse: studentResponse,
        overallScore: evalResult.overallScore,
        communicationScore: evalResult.communicationScore,
        rangeAccuracyScore: evalResult.rangeAccuracyScore,
        correctedAnswer: evalResult.correctedAnswer || '',
        modelAnswer: evalResult.modelAnswer || null,
        comments: evalResult.comments || '',
        progressComparison: evalResult.progressComparison || null,
        timestamp: Date.now(),
        source: activeSource,
        theme: currentQuestion.theme || 'custom',
      };
      _global.saveHistory(entry);
    }

    // Dispatch event so history.js (C5) can also react (panel refresh, etc.)
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('frenchie:evaluated', {
        detail: {
          question: currentQuestion,
          studentResponse,
          evalResult,
          source: activeSource,
        },
      }));
    }

  } catch (err) {
    if (submitError) showError(submitError, 'Evaluation failed: ' + err.message);
    console.error('core.js submitResponse error:', err);
  } finally {
    if (submitBtn) {
      // Restore text but only if we didn't hide the button (i.e. on error path)
      if (!submitBtn.hidden) {
        submitBtn.textContent = originalBtnText;
      } else {
        submitBtn.textContent = originalBtnText;
      }
      submitBtn.disabled = false;
    }
  }
}

// ---------------------------------------------------------------------------
// renderFeedback(evalResult) — populate all 7 (+ optional 8th) sections
// ---------------------------------------------------------------------------

/**
 * Populate the feedback panel with the evaluate API response.
 * @param {Object} evalResult
 */
function renderFeedback(evalResult) {
  const panel = document.getElementById('feedback-panel');
  if (!panel) return;

  // --- Score badges ---
  const overallEl = document.getElementById('score-overall');
  const commEl = document.getElementById('score-communication');
  const rangeEl = document.getElementById('score-range');

  if (overallEl) applyBadge(overallEl, evalResult.overallScore);
  if (commEl) applyBadge(commEl, evalResult.communicationScore);
  if (rangeEl) applyBadge(rangeEl, evalResult.rangeAccuracyScore);

  // --- Text sections ---
  const rawEl = document.getElementById('feedback-raw-response');
  if (rawEl) rawEl.textContent = evalResult.rawResponse || '';

  const correctedEl = document.getElementById('feedback-corrected');
  if (correctedEl) correctedEl.textContent = evalResult.correctedAnswer || '';

  const modelEl = document.getElementById('feedback-model');
  if (modelEl) {
    modelEl.textContent = evalResult.modelAnswer
      ? evalResult.modelAnswer
      : 'Not available';
  }

  const commentsEl = document.getElementById('feedback-comments');
  if (commentsEl) commentsEl.textContent = evalResult.comments || '';

  // --- Progress section (8th) — only when progressComparison is present ---
  const progressSection = document.getElementById('feedback-progress');
  const progressText = document.getElementById('feedback-progress-text');
  if (progressSection) {
    if (evalResult.progressComparison) {
      if (progressText) progressText.textContent = evalResult.progressComparison;
      progressSection.hidden = false;
    } else {
      if (progressText) progressText.textContent = '';
      progressSection.hidden = true;
    }
  }

  // --- Show the panel ---
  panel.hidden = false;
  panel.classList.add('visible');

  // Scroll feedback panel into view smoothly (only in real browser)
  if (typeof panel.scrollIntoView === 'function') {
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ---------------------------------------------------------------------------
// _hideFeedbackPanel() — internal: reset and hide the feedback panel
// ---------------------------------------------------------------------------

function _hideFeedbackPanel() {
  const panel = document.getElementById('feedback-panel');
  if (!panel) return;
  panel.hidden = true;
  panel.classList.remove('visible');

  // Reset badge elements
  ['score-overall', 'score-communication', 'score-range'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = '—';
      el.className = 'score-badge';
    }
  });

  // Reset text sections
  ['feedback-raw-response', 'feedback-corrected', 'feedback-model',
    'feedback-comments', 'feedback-progress-text'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });

  // Hide progress section
  const progressSection = document.getElementById('feedback-progress');
  if (progressSection) progressSection.hidden = true;
}

// ---------------------------------------------------------------------------
// clearAll() — confirm, clear localStorage, reset state and UI
// ---------------------------------------------------------------------------

/**
 * Prompt the user to confirm, then clear all history from localStorage, reset
 * the active question bank to the seeded default, and reset the UI.
 */
function clearAll() {
  const confirmed = (typeof confirm !== 'undefined')
    ? confirm('Are you sure you want to clear all practice history? This cannot be undone.')
    : true;
  if (!confirmed) return;

  // Clear localStorage — prefer history.js function to keep _questionHistory in sync
  if (typeof _global.clearHistoryStorage === 'function') {
    _global.clearHistoryStorage();
  } else {
    localStorage.removeItem(LS_HISTORY);
    localStorage.removeItem(LS_QUESTION_HISTORY);
  }

  // Reset active question bank and source
  // eslint-disable-next-line no-global-assign
  activeQuestions = [...SEEDED_QUESTIONS];
  // eslint-disable-next-line no-global-assign
  activeSource = 'seeded';

  // Update mode indicator
  const modeIndicator = document.getElementById('mode-indicator');
  if (modeIndicator) modeIndicator.textContent = 'Practising with 30 seeded questions';

  // Reset UI
  currentQuestion = null;

  const questionEl = document.getElementById('question-text');
  if (questionEl) questionEl.textContent = 'Press "New Question" to begin.';

  const textarea = document.getElementById('response-textarea');
  if (textarea) textarea.value = '';

  const transcriptEl = document.getElementById('speech-transcript-text');
  if (transcriptEl) transcriptEl.textContent = '';

  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) submitBtn.hidden = true;

  _hideFeedbackPanel();

  // Clear errors
  ['submit-error', 'tts-error', 'upload-error', 'transcription-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) clearError(el);
  });

  // Notify other modules (e.g. history.js to re-render empty state)
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('frenchie:cleared'));
  }
}

// ---------------------------------------------------------------------------
// setActiveQuestions() — called by excel.js and themes.js
// Exposed as window.setActiveQuestions in browser; also exported for tests.
// ---------------------------------------------------------------------------

/**
 * Replace the active question bank.
 * @param {Array} questions - Array of question objects {q, answer, translation, theme}
 * @param {'seeded'|'uploaded'|'ai-generated'} source
 */
function setActiveQuestions(questions, source) {
  // eslint-disable-next-line no-global-assign
  activeQuestions = questions;
  // eslint-disable-next-line no-global-assign
  activeSource = source;

  // Update mode indicator label
  const modeIndicator = document.getElementById('mode-indicator');
  if (modeIndicator) {
    if (source === 'seeded') {
      modeIndicator.textContent = 'Practising with 30 seeded questions';
    } else if (source === 'uploaded') {
      modeIndicator.textContent =
        'Custom questions loaded (' + questions.length + ' question' +
        (questions.length !== 1 ? 's' : '') + ')';
    } else if (source === 'ai-generated') {
      // themes.js will set a more descriptive label after this call;
      // set a neutral fallback in case themes.js label logic is skipped
      modeIndicator.textContent =
        'AI questions loaded (' + questions.length + ' question' +
        (questions.length !== 1 ? 's' : '') + ')';
    }
  }

  // Auto-trigger a new question
  newQuestion();
}

// Expose on the global object for browser use
_global.setActiveQuestions = setActiveQuestions;
// Also expose newQuestion so themes.js can call window.newQuestion()
_global.newQuestion = newQuestion;

// ---------------------------------------------------------------------------
// DOMContentLoaded — wire event listeners
// ---------------------------------------------------------------------------

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    // New Question button
    const newQuestionBtn = document.getElementById('new-question-btn');
    if (newQuestionBtn) {
      newQuestionBtn.addEventListener('click', newQuestion);
    }

    // Submit button
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', submitResponse);
    }

    // Clear button
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', clearAll);
    }

    // Mode toggle buttons
    const modeTextBtn = document.getElementById('mode-text-btn');
    const modeSpeechBtn = document.getElementById('mode-speech-btn');

    if (modeTextBtn) {
      modeTextBtn.addEventListener('click', function () { setMode('text'); });
      modeTextBtn.setAttribute('aria-pressed', 'true');
    }
    if (modeSpeechBtn) {
      modeSpeechBtn.addEventListener('click', function () { setMode('speech'); });
      modeSpeechBtn.setAttribute('aria-pressed', 'false');
    }

    // Start in text mode
    setMode('text');
  });
}

// ---------------------------------------------------------------------------
// Expose functions needed by tests and other modules
// ---------------------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    newQuestion,
    setMode,
    submitResponse,
    renderFeedback,
    clearAll,
    setActiveQuestions,
    scoreBandClass,
    _hideFeedbackPanel,
    _getState: function () { return { currentQuestion, activeQuestions, activeSource }; },
    _setCurrentQuestion: function (q) { currentQuestion = q; },
  };
}
