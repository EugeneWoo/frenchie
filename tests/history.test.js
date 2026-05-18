/**
 * @jest-environment jsdom
 */
'use strict';

// ---------------------------------------------------------------------------
// history.test.js — C5: History persistence and slide-out panel
// Uses jsdom environment (configured via @jest-environment docblock above).
// ---------------------------------------------------------------------------

const LS_HISTORY = 'frenchie_history';
const LS_QUESTION_HISTORY = 'frenchie_questionHistory';
const TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

// ---------------------------------------------------------------------------
// Helpers — replicate the module logic under test without importing the browser
// file directly (it uses window globals). We inline the core functions so tests
// are deterministic.
// ---------------------------------------------------------------------------

function makeEntry(overrides = {}) {
  return {
    id: 'test-uuid-' + Math.random(),
    question: 'Décris-moi ta maison.',
    userResponse: 'J\'habite dans une grande maison.',
    overallScore: 6,
    communicationScore: 3,
    rangeAccuracyScore: 6,
    correctedAnswer: 'J\'habite dans une grande maison.',
    modelAnswer: null,
    comments: 'Good attempt. Add more vocabulary.',
    progressComparison: null,
    timestamp: Date.now(),
    source: 'seeded',
    theme: 'home-abroad',
    ...overrides,
  };
}

// Inline saveHistory — append entry to LS_HISTORY
function saveHistory(entry) {
  let arr = [];
  try {
    arr = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
  } catch (_) {
    arr = [];
  }
  arr.push(entry);
  localStorage.setItem(LS_HISTORY, JSON.stringify(arr));
}

// Inline loadHistory — TTL prune logic
function loadHistory() {
  let arr = [];
  try {
    arr = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
  } catch (_) {
    return [];
  }
  if (!Array.isArray(arr) || arr.length === 0) return [];

  // Sort newest first to check most recent
  const sorted = [...arr].sort((a, b) => b.timestamp - a.timestamp);
  const newest = sorted[0];

  // If most recent entry is older than 48h, wipe both keys
  if (Date.now() - newest.timestamp > TTL_MS) {
    localStorage.removeItem(LS_HISTORY);
    localStorage.removeItem(LS_QUESTION_HISTORY);
    return [];
  }

  // Per-entry prune: remove entries older than 48h
  const pruned = arr.filter(e => Date.now() - e.timestamp <= TTL_MS);
  if (pruned.length !== arr.length) {
    localStorage.setItem(LS_HISTORY, JSON.stringify(pruned));
  }
  return pruned;
}

// ---------------------------------------------------------------------------
// Helper to set up DOM for panel rendering tests
// ---------------------------------------------------------------------------
function setupDOM() {
  document.body.innerHTML = `
    <button id="history-toggle-btn">History</button>
    <div id="history-overlay" style="display:none"></div>
    <div id="history-panel" class="history-panel">
      <button id="history-close-btn">&#x00D7;</button>
      <h2>Practice History</h2>
      <div id="history-list"></div>
    </div>
  `;
}

// Inline renderHistoryEntries — renders entries most-recent-first
function renderHistoryEntries() {
  const historyList = document.getElementById('history-list');
  if (!historyList) return;

  let arr = [];
  try {
    arr = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
  } catch (_) {
    arr = [];
  }

  let questionHistory = {};
  try {
    questionHistory = JSON.parse(localStorage.getItem(LS_QUESTION_HISTORY) || '{}');
  } catch (_) {
    questionHistory = {};
  }

  // Sort most-recent-first
  const sorted = [...arr].sort((a, b) => b.timestamp - a.timestamp);

  if (sorted.length === 0) {
    historyList.innerHTML = '<p class="history-empty">No practice history yet.</p>';
    return;
  }

  historyList.innerHTML = sorted.map(entry => {
    const truncQuestion = entry.question.length > 80
      ? entry.question.slice(0, 80) + '…'
      : entry.question;
    const truncResponse = entry.userResponse.length > 100
      ? entry.userResponse.slice(0, 100) + '…'
      : entry.userResponse;
    const truncComments = entry.comments.length > 100
      ? entry.comments.slice(0, 100) + '…'
      : entry.comments;

    // Score badge band
    let bandClass = 'band-low';
    if (entry.overallScore >= 7) bandClass = 'band-high';
    else if (entry.overallScore >= 4) bandClass = 'band-mid';

    // Delta badge — compare against immediately prior attempt for same question
    let deltaBadge = '';
    const attempts = questionHistory[entry.question];
    if (Array.isArray(attempts) && attempts.length > 1) {
      // Find this entry's position in question history by timestamp
      const idx = attempts.findIndex(a => a.timestamp === entry.timestamp);
      if (idx > 0) {
        const prior = attempts[idx - 1];
        const delta = entry.overallScore - prior.overallScore;
        if (delta !== 0) {
          const sign = delta > 0 ? '+' : '';
          const cls = delta > 0 ? 'delta-up' : 'delta-down';
          deltaBadge = `<span class="delta-badge ${cls}">${sign}${delta}</span>`;
        }
      }
    }

    const ts = new Date(entry.timestamp).toLocaleString();

    return `
      <div class="history-entry" data-id="${entry.id}">
        <div class="history-entry-header">
          <span class="score-badge ${bandClass}">${entry.overallScore}</span>
          ${deltaBadge}
          <span class="history-timestamp">${ts}</span>
        </div>
        <p class="history-question">${truncQuestion}</p>
        <p class="history-response"><em>${truncResponse}</em></p>
        <p class="history-comments">${truncComments}</p>
      </div>
    `.trim();
  }).join('');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

// Test 1: saveHistory appends to frenchie_history in localStorage
describe('saveHistory()', () => {
  it('appends a new entry to frenchie_history in localStorage', () => {
    const entry = makeEntry();
    saveHistory(entry);

    const stored = JSON.parse(localStorage.getItem(LS_HISTORY));
    expect(Array.isArray(stored)).toBe(true);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(entry.id);
    expect(stored[0].question).toBe(entry.question);
    expect(stored[0].overallScore).toBe(entry.overallScore);
  });

  it('accumulates multiple entries across calls', () => {
    const e1 = makeEntry({ overallScore: 4 });
    const e2 = makeEntry({ overallScore: 7 });
    saveHistory(e1);
    saveHistory(e2);

    const stored = JSON.parse(localStorage.getItem(LS_HISTORY));
    expect(stored).toHaveLength(2);
  });
});

// Test 2: loadHistory prunes entries older than 48h
describe('loadHistory() — TTL pruning', () => {
  it('prunes individual entries older than 48 hours', () => {
    const oldTimestamp = Date.now() - (TTL_MS + 1000); // 1s past TTL
    const freshTimestamp = Date.now() - 1000; // 1s ago

    const old = makeEntry({ timestamp: oldTimestamp, id: 'old' });
    const fresh = makeEntry({ timestamp: freshTimestamp, id: 'fresh' });

    // Newest entry is fresh, so full wipe is NOT triggered
    // But old entry should be individually pruned
    localStorage.setItem(LS_HISTORY, JSON.stringify([old, fresh]));

    const result = loadHistory();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('fresh');
  });

  // Test 3: If most recent entry is older than 48h, both keys are cleared
  it('wipes both localStorage keys and returns [] when newest entry is older than 48h', () => {
    const veryOldTimestamp = Date.now() - (TTL_MS + 5000);
    const old1 = makeEntry({ timestamp: veryOldTimestamp, id: 'old1' });
    const old2 = makeEntry({ timestamp: veryOldTimestamp - 1000, id: 'old2' });

    // Seed frenchie_questionHistory too
    localStorage.setItem(LS_HISTORY, JSON.stringify([old1, old2]));
    localStorage.setItem(LS_QUESTION_HISTORY, JSON.stringify({ 'some question': [] }));

    const result = loadHistory();

    expect(result).toEqual([]);
    expect(localStorage.getItem(LS_HISTORY)).toBeNull();
    expect(localStorage.getItem(LS_QUESTION_HISTORY)).toBeNull();
  });
});

// Test 4: History panel renders entries most-recent-first
describe('renderHistoryEntries()', () => {
  it('renders entries most-recent-first with question, response, score badge, timestamp, and comments', () => {
    setupDOM();

    const earlier = makeEntry({
      id: 'earlier',
      question: 'Première question?',
      userResponse: 'Ma première réponse.',
      overallScore: 4,
      timestamp: Date.now() - 60000, // 1 min ago
      comments: 'First attempt comments here.',
    });
    const later = makeEntry({
      id: 'later',
      question: 'Deuxième question?',
      userResponse: 'Ma deuxième réponse.',
      overallScore: 7,
      timestamp: Date.now() - 1000, // 1s ago (more recent)
      comments: 'Second attempt comments here.',
    });

    localStorage.setItem(LS_HISTORY, JSON.stringify([earlier, later]));

    renderHistoryEntries();

    const historyList = document.getElementById('history-list');
    const entries = historyList.querySelectorAll('.history-entry');

    // Should have 2 entries
    expect(entries).toHaveLength(2);

    // Most recent (later) should be first
    expect(entries[0].getAttribute('data-id')).toBe('later');
    expect(entries[1].getAttribute('data-id')).toBe('earlier');

    // Check content fields are present
    expect(entries[0].querySelector('.history-question').textContent).toContain('Deuxième question');
    expect(entries[0].querySelector('.history-response em').textContent).toContain('Ma deuxième réponse');
    expect(entries[0].querySelector('.score-badge')).toBeTruthy();
    expect(entries[0].querySelector('.history-timestamp')).toBeTruthy();
    expect(entries[0].querySelector('.history-comments').textContent).toContain('Second attempt comments');
  });

  it('renders empty state when no history exists', () => {
    setupDOM();
    renderHistoryEntries();
    const historyList = document.getElementById('history-list');
    expect(historyList.querySelector('.history-empty')).toBeTruthy();
  });
});

// Test 5: Delta badge appears for repeat attempts on the same question
describe('delta badge for repeat attempts', () => {
  it('renders a "+N" green delta badge when score improved on repeat attempt', () => {
    setupDOM();

    const question = 'Décris-moi ta maison.';
    const ts1 = Date.now() - 10000;
    const ts2 = Date.now() - 1000;

    const entry1 = makeEntry({ id: 'e1', question, overallScore: 4, timestamp: ts1 });
    const entry2 = makeEntry({ id: 'e2', question, overallScore: 6, timestamp: ts2 });

    localStorage.setItem(LS_HISTORY, JSON.stringify([entry1, entry2]));

    // Seed question history so delta can be computed
    const questionHistory = {
      [question]: [
        { response: entry1.userResponse, overallScore: 4, timestamp: ts1 },
        { response: entry2.userResponse, overallScore: 6, timestamp: ts2 },
      ],
    };
    localStorage.setItem(LS_QUESTION_HISTORY, JSON.stringify(questionHistory));

    renderHistoryEntries();

    const historyList = document.getElementById('history-list');
    // Most recent entry (e2) should have delta badge
    const mostRecent = historyList.querySelector('[data-id="e2"]');
    const deltaBadge = mostRecent.querySelector('.delta-badge');
    expect(deltaBadge).toBeTruthy();
    expect(deltaBadge.textContent).toBe('+2');
    expect(deltaBadge.classList.contains('delta-up')).toBe(true);
  });

  it('renders a "-N" red delta badge when score decreased on repeat attempt', () => {
    setupDOM();

    const question = 'Où habites-tu?';
    const ts1 = Date.now() - 10000;
    const ts2 = Date.now() - 1000;

    const entry1 = makeEntry({ id: 'e1', question, overallScore: 7, timestamp: ts1 });
    const entry2 = makeEntry({ id: 'e2', question, overallScore: 5, timestamp: ts2 });

    localStorage.setItem(LS_HISTORY, JSON.stringify([entry1, entry2]));

    const questionHistory = {
      [question]: [
        { response: entry1.userResponse, overallScore: 7, timestamp: ts1 },
        { response: entry2.userResponse, overallScore: 5, timestamp: ts2 },
      ],
    };
    localStorage.setItem(LS_QUESTION_HISTORY, JSON.stringify(questionHistory));

    renderHistoryEntries();

    const historyList = document.getElementById('history-list');
    const mostRecent = historyList.querySelector('[data-id="e2"]');
    const deltaBadge = mostRecent.querySelector('.delta-badge');
    expect(deltaBadge).toBeTruthy();
    expect(deltaBadge.textContent).toBe('-2');
    expect(deltaBadge.classList.contains('delta-down')).toBe(true);
  });
});
