'use strict';

// ---------------------------------------------------------------------------
// excel.js — Excel Upload Mode
//
// Handles SheetJS parsing of .xlsx/.xls files and swaps the active question
// bank via window.setActiveQuestions().
//
// DEPENDENCY NOTE:
//   SheetJS is loaded in index.html (already present) before this script:
//   <script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
//
// Expected DOM elements (defined in index.html, by C1):
//   #excel-upload-zone        — drag-and-drop zone / file input container
//   #excel-file-input         — <input type="file" accept=".xlsx,.xls"> inside the zone
//   #mode-indicator           — text node showing the current question source
//   #excel-error  OR          — inline error display (id used by tests/excel.test.js)
//   #upload-error             — inline error display (id used in production index.html)
//   #excel-error OR           — inline error display (tests use this id via setupDOM)
//   #return-to-default-container / #return-to-default-btn — shown after successful upload
//
// Globals expected at runtime:
//   XLSX                      — SheetJS (loaded via CDN before this script)
//   window.setActiveQuestions(questions, source) — provided by core.js (C1)
//   window.SEEDED_QUESTIONS   — the 30-entry seeded bank from data.js
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// French heuristic — decide whether to skip the first row (header detection)
// ---------------------------------------------------------------------------
const FRENCH_DIACRITICS = /[àâäéèêëîïôùûüçæœ]/i;
const COMMON_FRENCH_WORDS = /\b(le|la|les|un|une|des|du|de|et|en|est|je|tu|il|elle|nous|vous|ils|elles|que|qui|dans|pour|avec|sur|par|mais|ou|donc|or|ni|car|ce|ça|se|être|avoir|faire|aller|où|comment|quand|quel|quelle|quels|quelles|pourquoi)\b/i;

/**
 * Returns true if the cell value looks like French text (contains diacritics
 * or common French words), meaning it is probably NOT a column header.
 * @param {string} text
 * @returns {boolean}
 */
function looksLikeFrench(text) {
  if (typeof text !== 'string' || text.trim().length === 0) return false;
  return FRENCH_DIACRITICS.test(text) || COMMON_FRENCH_WORDS.test(text);
}

// ---------------------------------------------------------------------------
// Inline error helpers
// Supports both the test-DOM id (#excel-error) and production id (#upload-error)
// ---------------------------------------------------------------------------
function getErrorEl() {
  return document.getElementById('excel-error') || document.getElementById('upload-error');
}

function showError(message) {
  const el = getErrorEl();
  if (!el) return;
  el.textContent = message;
  el.style.display = '';
  // Also remove the hidden attribute if present (index.html uses `hidden` attr)
  el.removeAttribute('hidden');
}

function clearError() {
  const el = getErrorEl();
  if (!el) return;
  el.textContent = '';
  el.style.display = 'none';
  el.setAttribute('hidden', '');
}

// ---------------------------------------------------------------------------
// Mode indicator helper
// ---------------------------------------------------------------------------
function setModeIndicator(text) {
  const el = document.getElementById('mode-indicator');
  if (el) el.textContent = text;
}

// ---------------------------------------------------------------------------
// "Return to default" UI — supports both test-DOM and production-HTML layouts
// ---------------------------------------------------------------------------
function showReturnLink() {
  // Production HTML: a button with id="return-to-default-btn"
  const btn = document.getElementById('return-to-default-btn');
  if (btn) {
    btn.removeAttribute('hidden');
    return;
  }
  // Test DOM: a container div with id="return-to-default-container"
  const container = document.getElementById('return-to-default-container');
  if (container) container.style.display = '';
}

function hideReturnLink() {
  const btn = document.getElementById('return-to-default-btn');
  if (btn) {
    btn.setAttribute('hidden', '');
    return;
  }
  const container = document.getElementById('return-to-default-container');
  if (container) container.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Core parse-and-load logic (exported so tests can call it directly)
// ---------------------------------------------------------------------------

/**
 * Parse an ArrayBuffer representing a .xlsx or .xls file and, on success,
 * call window.setActiveQuestions() with the parsed question array.
 *
 * @param {ArrayBuffer} arrayBuffer - raw file bytes
 * @param {string}      filename    - original filename (used to check extension)
 * @returns {Promise<void>}
 */
async function parseAndLoad(arrayBuffer, filename) {
  clearError();

  // --- Validate file extension ---
  const lower = (filename || '').toLowerCase();
  if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
    showError('Unsupported file type. Please upload a .xlsx or .xls file.');
    return;
  }

  // --- Parse with SheetJS ---
  let workbook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: 'array' });
  } catch (err) {
    showError('Could not read the file. Make sure it is a valid Excel file.');
    return;
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    showError('The Excel file contains no sheets.');
    return;
  }

  const sheet = workbook.Sheets[firstSheetName];

  // sheet_to_json with header:1 returns an array of arrays (no object keys)
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // --- Header detection: skip row 0 if it doesn't look French ---
  let dataRows = rawRows;
  if (rawRows.length > 0) {
    const firstCellValue = String(rawRows[0][0] || '').trim();
    if (!looksLikeFrench(firstCellValue)) {
      // First row is likely a header — skip it
      dataRows = rawRows.slice(1);
    }
  }

  // --- Filter out completely empty rows ---
  const validRows = dataRows.filter((row) => {
    const q = String(row[0] || '').trim();
    return q.length > 0;
  });

  if (validRows.length === 0) {
    showError('No valid question rows found. Column A must contain French questions.');
    return;
  }

  // --- Build Question objects ---
  const questions = validRows.map((row) => {
    const q = String(row[0] || '').trim();
    const rawAnswer = row[1] !== undefined ? String(row[1]).trim() : '';
    const answer = rawAnswer.length > 0 ? rawAnswer : null;
    return {
      q,
      answer,
      translation: null,
      theme: 'custom',
    };
  });

  // --- Activate the uploaded bank ---
  window.setActiveQuestions(questions, 'uploaded');
  setModeIndicator(`Custom questions loaded (${questions.length} questions)`);

  // --- Show the "Return to default questions" control ---
  showReturnLink();
}

// ---------------------------------------------------------------------------
// "Return to default questions" handler
// ---------------------------------------------------------------------------
function revertToSeeded() {
  window.setActiveQuestions([...(window.SEEDED_QUESTIONS || [])], 'seeded');
  setModeIndicator('Practising with 30 seeded questions');
  clearError();
  hideReturnLink();
}

// ---------------------------------------------------------------------------
// File reading helper — FileReader → ArrayBuffer → parseAndLoad
// ---------------------------------------------------------------------------
function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    await parseAndLoad(e.target.result, file.name);
  };
  reader.onerror = () => {
    showError('Failed to read the file. Please try again.');
  };
  reader.readAsArrayBuffer(file);
}

// ---------------------------------------------------------------------------
// DOM event wiring — called once on DOMContentLoaded
// ---------------------------------------------------------------------------
function init() {
  // --- File input (click-to-upload) ---
  const fileInput = document.getElementById('excel-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleFile(file);
      // Reset so the same file can be re-uploaded if needed
      e.target.value = '';
    });
  }

  // --- Drag-and-drop zone ---
  const zone = document.getElementById('excel-upload-zone');
  if (zone) {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
  }

  // --- "Return to default questions" button (production HTML: #return-to-default-btn) ---
  const returnBtn = document.getElementById('return-to-default-btn');
  if (returnBtn) {
    returnBtn.addEventListener('click', (e) => {
      e.preventDefault();
      revertToSeeded();
    });
  }

  // --- "Return to default questions" link (test DOM: #return-to-default-link) ---
  const returnLink = document.getElementById('return-to-default-link');
  if (returnLink) {
    returnLink.addEventListener('click', (e) => {
      e.preventDefault();
      revertToSeeded();
    });
  }
}

// Auto-init when the DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

// ---------------------------------------------------------------------------
// Exports — consumed by tests (excel.test.js) and by integration layer (D2)
// ---------------------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseAndLoad, revertToSeeded, looksLikeFrench };
}
