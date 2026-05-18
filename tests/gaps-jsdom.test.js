/**
 * @jest-environment jsdom
 *
 * gaps-jsdom.test.js — D3: Gap Analysis Tests (jsdom environment)
 *
 * Contains tests that need DOM access (localStorage, document, window):
 *   - TTL exact boundary pruning (Gap 3–4)
 *   - Corrupted localStorage fallback (Gap 5)
 *   - Evaluate error preserves question + response + feedback hidden (Gaps 6–8)
 *   - Excel no-header row parsing (Gap 9)
 *   - setMode speech→text with no transcript preserves textarea (Gap 10)
 */

'use strict';

// ---------------------------------------------------------------------------
// Shared TTL constants (matching history.js)
// ---------------------------------------------------------------------------
const LS_HISTORY_GAP = 'frenchie_history';
const LS_Q_HISTORY_GAP = 'frenchie_questionHistory';
const TTL_MS_GAP = 48 * 60 * 60 * 1000; // 48 hours in ms

// ---------------------------------------------------------------------------
// Inlined loadHistory logic (mirrors history.js exactly)
// ---------------------------------------------------------------------------
function loadHistoryGap() {
  let arr = [];
  try {
    arr = JSON.parse(localStorage.getItem(LS_HISTORY_GAP) || '[]');
  } catch (_) {
    return [];
  }
  if (!Array.isArray(arr) || arr.length === 0) return [];

  const sorted = [...arr].sort((a, b) => b.timestamp - a.timestamp);
  const newest = sorted[0];

  if (Date.now() - newest.timestamp > TTL_MS_GAP) {
    localStorage.removeItem(LS_HISTORY_GAP);
    localStorage.removeItem(LS_Q_HISTORY_GAP);
    return [];
  }

  const pruned = arr.filter(e => Date.now() - e.timestamp <= TTL_MS_GAP);
  if (pruned.length !== arr.length) {
    localStorage.setItem(LS_HISTORY_GAP, JSON.stringify(pruned));
  }
  return pruned;
}

// ---------------------------------------------------------------------------
// Helper to build a minimal history entry
// ---------------------------------------------------------------------------
function makeGapEntry(overrides = {}) {
  return {
    id: 'gap-uuid-' + Math.random(),
    question: 'Décris-moi ta maison.',
    userResponse: "J'habite dans une grande maison.",
    overallScore: 5,
    communicationScore: 3,
    rangeAccuracyScore: 5,
    correctedAnswer: "J'habite dans une grande maison.",
    modelAnswer: null,
    comments: 'Good attempt.',
    progressComparison: null,
    timestamp: Date.now(),
    source: 'seeded',
    theme: 'home-abroad',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Gap 3: TTL exact boundary — entry at TTL_MS + 1 ms is pruned
// ---------------------------------------------------------------------------
describe('loadHistory() — exact 48h TTL boundary', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('prunes an entry timestamped exactly TTL_MS + 1 ms ago', () => {
    const oldTs = Date.now() - (TTL_MS_GAP + 1);
    const freshTs = Date.now() - 1000;

    const staleEntry = makeGapEntry({ id: 'stale', timestamp: oldTs });
    const freshEntry = makeGapEntry({ id: 'fresh', timestamp: freshTs });

    // freshEntry is the newest — full wipe NOT triggered, only staleEntry pruned
    localStorage.setItem(LS_HISTORY_GAP, JSON.stringify([staleEntry, freshEntry]));

    const result = loadHistoryGap();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('fresh');
  });

  it('does NOT prune an entry timestamped exactly TTL_MS ms ago (still within TTL)', () => {
    // (Date.now() - timestamp) === TTL_MS which is NOT > TTL_MS → retained
    const boundaryTs = Date.now() - TTL_MS_GAP;
    const entry = makeGapEntry({ id: 'boundary', timestamp: boundaryTs });

    localStorage.setItem(LS_HISTORY_GAP, JSON.stringify([entry]));

    const result = loadHistoryGap();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('boundary');
  });
});

// ---------------------------------------------------------------------------
// Gap 4: loadHistory with corrupted localStorage
// ---------------------------------------------------------------------------
describe('loadHistory() — corrupted localStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns [] when frenchie_history contains invalid JSON', () => {
    localStorage.setItem(LS_HISTORY_GAP, 'not-valid-json{{{');
    const result = loadHistoryGap();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Gap 5–7: evaluate error does NOT wipe question/response/feedback
// ---------------------------------------------------------------------------
function buildCoreDOM() {
  document.body.innerHTML = `
    <span id="mode-indicator">Practising with 30 seeded questions</span>
    <button id="history-toggle-btn">History</button>
    <p id="question-text">Press "New Question" to begin.</p>
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

// Inject data globals that core.js expects
global.SEEDED_QUESTIONS = [
  { theme: 'home-abroad', q: 'Décris-moi la ville où tu habites.', answer: "J'habite à Londres.", translation: 'I live in London.' },
  { theme: 'personal-life', q: 'Parle-moi de ta famille.', answer: "J'ai une grande famille.", translation: 'I have a big family.' },
];
global.activeQuestions = [...global.SEEDED_QUESTIONS];
global.activeSource = 'seeded';
global.LS_HISTORY = 'frenchie_history';
global.LS_QUESTION_HISTORY = 'frenchie_questionHistory';
global.TTL_MS = 48 * 60 * 60 * 1000;

// Load core.js once for this file
const core = require('../frontend/core.js');

describe('evaluate error — question and response preserved', () => {
  beforeEach(() => {
    buildCoreDOM();
    global.activeQuestions = [...global.SEEDED_QUESTIONS];
    global.activeSource = 'seeded';
    localStorage.clear();
    global.fetch = undefined;
    delete window.playQuestionAudio;
    delete window.getCurrentTranscript;
    delete window.saveHistory;
    delete window.getQuestionHistory;
  });

  it('does NOT clear #question-text when evaluate API returns HTTP 502', async () => {
    window.getQuestionHistory = jest.fn().mockReturnValue({});
    core.newQuestion();

    const questionBefore = document.getElementById('question-text').textContent;
    document.getElementById('response-textarea').value = 'Ma réponse.';

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => ({ error: 'Evaluation failed', detail: 'Claude unreachable' }),
    });

    await core.submitResponse();

    // Question must remain unchanged after API error
    expect(document.getElementById('question-text').textContent).toBe(questionBefore);
  });

  it('does NOT clear #response-textarea when evaluate returns a network error', async () => {
    window.getQuestionHistory = jest.fn().mockReturnValue({});
    core.newQuestion();
    document.getElementById('response-textarea').value = 'Je vais à Paris.';

    global.fetch = jest.fn().mockRejectedValue(new Error('Network failure'));

    await core.submitResponse();

    // Textarea must still contain the student response so they can retry
    expect(document.getElementById('response-textarea').value).toBe('Je vais à Paris.');
  });

  it('keeps #feedback-panel hidden when evaluate API returns an error', async () => {
    window.getQuestionHistory = jest.fn().mockReturnValue({});
    core.newQuestion();
    document.getElementById('response-textarea').value = 'Ma réponse.';

    global.fetch = jest.fn().mockRejectedValue(new Error('Timeout'));

    await core.submitResponse();

    expect(document.getElementById('feedback-panel').hidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Gap 8: Excel — file with no English header row (all rows are French data)
// ---------------------------------------------------------------------------
const XLSX_MOCK_GAP = {
  read: jest.fn(),
  utils: { sheet_to_json: jest.fn() },
};
global.XLSX = XLSX_MOCK_GAP;
window.setActiveQuestions = jest.fn();
window.SEEDED_QUESTIONS = global.SEEDED_QUESTIONS;

describe('Excel — no header row (first cell is French, no rows skipped)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.setActiveQuestions = jest.fn();

    document.body.innerHTML = `
      <span id="mode-indicator">Practising with 30 seeded questions</span>
      <div id="excel-upload-zone">
        <input type="file" id="excel-file-input" accept=".xlsx,.xls" />
      </div>
      <p id="excel-error" style="display:none;"></p>
      <div id="return-to-default-container" style="display:none;">
        <a href="#" id="return-to-default-link">Return to default questions</a>
      </div>
    `;
  });

  it('parses all rows when first cell is French (header detection skips nothing)', async () => {
    XLSX_MOCK_GAP.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    });

    // First row is genuine French — looksLikeFrench returns true → no skip
    XLSX_MOCK_GAP.utils.sheet_to_json.mockReturnValue([
      ['Où habites-tu?', "J'habite à Paris."],
      ['Quel âge as-tu?', "J'ai seize ans."],
      ['Décris ta famille.', "J'ai une grande famille."],
    ]);

    const { parseAndLoad } = require('../frontend/excel.js');
    await parseAndLoad(new ArrayBuffer(8), 'questions.xlsx');

    expect(window.setActiveQuestions).toHaveBeenCalledTimes(1);
    const [questions] = window.setActiveQuestions.mock.calls[0];

    // All 3 rows parsed — none skipped as a header
    expect(questions).toHaveLength(3);
    expect(questions[0].q).toBe('Où habites-tu?');
    expect(questions[1].q).toBe('Quel âge as-tu?');
    expect(questions[2].q).toBe('Décris ta famille.');
  });
});

// ---------------------------------------------------------------------------
// Gap 9: setMode speech → text with empty transcript preserves textarea content
//
// When a student typed something in text mode, switched to speech mode without
// recording, then switches back — their typed text must NOT be wiped.
// (The only copy-to-textarea that occurs is when transcript is non-empty.)
// ---------------------------------------------------------------------------
describe('setMode() — speech → text with empty transcript preserves textarea', () => {
  beforeEach(() => {
    buildCoreDOM();
    global.activeQuestions = [...global.SEEDED_QUESTIONS];
  });

  it('does NOT wipe previously typed text when switching speech→text with no transcript', () => {
    // Student typed a response in text mode
    document.getElementById('response-textarea').value = 'Je vais à Paris en été.';

    // Now switches to speech mode (no recording happens, transcript stays empty)
    document.getElementById('speech-transcript-text').textContent = '';
    core.setMode('speech');

    // Student changes their mind and switches back to text mode
    core.setMode('text');

    // Their previously typed text must still be there (not wiped by empty transcript)
    expect(document.getElementById('response-textarea').value).toBe('Je vais à Paris en été.');
  });
});
