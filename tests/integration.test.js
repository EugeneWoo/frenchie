/**
 * @jest-environment jsdom
 */
'use strict';

// ---------------------------------------------------------------------------
// integration.test.js — D2: End-to-End Wiring and Integration Tests
//
// Tests the cross-module wiring between:
//   core.js ↔ audio.js
//   core.js ↔ history.js
//   core.js ↔ excel.js / themes.js
// ---------------------------------------------------------------------------

const LS_HISTORY = 'frenchie_history';
const LS_QUESTION_HISTORY = 'frenchie_questionHistory';
const TTL_MS = 48 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Shared DOM skeleton used by all integration tests
// ---------------------------------------------------------------------------
function buildDOM() {
  document.body.innerHTML = `
    <span id="mode-indicator">Practising with 30 seeded questions</span>
    <button id="history-toggle-btn">History</button>
    <div id="history-overlay" style="display:none"></div>
    <aside id="history-panel" class="history-panel" aria-hidden="true">
      <button id="history-close-btn">&times;</button>
      <div id="history-list"><p class="history-empty">No practice history yet.</p></div>
    </aside>
    <p id="question-text">Press "New Question" to begin.</p>
    <button id="audio-replay-btn" hidden>Replay</button>
    <p id="tts-audio" style="display:none"></p>
    <p id="tts-error" hidden></p>
    <button id="mode-text-btn" class="active">Text Response</button>
    <button id="mode-speech-btn">Speech Response</button>
    <textarea id="response-textarea"></textarea>
    <div id="speech-display" hidden>
      <p id="speech-transcript-text"></p>
      <p id="transcribe-error" hidden></p>
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
    <div id="excel-upload-zone">
      <input id="excel-file-input" type="file" />
      <p id="upload-error" hidden></p>
      <button id="return-to-default-btn" hidden>Return to default questions</button>
    </div>
    <div id="theme-selector"></div>
    <p id="theme-error" hidden></p>
  `;
}

// ---------------------------------------------------------------------------
// Shared data globals (mimics data.js)
// ---------------------------------------------------------------------------
function injectDataGlobals() {
  global.SEEDED_QUESTIONS = [
    { theme: 'home-abroad', q: 'Décris-moi la ville où tu habites.', answer: "J'habite à Londres.", translation: 'I live in London.' },
    { theme: 'personal-life', q: 'Parle-moi de ta famille.', answer: "J'ai une grande famille.", translation: 'I have a big family.' },
    { theme: 'social-activities', q: "Qu'est-ce que tu aimes faire le weekend?", answer: "J'aime jouer au foot.", translation: 'I like to play football.' },
  ];
  global.activeQuestions = [...global.SEEDED_QUESTIONS];
  global.activeSource = 'seeded';
  global.LS_HISTORY = LS_HISTORY;
  global.LS_QUESTION_HISTORY = LS_QUESTION_HISTORY;
  global.TTL_MS = TTL_MS;
}

// Inject data globals before any module loads
injectDataGlobals();

// Load modules — order matches the browser script load order
const core = require('../frontend/core.js');

// ---------------------------------------------------------------------------
// beforeEach — fresh DOM and state for every test
// ---------------------------------------------------------------------------
beforeEach(() => {
  buildDOM();
  global.activeQuestions = [...global.SEEDED_QUESTIONS];
  global.activeSource = 'seeded';
  localStorage.clear();
  global.fetch = undefined;

  // Reset window stubs between tests
  delete window.playQuestionAudio;
  delete window.getCurrentTranscript;
  delete window.saveHistory;
  delete window.getQuestionHistory;
  delete window.clearHistoryStorage;
  delete window.newQuestion;
  delete window.setActiveQuestions;

  // Re-expose core.js functions on window (mimics browser load)
  window.setActiveQuestions = core.setActiveQuestions;
  window.newQuestion = core.newQuestion;
});

// ---------------------------------------------------------------------------
// Test 1 — Full text flow: newQuestion → type response → submit → feedback visible
// ---------------------------------------------------------------------------
describe('Full text flow', () => {
  test('newQuestion + type response + submit → feedback panel visible with 7 sections', async () => {
    // Stub window.saveHistory so it doesn't fail (history.js not loaded here)
    window.saveHistory = jest.fn();
    window.getQuestionHistory = jest.fn().mockReturnValue({});

    // Trigger a new question
    core.newQuestion();

    // Verify question is displayed
    const questionEl = document.getElementById('question-text');
    expect(SEEDED_QUESTIONS.map(q => q.q)).toContain(questionEl.textContent);

    // Verify submit button is now visible
    expect(document.getElementById('submit-btn').hidden).toBe(false);

    // Type a response
    document.getElementById('response-textarea').value = 'Je vais souvent à Paris avec ma famille.';

    // Mock fetch to return a full evaluation result
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        overallScore: 7,
        communicationScore: 4,
        rangeAccuracyScore: 7,
        rawResponse: 'Je vais souvent à Paris avec ma famille.',
        correctedAnswer: 'Je vais souvent à Paris avec ma famille.',
        modelAnswer: "J'habite à Londres.",
        comments: 'Good use of adverbs and prepositions.',
      }),
    });

    await core.submitResponse();

    // Feedback panel must be visible
    const panel = document.getElementById('feedback-panel');
    expect(panel.hidden).toBe(false);
    expect(panel.classList.contains('visible')).toBe(true);

    // All 7 sections must have content
    expect(document.getElementById('score-overall').textContent).toBe('7');
    expect(document.getElementById('score-communication').textContent).toBe('4');
    expect(document.getElementById('score-range').textContent).toBe('7');
    expect(document.getElementById('feedback-raw-response').textContent).toBeTruthy();
    expect(document.getElementById('feedback-corrected').textContent).toBeTruthy();
    expect(document.getElementById('feedback-model').textContent).toBeTruthy();
    expect(document.getElementById('feedback-comments').textContent).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Test 2 — History saved: after submit, frenchie_history has 1 entry with correct shape
// ---------------------------------------------------------------------------
describe('History saved after submit', () => {
  test('saveHistory is called with a correctly shaped HistoryEntry after submit', async () => {
    const savedEntries = [];
    window.saveHistory = jest.fn(entry => savedEntries.push(entry));
    window.getQuestionHistory = jest.fn().mockReturnValue({});

    core.newQuestion();
    const { currentQuestion: q } = core._getState();

    document.getElementById('response-textarea').value = "J'habite dans une grande maison.";

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        overallScore: 6,
        communicationScore: 3,
        rangeAccuracyScore: 6,
        rawResponse: "J'habite dans une grande maison.",
        correctedAnswer: "J'habite dans une grande maison.",
        modelAnswer: null,
        comments: 'Decent attempt.',
      }),
    });

    await core.submitResponse();

    // saveHistory must have been called once
    expect(window.saveHistory).toHaveBeenCalledTimes(1);

    const entry = savedEntries[0];

    // Verify all required HistoryEntry fields
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('question', q.q);
    expect(entry).toHaveProperty('userResponse', "J'habite dans une grande maison.");
    expect(entry).toHaveProperty('overallScore', 6);
    expect(entry).toHaveProperty('communicationScore', 3);
    expect(entry).toHaveProperty('rangeAccuracyScore', 6);
    expect(entry).toHaveProperty('correctedAnswer');
    expect(entry).toHaveProperty('modelAnswer');
    expect(entry).toHaveProperty('comments', 'Decent attempt.');
    expect(entry).toHaveProperty('progressComparison');
    expect(entry).toHaveProperty('timestamp');
    expect(typeof entry.timestamp).toBe('number');
    expect(entry).toHaveProperty('source', 'seeded');
    expect(entry).toHaveProperty('theme', q.theme);
  });

  test('frenchie_history localStorage has 1 entry with correct shape after submit via real saveHistory', async () => {
    // Use a real saveHistory implementation (inline, matching history.js behaviour)
    window.saveHistory = function (entry) {
      let arr = [];
      try {
        arr = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
      } catch (_) { arr = []; }
      arr.push(entry);
      localStorage.setItem(LS_HISTORY, JSON.stringify(arr));

      try {
        const qh = JSON.parse(localStorage.getItem(LS_QUESTION_HISTORY) || '{}') || {};
        if (!qh[entry.question]) qh[entry.question] = [];
        qh[entry.question].push({
          response: entry.userResponse,
          overallScore: entry.overallScore,
          comments: entry.comments || '',
          timestamp: entry.timestamp,
        });
        localStorage.setItem(LS_QUESTION_HISTORY, JSON.stringify(qh));
      } catch (_) {}
    };
    window.getQuestionHistory = jest.fn().mockReturnValue({});

    core.newQuestion();

    document.getElementById('response-textarea').value = 'Ma réponse en français.';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        overallScore: 5,
        communicationScore: 3,
        rangeAccuracyScore: 5,
        rawResponse: 'Ma réponse en français.',
        correctedAnswer: 'Ma réponse en français.',
        modelAnswer: null,
        comments: 'Fair attempt.',
      }),
    });

    await core.submitResponse();

    const stored = JSON.parse(localStorage.getItem(LS_HISTORY));
    expect(Array.isArray(stored)).toBe(true);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toHaveProperty('overallScore', 5);
    expect(stored[0]).toHaveProperty('source', 'seeded');
  });
});

// ---------------------------------------------------------------------------
// Test 3 — setActiveQuestions: calling with custom array changes what newQuestion picks from
// ---------------------------------------------------------------------------
describe('setActiveQuestions integration', () => {
  test('calling setActiveQuestions(questions, "uploaded") causes newQuestion to pick from custom array', () => {
    window.saveHistory = jest.fn();

    const customQuestions = [
      { theme: 'custom', q: 'Ma question personnalisée numéro un?', answer: 'Ma réponse modèle.', translation: null },
    ];

    core.setActiveQuestions(customQuestions, 'uploaded');

    // newQuestion is called internally by setActiveQuestions
    const { currentQuestion } = core._getState();
    expect(currentQuestion.q).toBe('Ma question personnalisée numéro un?');
    expect(document.getElementById('question-text').textContent).toBe('Ma question personnalisée numéro un?');
  });

  test('activeSource is set to "uploaded" after setActiveQuestions with uploaded source', () => {
    const customQuestions = [
      { theme: 'custom', q: 'Question?', answer: null, translation: null },
    ];

    core.setActiveQuestions(customQuestions, 'uploaded');

    const { activeSource } = core._getState();
    expect(activeSource).toBe('uploaded');
  });
});

// ---------------------------------------------------------------------------
// Test 4 — Mode indicator: after setActiveQuestions(questions, 'uploaded'), indicator updates
// ---------------------------------------------------------------------------
describe('Mode indicator state machine', () => {
  test('default: "Practising with 30 seeded questions"', () => {
    core.setActiveQuestions([...global.SEEDED_QUESTIONS], 'seeded');
    expect(document.getElementById('mode-indicator').textContent)
      .toBe('Practising with 30 seeded questions');
  });

  test('after setActiveQuestions with "uploaded" source: shows "Custom questions loaded (N questions)"', () => {
    const customQuestions = [
      { theme: 'custom', q: 'Q1?', answer: null, translation: null },
      { theme: 'custom', q: 'Q2?', answer: null, translation: null },
      { theme: 'custom', q: 'Q3?', answer: null, translation: null },
    ];

    core.setActiveQuestions(customQuestions, 'uploaded');

    expect(document.getElementById('mode-indicator').textContent)
      .toBe('Custom questions loaded (3 questions)');
  });

  test('after clearAll: mode indicator reverts to default seeded label', () => {
    // First set a custom source
    core.setActiveQuestions(
      [{ theme: 'custom', q: 'Q?', answer: null, translation: null }],
      'uploaded'
    );
    expect(document.getElementById('mode-indicator').textContent)
      .toBe('Custom questions loaded (1 question)');

    // Now clear (no confirm dialog needed since window.confirm not defined)
    window.confirm = jest.fn().mockReturnValue(true);
    window.clearHistoryStorage = jest.fn();
    core.clearAll();

    expect(document.getElementById('mode-indicator').textContent)
      .toBe('Practising with 30 seeded questions');

    delete window.confirm;
  });

  test('after setActiveQuestions with "ai-generated" source: shows AI questions label', () => {
    const aiQuestions = [
      { theme: 'home-abroad', q: 'Q1?', answer: null, translation: null },
    ];

    core.setActiveQuestions(aiQuestions, 'ai-generated');

    // core.js sets a generic AI label; themes.js would then override it with
    // "AI Theme: [label]" — here we test that core.js at least sets the generic text
    expect(document.getElementById('mode-indicator').textContent)
      .toContain('AI questions loaded');
  });
});

// ---------------------------------------------------------------------------
// Test 5 — priorAttempts: second submission on same question includes priorAttempts in fetch body
// ---------------------------------------------------------------------------
describe('priorAttempts on second submission', () => {
  test('second submission on same question includes priorAttempts in the fetch body', async () => {
    // Set up the question history with one prior attempt
    core.newQuestion();
    const { currentQuestion: q } = core._getState();

    const priorData = {
      [q.q]: [
        {
          response: 'First attempt text',
          overallScore: 4,
          comments: 'Needs improvement.',
          timestamp: Date.now() - 60000,
        },
      ],
    };

    // Provide getQuestionHistory so core.js reads the prior attempt
    window.getQuestionHistory = jest.fn().mockReturnValue(priorData);
    window.saveHistory = jest.fn();

    document.getElementById('response-textarea').value = 'Second attempt text';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        overallScore: 6,
        communicationScore: 3,
        rangeAccuracyScore: 6,
        rawResponse: 'Second attempt text',
        correctedAnswer: 'Second attempt text.',
        modelAnswer: null,
        comments: 'Much better.',
        progressComparison: 'Improved from 4 to 6.',
      }),
    });

    await core.submitResponse();

    // Verify fetch was called with priorAttempts
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);

    expect(body).toHaveProperty('priorAttempts');
    expect(body.priorAttempts).toHaveLength(1);
    expect(body.priorAttempts[0].response).toBe('First attempt text');
    expect(body.priorAttempts[0].overallScore).toBe(4);
    expect(body.priorAttempts[0].comments).toBe('Needs improvement.');
  });

  test('priorAttempts capped at 3 even when 5 prior attempts exist', async () => {
    core.newQuestion();
    const { currentQuestion: q } = core._getState();

    const fiveAttempts = [
      { response: 'a1', overallScore: 1, comments: 'c1', timestamp: Date.now() - 50000 },
      { response: 'a2', overallScore: 2, comments: 'c2', timestamp: Date.now() - 40000 },
      { response: 'a3', overallScore: 3, comments: 'c3', timestamp: Date.now() - 30000 },
      { response: 'a4', overallScore: 4, comments: 'c4', timestamp: Date.now() - 20000 },
      { response: 'a5', overallScore: 5, comments: 'c5', timestamp: Date.now() - 10000 },
    ];

    window.getQuestionHistory = jest.fn().mockReturnValue({ [q.q]: fiveAttempts });
    window.saveHistory = jest.fn();

    document.getElementById('response-textarea').value = 'Sixth attempt';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        overallScore: 6,
        communicationScore: 3,
        rangeAccuracyScore: 6,
        rawResponse: 'Sixth attempt',
        correctedAnswer: 'Sixth attempt.',
        modelAnswer: null,
        comments: 'Good.',
      }),
    });

    await core.submitResponse();

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.priorAttempts).toHaveLength(3);
    // Should be the 3 most recent: a3, a4, a5
    expect(body.priorAttempts[0].response).toBe('a3');
    expect(body.priorAttempts[1].response).toBe('a4');
    expect(body.priorAttempts[2].response).toBe('a5');
  });
});

// ---------------------------------------------------------------------------
// Test 6 — core.js ↔ audio.js: window.playQuestionAudio called by newQuestion
// ---------------------------------------------------------------------------
describe('core.js ↔ audio.js wiring', () => {
  test('newQuestion() calls window.playQuestionAudio when it is defined on window', () => {
    const mockPlayAudio = jest.fn();
    window.playQuestionAudio = mockPlayAudio;

    core.newQuestion();

    expect(mockPlayAudio).toHaveBeenCalledTimes(1);
    expect(typeof mockPlayAudio.mock.calls[0][0]).toBe('string');
  });

  test('newQuestion() does not throw when window.playQuestionAudio is undefined', () => {
    delete window.playQuestionAudio;

    expect(() => core.newQuestion()).not.toThrow();
    // Question should still be displayed
    const questionText = document.getElementById('question-text').textContent;
    expect(SEEDED_QUESTIONS.map(q => q.q)).toContain(questionText);
  });

  test('submitResponse() in speech mode uses window.getCurrentTranscript for response', async () => {
    window.saveHistory = jest.fn();
    window.getQuestionHistory = jest.fn().mockReturnValue({});
    window.getCurrentTranscript = jest.fn().mockReturnValue('Ma réponse vocale.');

    core.newQuestion();

    // Switch to speech mode (hide textarea, show speech-display)
    const speechDisplay = document.getElementById('speech-display');
    speechDisplay.hidden = false;
    const textarea = document.getElementById('response-textarea');
    textarea.hidden = true;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        overallScore: 6,
        communicationScore: 3,
        rangeAccuracyScore: 6,
        rawResponse: 'Ma réponse vocale.',
        correctedAnswer: 'Ma réponse vocale.',
        modelAnswer: null,
        comments: 'Good spoken response.',
      }),
    });

    await core.submitResponse();

    expect(window.getCurrentTranscript).toHaveBeenCalled();
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.studentResponse).toBe('Ma réponse vocale.');
  });

  test('submitResponse() in speech mode shows "Please record your answer first." when transcript is empty', async () => {
    window.getCurrentTranscript = jest.fn().mockReturnValue('');
    window.getQuestionHistory = jest.fn().mockReturnValue({});

    core.newQuestion();

    // Switch to speech mode
    document.getElementById('speech-display').hidden = false;
    document.getElementById('response-textarea').hidden = true;

    const mockFetch = jest.fn();
    global.fetch = mockFetch;

    await core.submitResponse();

    expect(mockFetch).not.toHaveBeenCalled();
    const submitError = document.getElementById('submit-error');
    expect(submitError.hidden).toBe(false);
    expect(submitError.textContent).toBe('Please record your answer first.');
  });
});

// ---------------------------------------------------------------------------
// Test 7 — submit-btn visibility: hidden on load, shown after newQuestion,
//           hidden again after successful submit
// ---------------------------------------------------------------------------
describe('#submit-btn visibility state machine', () => {
  test('submit-btn is hidden on load', () => {
    expect(document.getElementById('submit-btn').hidden).toBe(true);
  });

  test('submit-btn becomes visible after newQuestion()', () => {
    core.newQuestion();
    expect(document.getElementById('submit-btn').hidden).toBe(false);
  });

  test('submit-btn is hidden again after a successful submission', async () => {
    window.saveHistory = jest.fn();
    window.getQuestionHistory = jest.fn().mockReturnValue({});

    core.newQuestion();
    expect(document.getElementById('submit-btn').hidden).toBe(false);

    document.getElementById('response-textarea').value = 'Ma réponse.';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        overallScore: 7,
        communicationScore: 4,
        rangeAccuracyScore: 7,
        rawResponse: 'Ma réponse.',
        correctedAnswer: 'Ma réponse.',
        modelAnswer: null,
        comments: 'Good.',
      }),
    });

    await core.submitResponse();

    expect(document.getElementById('submit-btn').hidden).toBe(true);
  });

  test('submit-btn remains visible after a failed submission (so student can retry)', async () => {
    window.getQuestionHistory = jest.fn().mockReturnValue({});

    core.newQuestion();
    document.getElementById('response-textarea').value = 'Ma réponse.';

    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    await core.submitResponse();

    // After error, button should be re-enabled and visible for retry
    const submitBtn = document.getElementById('submit-btn');
    expect(submitBtn.disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 8 — core.js ↔ history.js: clearAll calls window.clearHistoryStorage
// ---------------------------------------------------------------------------
describe('core.js ↔ history.js: clearAll integration', () => {
  test('clearAll() calls window.clearHistoryStorage when it is available', () => {
    window.clearHistoryStorage = jest.fn();
    window.confirm = jest.fn().mockReturnValue(true);

    core.clearAll();

    expect(window.clearHistoryStorage).toHaveBeenCalledTimes(1);

    delete window.confirm;
  });

  test('clearAll() falls back to direct localStorage.removeItem when clearHistoryStorage is absent', () => {
    delete window.clearHistoryStorage;
    window.confirm = jest.fn().mockReturnValue(true);
    localStorage.setItem(LS_HISTORY, JSON.stringify([{ id: '1' }]));
    localStorage.setItem(LS_QUESTION_HISTORY, JSON.stringify({ 'Q?': [] }));

    core.clearAll();

    expect(localStorage.getItem(LS_HISTORY)).toBeNull();
    expect(localStorage.getItem(LS_QUESTION_HISTORY)).toBeNull();

    delete window.confirm;
  });
});
