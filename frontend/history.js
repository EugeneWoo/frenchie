'use strict';

// ---------------------------------------------------------------------------
// history.js — C5: History persistence and slide-out panel
// Depends on: data.js (LS_HISTORY, LS_QUESTION_HISTORY, TTL_MS)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------
let _questionHistory = {}; // loaded on page load; kept in sync on each save

// ---------------------------------------------------------------------------
// localStorage: save
// ---------------------------------------------------------------------------

/**
 * Append a HistoryEntry to frenchie_history in localStorage.
 * Also records a lightweight entry in frenchie_questionHistory keyed by question.
 * NOTE: includes `comments` in the question-history record so core.js can
 * populate priorAttempts.comments when building the evaluate payload.
 *
 * @param {import('./data.js').HistoryEntry} entry
 */
window.saveHistory = function saveHistory(entry) {
  // --- frenchie_history ---
  let arr = [];
  try {
    arr = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
    if (!Array.isArray(arr)) arr = [];
  } catch (e) {
    console.error('history.js saveHistory: failed to read LS_HISTORY', e);
    arr = [];
  }
  arr.push(entry);
  try {
    localStorage.setItem(LS_HISTORY, JSON.stringify(arr));
  } catch (e) {
    console.error('history.js saveHistory: failed to write LS_HISTORY', e);
    return; // cannot persist — bail out before writing question history too
  }

  // --- frenchie_questionHistory ---
  // Store comments so core.js can include them in priorAttempts payloads
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
    _questionHistory = qh;
  } catch (e) {
    console.error('history.js saveHistory: failed to update LS_QUESTION_HISTORY', e);
  }
};

// ---------------------------------------------------------------------------
// localStorage: load
// ---------------------------------------------------------------------------

/**
 * Load frenchie_history from localStorage.
 * Runs TTL check:
 *   - If the most recent entry is older than 48h: wipe both keys, return [].
 *   - Otherwise: prune individual stale entries and return remaining entries.
 *
 * @returns {import('./data.js').HistoryEntry[]}
 */
function loadHistory() {
  let arr = [];
  try {
    arr = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
    if (!Array.isArray(arr)) arr = [];
  } catch (_) {
    return [];
  }

  if (arr.length === 0) return [];

  // Find the most recent entry
  const sorted = [...arr].sort((a, b) => b.timestamp - a.timestamp);
  const newest = sorted[0];

  // Full wipe when newest entry has expired
  if (Date.now() - newest.timestamp > TTL_MS) {
    localStorage.removeItem(LS_HISTORY);
    localStorage.removeItem(LS_QUESTION_HISTORY);
    _questionHistory = {};
    return [];
  }

  // Per-entry prune
  const pruned = arr.filter(e => Date.now() - e.timestamp <= TTL_MS);
  if (pruned.length !== arr.length) {
    localStorage.setItem(LS_HISTORY, JSON.stringify(pruned));
  }
  return pruned;
}

/**
 * Load frenchie_questionHistory from localStorage.
 * @returns {import('./data.js').QuestionHistoryMap}
 */
function loadQuestionHistory() {
  try {
    const raw = localStorage.getItem(LS_QUESTION_HISTORY);
    const parsed = JSON.parse(raw || '{}');
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (_) {
    return {};
  }
}

/**
 * Returns the currently loaded question history map.
 * Used by core.js to look up priorAttempts before calling /api/evaluate.
 *
 * @returns {import('./data.js').QuestionHistoryMap}
 */
window.getQuestionHistory = function getQuestionHistory() {
  return _questionHistory;
};

/**
 * Clear both localStorage keys immediately (no TTL logic).
 * Called by the Clear button in core.js.
 */
window.clearHistoryStorage = function clearHistoryStorage() {
  localStorage.removeItem(LS_HISTORY);
  localStorage.removeItem(LS_QUESTION_HISTORY);
  _questionHistory = {};
};

// ---------------------------------------------------------------------------
// Panel open/close
// ---------------------------------------------------------------------------

function openHistoryPanel() {
  const panel = document.getElementById('history-panel');
  const overlay = document.getElementById('history-overlay');
  if (!panel || !overlay) return;

  renderHistoryEntries();

  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  overlay.classList.add('visible');
  // For index.html where overlay uses hidden attribute, also remove it
  overlay.removeAttribute('hidden');
  overlay.style.display = 'block';
}

function closeHistoryPanel() {
  const panel = document.getElementById('history-panel');
  const overlay = document.getElementById('history-overlay');
  if (!panel || !overlay) return;

  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  overlay.classList.remove('visible');
  overlay.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Entry rendering
// ---------------------------------------------------------------------------

/**
 * Determine the CSS band class for an overall score.
 * 0–3 → band-low, 4–6 → band-mid, 7–9 → band-high
 *
 * @param {number} score
 * @returns {string}
 */
function bandClass(score) {
  if (score >= 7) return 'band-high';
  if (score >= 4) return 'band-mid';
  return 'band-low';
}

/**
 * Build the delta badge HTML for a history entry, comparing against the
 * immediately prior attempt for the same question in frenchie_questionHistory.
 *
 * @param {import('./data.js').HistoryEntry} entry
 * @param {import('./data.js').QuestionHistoryMap} qh
 * @returns {string} HTML string (empty if no prior attempt or no change)
 */
function buildDeltaBadge(entry, qh) {
  const attempts = qh[entry.question];
  if (!Array.isArray(attempts) || attempts.length < 2) return '';

  const idx = attempts.findIndex(a => a.timestamp === entry.timestamp);
  if (idx <= 0) return ''; // first attempt or not found

  const prior = attempts[idx - 1];
  const delta = entry.overallScore - prior.overallScore;
  if (delta === 0) return '';

  const sign = delta > 0 ? '+' : '';
  const cls = delta > 0 ? 'delta-up' : 'delta-down';
  return `<span class="delta-badge ${cls}">${sign}${delta}</span>`;
}

/**
 * Render all history entries into #history-list, sorted most-recent-first.
 * Reads directly from localStorage on each call (so the panel always shows
 * fresh data when opened).
 */
function renderHistoryEntries() {
  const historyList = document.getElementById('history-list');
  if (!historyList) return;

  let arr = [];
  try {
    arr = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
    if (!Array.isArray(arr)) arr = [];
  } catch (_) {
    arr = [];
  }

  let qh = {};
  try {
    qh = JSON.parse(localStorage.getItem(LS_QUESTION_HISTORY) || '{}') || {};
  } catch (_) {
    qh = {};
  }

  const sorted = [...arr].sort((a, b) => b.timestamp - a.timestamp);

  if (sorted.length === 0) {
    historyList.innerHTML = '<p class="history-empty">No practice history yet.</p>';
    return;
  }

  historyList.innerHTML = sorted.map(entry => {
    const truncQuestion = (entry.question || '').length > 80
      ? (entry.question || '').slice(0, 80) + '…'
      : (entry.question || '');

    const truncResponse = (entry.userResponse || '').length > 100
      ? entry.userResponse.slice(0, 100) + '…'
      : (entry.userResponse || '');

    const truncComments = (entry.comments || '').length > 100
      ? entry.comments.slice(0, 100) + '…'
      : (entry.comments || '');

    const badge = bandClass(entry.overallScore);
    const delta = buildDeltaBadge(entry, qh);
    const ts = new Date(entry.timestamp).toLocaleString();

    // Build expand toggle for full comments when truncated
    const hasFullComments = (entry.comments || '').length > 100;
    const commentsHtml = hasFullComments
      ? `<p class="history-comments">${truncComments} <button class="btn-expand" type="button" aria-expanded="false" data-full="${encodeURIComponent(entry.comments)}">Show more</button></p>`
      : `<p class="history-comments">${truncComments}</p>`;

    return `
<div class="history-entry" data-id="${entry.id}">
  <div class="history-entry-header">
    <span class="score-badge ${badge}">${entry.overallScore}</span>
    ${delta}
    <span class="history-timestamp">${ts}</span>
  </div>
  <p class="history-question">${truncQuestion}</p>
  <p class="history-response"><em>${truncResponse}</em></p>
  ${commentsHtml}
</div>`.trim();
  }).join('\n');

  // Wire up expand toggles
  function handleExpandClick() {
    const expanded = this.getAttribute('aria-expanded') === 'true';
    const full = decodeURIComponent(this.getAttribute('data-full'));
    if (expanded) {
      this.previousSibling.textContent = full.slice(0, 100) + '… ';
      this.textContent = 'Show more';
      this.setAttribute('aria-expanded', 'false');
    } else {
      // Replace the text node preceding the button with the full text
      const parent = this.parentNode;
      parent.innerHTML = full + ' <button class="btn-expand" type="button" aria-expanded="true" data-full="' + encodeURIComponent(full) + '">Show less</button>';
      parent.querySelector('.btn-expand').addEventListener('click', handleExpandClick);
    }
  }
  historyList.querySelectorAll('.btn-expand').forEach(btn => {
    btn.addEventListener('click', handleExpandClick);
  });
}

// ---------------------------------------------------------------------------
// DOMContentLoaded — inject overlay (if not present), wire events, run TTL
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function () {
  // Ensure overlay exists (index.html already has it, but guard anyway)
  let overlay = document.getElementById('history-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'history-overlay';
    overlay.style.display = 'none';
    document.body.appendChild(overlay);
  }

  // Wire toggle button
  const toggleBtn = document.getElementById('history-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', openHistoryPanel);
  }

  // Wire close button (inside panel)
  const closeBtn = document.getElementById('history-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeHistoryPanel);
  }

  // Wire overlay click → close
  overlay.addEventListener('click', closeHistoryPanel);

  // Run TTL prune on page load
  _questionHistory = loadQuestionHistory();
  loadHistory(); // side-effect: prunes stale entries and updates localStorage

  // Listen for frenchie:cleared event (dispatched by core.js clearAll())
  // Re-render the panel so it shows the empty state immediately
  document.addEventListener('frenchie:cleared', function () {
    // Re-render if the panel is currently open
    const panel = document.getElementById('history-panel');
    if (panel && panel.classList.contains('open')) {
      renderHistoryEntries();
    }
  });

  // Listen for frenchie:evaluated event as a secondary refresh path.
  // core.js calls window.saveHistory() directly; this listener only refreshes
  // the panel if it happens to be open when a submission completes.
  document.addEventListener('frenchie:evaluated', function () {
    const panel = document.getElementById('history-panel');
    if (panel && panel.classList.contains('open')) {
      renderHistoryEntries();
    }
  });
});
