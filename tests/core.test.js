/**
 * @jest-environment jsdom
 */
'use strict';

// ---------------------------------------------------------------------------
// Setup — build the minimal DOM that core.js expects, inject globals that
// data.js would normally provide, then load core.js under test.
// ---------------------------------------------------------------------------

// Helper: create a minimal HTML skeleton matching all required element IDs
function buildDOM() {
  document.body.innerHTML = `
    <span id="mode-indicator">Practising with 30 seeded questions</span>
    <button id="history-toggle-btn">History</button>
    <p id="question-text">Press &quot;New Question&quot; to begin.</p>
    <button id="audio-replay-btn" hidden>Replay</button>
    <p id="tts-error" hidden></p>
    <button id="mode-text-btn" class="active">Text Response</button>
    <button id="mode-speech-btn">Speech Response</button>
    <textarea id="response-textarea"></textarea>
    <div id="speech-display" hidden>
      <p id="speech-transcript-text"></p>
      <p id="transcription-error" hidden></p>
    </div>
    <button id="record-btn" hidden>Record</button>
    <button id="new-question-btn">New Question</button>
    <button id="submit-btn" hidden>Submit Answer</button>
    <button id="clear-btn">Clear History</button>
    <p id="submit-error" hidden></p>
    <section id="feedback-panel" hidden>
      <span id="score-overall" class="score-badge">&#x2014;</span>
      <span id="score-communication" class="score-badge">&#x2014;</span>
      <span id="score-range" class="score-badge">&#x2014;</span>
      <p id="feedback-raw-response"></p>
      <p id="feedback-corrected"></p>
      <p id="feedback-model"></p>
      <p id="feedback-comments"></p>
      <div id="feedback-progress" hidden>
        <p id="feedback-progress-text"></p>
      </div>
    </section>
    <div id="excel-upload-zone"></div>
    <div id="theme-selector"></div>
    <div id="history-panel" hidden></div>
    <div id="history-list"></div>
  `;
}

// Inject the globals data.js provides into the jsdom window/global scope
function injectDataGlobals() {
  global.SEEDED_QUESTIONS = [
    { theme: 'home-abroad', q: 'Décris-moi la ville où tu habites.', answer: "J'habite à Londres.", translation: 'I live in London.' },
    { theme: 'personal-life', q: 'Parle-moi de ta famille.', answer: "J'ai une grande famille.", translation: 'I have a big family.' },
    { theme: 'social-activities', q: "Qu'est-ce que tu aimes faire le weekend?", answer: "J'aime jouer au foot.", translation: 'I like to play football.' },
  ];
  global.activeQuestions = [...global.SEEDED_QUESTIONS];
  global.activeSource = 'seeded';
  global.LS_HISTORY = 'frenchie_history';
  global.LS_QUESTION_HISTORY = 'frenchie_questionHistory';
  global.TTL_MS = 48 * 60 * 60 * 1000;
}

// Inject data globals before loading core.js (mimics data.js loading first in browser)
injectDataGlobals();

// Load core.js — uses module.exports when in Node/jsdom environment
const core = require('../frontend/core.js');

beforeEach(() => {
  buildDOM();
  // Reset module-level globals between tests
  global.activeQuestions = [...global.SEEDED_QUESTIONS];
  global.activeSource = 'seeded';
  localStorage.clear();
  // Reset fetch mock
  global.fetch = undefined;
  // Reset window stubs
  delete window.playQuestionAudio;
  delete window.getCurrentTranscript;
});

// ---------------------------------------------------------------------------
// Test group 1 — newQuestion() changes #question-text
// ---------------------------------------------------------------------------
describe('newQuestion()', () => {
  test('changes #question-text to one of the seeded questions', () => {
    const questionEl = document.getElementById('question-text');

    core.newQuestion();

    const after = questionEl.textContent;
    const questionTexts = global.SEEDED_QUESTIONS.map(q => q.q);
    expect(questionTexts).toContain(after);
  });

  test('shows the submit button after a question is loaded', () => {
    const submitBtn = document.getElementById('submit-btn');
    expect(submitBtn.hidden).toBe(true);

    core.newQuestion();

    expect(submitBtn.hidden).toBe(false);
  });

  test('hides the feedback panel when a new question is loaded', () => {
    const panel = document.getElementById('feedback-panel');
    panel.hidden = false;
    panel.classList.add('visible');

    core.newQuestion();

    expect(panel.hidden).toBe(true);
    expect(panel.classList.contains('visible')).toBe(false);
  });

  test('calls window.playQuestionAudio if it exists', () => {
    const mockAudio = jest.fn();
    window.playQuestionAudio = mockAudio;

    core.newQuestion();

    expect(mockAudio).toHaveBeenCalledTimes(1);
    expect(typeof mockAudio.mock.calls[0][0]).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Test group 2 — submitResponse() calls fetch('/api/evaluate') with correct body
// ---------------------------------------------------------------------------
describe('submitResponse() — text mode', () => {
  test('calls POST /api/evaluate with correct body shape', async () => {
    core.newQuestion();
    const state = core._getState();
    const q = state.currentQuestion;

    document.getElementById('response-textarea').value = 'Je vais à Paris.';

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        overallScore: 7, communicationScore: 4, rangeAccuracyScore: 7,
        rawResponse: 'Je vais à Paris.', correctedAnswer: 'Je vais souvent à Paris.',
        modelAnswer: null, comments: 'Good answer.',
      }),
    });
    global.fetch = mockFetch;

    await core.submitResponse();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/evaluate');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body).toHaveProperty('question', q.q);
    expect(body).toHaveProperty('studentResponse', 'Je vais à Paris.');
  });

  test('includes modelAnswer in payload when current question has an answer', async () => {
    global.activeQuestions = [
      { theme: 'home-abroad', q: 'Test question?', answer: 'Test answer', translation: 'Test translation' },
    ];
    core.newQuestion();

    document.getElementById('response-textarea').value = 'My response';

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        overallScore: 5, communicationScore: 3, rangeAccuracyScore: 5,
        rawResponse: 'My response', correctedAnswer: 'Ma réponse',
        modelAnswer: 'Test answer', comments: 'OK',
      }),
    });
    global.fetch = mockFetch;

    await core.submitResponse();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveProperty('modelAnswer', 'Test answer');
  });

  test('includes priorAttempts from localStorage when they exist', async () => {
    core.newQuestion();
    const { currentQuestion: q } = core._getState();

    const priorHistory = {
      [q.q]: [
        { response: 'First attempt', overallScore: 4, comments: 'OK', timestamp: Date.now() - 3000 },
        { response: 'Second attempt', overallScore: 6, comments: 'Better', timestamp: Date.now() - 1000 },
      ],
    };
    localStorage.setItem(global.LS_QUESTION_HISTORY, JSON.stringify(priorHistory));

    document.getElementById('response-textarea').value = 'Third attempt';

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        overallScore: 7, communicationScore: 4, rangeAccuracyScore: 7,
        rawResponse: 'Third attempt', correctedAnswer: 'Troisième tentative',
        modelAnswer: null, comments: 'Well done.', progressComparison: 'Better than last time.',
      }),
    });
    global.fetch = mockFetch;

    await core.submitResponse();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.priorAttempts).toBeDefined();
    expect(body.priorAttempts).toHaveLength(2);
    expect(body.priorAttempts[0].response).toBe('First attempt');
    expect(body.priorAttempts[1].response).toBe('Second attempt');
  });

  test('caps priorAttempts at 3 most recent when more than 3 exist in localStorage', async () => {
    core.newQuestion();
    const { currentQuestion: q } = core._getState();

    const attempts = [
      { response: 'a1', overallScore: 1, comments: 'c1', timestamp: Date.now() - 5000 },
      { response: 'a2', overallScore: 2, comments: 'c2', timestamp: Date.now() - 4000 },
      { response: 'a3', overallScore: 3, comments: 'c3', timestamp: Date.now() - 3000 },
      { response: 'a4', overallScore: 4, comments: 'c4', timestamp: Date.now() - 2000 },
      { response: 'a5', overallScore: 5, comments: 'c5', timestamp: Date.now() - 1000 },
    ];
    localStorage.setItem(global.LS_QUESTION_HISTORY, JSON.stringify({ [q.q]: attempts }));

    document.getElementById('response-textarea').value = 'New attempt';

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        overallScore: 6, communicationScore: 3, rangeAccuracyScore: 6,
        rawResponse: 'New attempt', correctedAnswer: 'Nouvelle tentative',
        modelAnswer: null, comments: 'Good.',
      }),
    });
    global.fetch = mockFetch;

    await core.submitResponse();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.priorAttempts).toHaveLength(3);
    expect(body.priorAttempts[0].response).toBe('a3');
    expect(body.priorAttempts[1].response).toBe('a4');
    expect(body.priorAttempts[2].response).toBe('a5');
  });

  test('shows error message and keeps feedback hidden when fetch fails', async () => {
    core.newQuestion();
    document.getElementById('response-textarea').value = 'My response';

    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    await core.submitResponse();

    const submitError = document.getElementById('submit-error');
    expect(submitError.hidden).toBe(false);
    expect(submitError.textContent).toContain('Network error');

    expect(document.getElementById('feedback-panel').hidden).toBe(true);
  });

  test('does not call fetch when response textarea is empty', async () => {
    core.newQuestion();
    document.getElementById('response-textarea').value = '';

    const mockFetch = jest.fn();
    global.fetch = mockFetch;

    await core.submitResponse();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(document.getElementById('submit-error').hidden).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test group 3 — Feedback panel visible + all sections rendered after evaluate
// ---------------------------------------------------------------------------
describe('renderFeedback()', () => {
  test('feedback panel gets class "visible" after successful evaluate', async () => {
    core.newQuestion();
    document.getElementById('response-textarea').value = 'Je vais à Paris.';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        overallScore: 7, communicationScore: 4, rangeAccuracyScore: 7,
        rawResponse: 'Je vais à Paris.', correctedAnswer: 'Je vais souvent à Paris.',
        modelAnswer: 'Je vais à Paris en été.', comments: 'Well structured.',
      }),
    });

    await core.submitResponse();

    const panel = document.getElementById('feedback-panel');
    expect(panel.hidden).toBe(false);
    expect(panel.classList.contains('visible')).toBe(true);
  });

  test('renders score values in badge elements', () => {
    core.renderFeedback({
      overallScore: 8, communicationScore: 5, rangeAccuracyScore: 8,
      rawResponse: 'Ma réponse', correctedAnswer: 'Ma réponse corrigée',
      modelAnswer: 'Réponse modèle', comments: 'Excellent.',
    });

    expect(document.getElementById('score-overall').textContent).toBe('8');
    expect(document.getElementById('score-communication').textContent).toBe('5');
    expect(document.getElementById('score-range').textContent).toBe('8');
  });

  test('renders all 7 text sections with content', () => {
    core.renderFeedback({
      overallScore: 6, communicationScore: 3, rangeAccuracyScore: 6,
      rawResponse: 'Raw text', correctedAnswer: 'Corrected text',
      modelAnswer: 'Model text', comments: 'Comments text',
    });

    expect(document.getElementById('feedback-raw-response').textContent).toBe('Raw text');
    expect(document.getElementById('feedback-corrected').textContent).toBe('Corrected text');
    expect(document.getElementById('feedback-model').textContent).toBe('Model text');
    expect(document.getElementById('feedback-comments').textContent).toBe('Comments text');
  });

  test('shows "Not available" for model answer section when modelAnswer is null', () => {
    core.renderFeedback({
      overallScore: 5, communicationScore: 3, rangeAccuracyScore: 5,
      rawResponse: 'Response', correctedAnswer: 'Corrected',
      modelAnswer: null, comments: 'OK',
    });

    expect(document.getElementById('feedback-model').textContent).toBe('Not available');
  });

  test('applies green badge class for scores 7–9', () => {
    core.renderFeedback({
      overallScore: 9, communicationScore: 5, rangeAccuracyScore: 9,
      rawResponse: 'R', correctedAnswer: 'C', modelAnswer: null, comments: 'C',
    });

    expect(document.getElementById('score-overall').classList.contains('badge-green')).toBe(true);
  });

  test('applies amber badge class for scores 4–6', () => {
    core.renderFeedback({
      overallScore: 5, communicationScore: 3, rangeAccuracyScore: 5,
      rawResponse: 'R', correctedAnswer: 'C', modelAnswer: null, comments: 'C',
    });

    expect(document.getElementById('score-overall').classList.contains('badge-amber')).toBe(true);
  });

  test('applies red badge class for scores 0–3', () => {
    core.renderFeedback({
      overallScore: 2, communicationScore: 1, rangeAccuracyScore: 2,
      rawResponse: 'R', correctedAnswer: 'C', modelAnswer: null, comments: 'C',
    });

    expect(document.getElementById('score-overall').classList.contains('badge-red')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test group 4 — #feedback-progress hidden when progressComparison absent
// ---------------------------------------------------------------------------
describe('#feedback-progress section visibility', () => {
  test('hides #feedback-progress when progressComparison is absent in response', () => {
    core.renderFeedback({
      overallScore: 7, communicationScore: 4, rangeAccuracyScore: 7,
      rawResponse: 'Response', correctedAnswer: 'Corrected',
      modelAnswer: null, comments: 'Good.',
      // no progressComparison
    });

    expect(document.getElementById('feedback-progress').hidden).toBe(true);
  });

  test('shows #feedback-progress when progressComparison is present', () => {
    core.renderFeedback({
      overallScore: 7, communicationScore: 4, rangeAccuracyScore: 7,
      rawResponse: 'Response', correctedAnswer: 'Corrected',
      modelAnswer: null, comments: 'Good.',
      progressComparison: 'Better than last time — you used more tenses.',
    });

    expect(document.getElementById('feedback-progress').hidden).toBe(false);
    expect(document.getElementById('feedback-progress-text').textContent)
      .toBe('Better than last time — you used more tenses.');
  });
});

// ---------------------------------------------------------------------------
// Test group 5 — clearAll() removes both LS keys
// ---------------------------------------------------------------------------
describe('clearAll()', () => {
  test('calls localStorage.removeItem for both LS keys after confirm', () => {
    localStorage.setItem(global.LS_HISTORY, JSON.stringify([{ id: '1' }]));
    localStorage.setItem(global.LS_QUESTION_HISTORY, JSON.stringify({ 'Q?': [] }));

    const originalConfirm = window.confirm;
    window.confirm = jest.fn().mockReturnValue(true);
    const removeSpy = jest.spyOn(Storage.prototype, 'removeItem');

    core.clearAll();

    expect(removeSpy).toHaveBeenCalledWith(global.LS_HISTORY);
    expect(removeSpy).toHaveBeenCalledWith(global.LS_QUESTION_HISTORY);
    expect(localStorage.getItem(global.LS_HISTORY)).toBeNull();
    expect(localStorage.getItem(global.LS_QUESTION_HISTORY)).toBeNull();

    window.confirm = originalConfirm;
    removeSpy.mockRestore();
  });

  test('does NOT clear localStorage when confirm returns false', () => {
    localStorage.setItem(global.LS_HISTORY, JSON.stringify([{ id: '1' }]));

    const originalConfirm = window.confirm;
    window.confirm = jest.fn().mockReturnValue(false);
    const removeSpy = jest.spyOn(Storage.prototype, 'removeItem');

    core.clearAll();

    expect(removeSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem(global.LS_HISTORY)).not.toBeNull();

    window.confirm = originalConfirm;
    removeSpy.mockRestore();
  });

  test('resets activeQuestions to SEEDED_QUESTIONS after clear', () => {
    global.activeQuestions = [{ theme: 'custom', q: 'Custom Q?', answer: null, translation: null }];

    const originalConfirm = window.confirm;
    window.confirm = jest.fn().mockReturnValue(true);

    core.clearAll();

    expect(global.activeQuestions).toEqual(global.SEEDED_QUESTIONS);

    window.confirm = originalConfirm;
  });

  test('resets mode indicator text to seeded label after clear', () => {
    document.getElementById('mode-indicator').textContent = 'Custom questions loaded (5 questions)';

    const originalConfirm = window.confirm;
    window.confirm = jest.fn().mockReturnValue(true);

    core.clearAll();

    expect(document.getElementById('mode-indicator').textContent)
      .toBe('Practising with 30 seeded questions');

    window.confirm = originalConfirm;
  });
});

// ---------------------------------------------------------------------------
// Test group 6 — setMode() show/hide elements
// ---------------------------------------------------------------------------
describe('setMode()', () => {
  test('text mode shows textarea and hides speech-display and record-btn', () => {
    core.setMode('text');
    expect(document.getElementById('response-textarea').hidden).toBe(false);
    expect(document.getElementById('speech-display').hidden).toBe(true);
    expect(document.getElementById('record-btn').hidden).toBe(true);
  });

  test('speech mode hides textarea and shows speech-display and record-btn', () => {
    core.setMode('speech');
    expect(document.getElementById('response-textarea').hidden).toBe(true);
    expect(document.getElementById('speech-display').hidden).toBe(false);
    expect(document.getElementById('record-btn').hidden).toBe(false);
  });

  test('switching back to text mode copies transcript to textarea', () => {
    document.getElementById('speech-transcript-text').textContent = 'Ma réponse dictée';
    core.setMode('speech');
    core.setMode('text');
    expect(document.getElementById('response-textarea').value).toBe('Ma réponse dictée');
  });

  test('mode-text-btn gets active class in text mode', () => {
    core.setMode('text');
    expect(document.getElementById('mode-text-btn').classList.contains('active')).toBe(true);
    expect(document.getElementById('mode-speech-btn').classList.contains('active')).toBe(false);
  });

  test('mode-speech-btn gets active class in speech mode', () => {
    core.setMode('speech');
    expect(document.getElementById('mode-speech-btn').classList.contains('active')).toBe(true);
    expect(document.getElementById('mode-text-btn').classList.contains('active')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test group 7 — scoreBandClass helper
// ---------------------------------------------------------------------------
describe('scoreBandClass()', () => {
  test('returns badge-red for ≤40% of max', () => {
    expect(core.scoreBandClass(0, 10)).toBe('badge-red');
    expect(core.scoreBandClass(4, 10)).toBe('badge-red');
    expect(core.scoreBandClass(2, 5)).toBe('badge-red');
  });

  test('returns badge-amber for 41–70% of max', () => {
    expect(core.scoreBandClass(5, 10)).toBe('badge-amber');
    expect(core.scoreBandClass(7, 10)).toBe('badge-amber');
    expect(core.scoreBandClass(3, 5)).toBe('badge-amber');
  });

  test('returns badge-green for >70% of max', () => {
    expect(core.scoreBandClass(8, 10)).toBe('badge-green');
    expect(core.scoreBandClass(10, 10)).toBe('badge-green');
    expect(core.scoreBandClass(4, 5)).toBe('badge-green');
  });
});

// ---------------------------------------------------------------------------
// Test group 8 — setActiveQuestions()
// ---------------------------------------------------------------------------
describe('setActiveQuestions()', () => {
  test('updates mode indicator text for uploaded source', () => {
    const customQuestions = [
      { theme: 'custom', q: 'Q1?', answer: 'A1', translation: null },
      { theme: 'custom', q: 'Q2?', answer: 'A2', translation: null },
    ];

    core.setActiveQuestions(customQuestions, 'uploaded');

    expect(document.getElementById('mode-indicator').textContent)
      .toBe('Custom questions loaded (2 questions)');
  });

  test('updates mode indicator text for seeded source', () => {
    core.setActiveQuestions([...global.SEEDED_QUESTIONS], 'seeded');

    expect(document.getElementById('mode-indicator').textContent)
      .toBe('Practising with 30 seeded questions');
  });

  test('auto-triggers newQuestion and updates question-text', () => {
    const customQuestions = [
      { theme: 'custom', q: 'Ma question personnalisée?', answer: null, translation: null },
    ];

    core.setActiveQuestions(customQuestions, 'uploaded');

    expect(document.getElementById('question-text').textContent)
      .toBe('Ma question personnalisée?');
  });
});
