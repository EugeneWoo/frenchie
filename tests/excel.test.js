/**
 * @jest-environment jsdom
 */
'use strict';

/**
 * Tests for frontend/excel.js — SheetJS parsing and question bank swap.
 *
 * Uses jsdom so document.getElementById() works.
 * Mocks the SheetJS XLSX global — no real .xlsx files needed.
 */

/* eslint-env jest */

// ---------------------------------------------------------------------------
// Mock SheetJS XLSX global — must be in place before excel.js is required
// ---------------------------------------------------------------------------
const XLSX_MOCK = {
  read: jest.fn(),
  utils: {
    // sheet_to_json is what excel.js calls after XLSX.read
    sheet_to_json: jest.fn(),
  },
};
global.XLSX = XLSX_MOCK;

// ---------------------------------------------------------------------------
// window.setActiveQuestions stub and SEEDED_QUESTIONS
// ---------------------------------------------------------------------------
const MOCK_SEEDED = [
  { q: 'Question 1?', answer: 'Réponse 1.', translation: 'Answer 1.', theme: 'home-abroad' },
  { q: 'Question 2?', answer: 'Réponse 2.', translation: 'Answer 2.', theme: 'personal-life' },
];

global.SEEDED_QUESTIONS = MOCK_SEEDED;
global.setActiveQuestions = jest.fn();
// excel.js calls window.setActiveQuestions — in jsdom, window === global
window.setActiveQuestions = global.setActiveQuestions;
window.SEEDED_QUESTIONS = MOCK_SEEDED;

// ---------------------------------------------------------------------------
// Load the module under test (after globals are in place)
// ---------------------------------------------------------------------------
const { parseAndLoad } = require('../frontend/excel.js');

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
function setupDOM() {
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
}

beforeEach(() => {
  setupDOM();
  jest.clearAllMocks();
  // Re-attach window stub after clearAllMocks
  global.setActiveQuestions = jest.fn();
  window.setActiveQuestions = global.setActiveQuestions;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('C3.1 — valid .xlsx with two columns', () => {
  it('parses rows into Question objects and calls window.setActiveQuestions with source "uploaded"', async () => {
    XLSX_MOCK.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    });
    // sheet_to_json returns array-of-arrays (header:1 mode);
    // excel.js checks row[0][0] for French — these start with French words
    XLSX_MOCK.utils.sheet_to_json.mockReturnValue([
      ['Où habites-tu?', "J'habite à Paris."],
      ['Quel âge as-tu?', "J'ai seize ans."],
    ]);

    await parseAndLoad(new ArrayBuffer(8), 'questions.xlsx');

    expect(window.setActiveQuestions).toHaveBeenCalledTimes(1);
    const [questions, source] = window.setActiveQuestions.mock.calls[0];
    expect(source).toBe('uploaded');
    expect(questions).toHaveLength(2);
    expect(questions[0]).toMatchObject({
      q: 'Où habites-tu?',
      answer: "J'habite à Paris.",
      translation: null,
      theme: 'custom',
    });
    expect(questions[1]).toMatchObject({
      q: 'Quel âge as-tu?',
      answer: "J'ai seize ans.",
      translation: null,
      theme: 'custom',
    });
  });
});

describe('C3.1 — column A only (no column B)', () => {
  it('sets answer to null on each entry and updates mode indicator', async () => {
    XLSX_MOCK.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    });
    // Rows with only one column — answer should become null
    XLSX_MOCK.utils.sheet_to_json.mockReturnValue([
      ['Où habites-tu?'],
      ['Quel âge as-tu?'],
      ['Décris ta famille.'],
    ]);

    await parseAndLoad(new ArrayBuffer(8), 'questions.xlsx');

    expect(window.setActiveQuestions).toHaveBeenCalledTimes(1);
    const [questions] = window.setActiveQuestions.mock.calls[0];
    expect(questions).toHaveLength(3);
    questions.forEach((q) => {
      expect(q.answer).toBeNull();
    });

    const indicator = document.getElementById('mode-indicator');
    expect(indicator.textContent).toBe('Custom questions loaded (3 questions)');
  });
});

describe('C3.1 — zero valid rows', () => {
  it('shows inline error and does NOT call setActiveQuestions', async () => {
    XLSX_MOCK.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    });
    // Empty data — no valid rows after header skip
    XLSX_MOCK.utils.sheet_to_json.mockReturnValue([]);

    await parseAndLoad(new ArrayBuffer(8), 'questions.xlsx');

    expect(window.setActiveQuestions).not.toHaveBeenCalled();

    const errorEl = document.getElementById('excel-error');
    // Error element must be visible (display !== 'none' or hidden attr removed)
    expect(errorEl.style.display).not.toBe('none');
    expect(errorEl.textContent.length).toBeGreaterThan(0);
  });
});

describe('C3.1 (extra) — invalid file type', () => {
  it('shows inline error for .csv files and does NOT call setActiveQuestions or XLSX.read', async () => {
    await parseAndLoad(new ArrayBuffer(8), 'questions.csv');

    expect(window.setActiveQuestions).not.toHaveBeenCalled();
    expect(XLSX_MOCK.read).not.toHaveBeenCalled();

    const errorEl = document.getElementById('excel-error');
    expect(errorEl.style.display).not.toBe('none');
    expect(errorEl.textContent.length).toBeGreaterThan(0);
  });
});
