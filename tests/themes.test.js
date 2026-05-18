/**
 * @jest-environment jsdom
 */
'use strict';

// ---------------------------------------------------------------------------
// themes.test.js — AI Theme Mode unit tests
// ---------------------------------------------------------------------------

// Set up required DOM elements before loading themes.js
function setupDOM() {
  document.body.innerHTML = `
    <div id="theme-selector"></div>
    <p id="mode-indicator">Practising with 30 seeded questions</p>
  `;
}

// Load themes.js fresh for each test by clearing the module registry
// and re-requiring so DOMContentLoaded listeners are re-registered.
function loadThemesModule() {
  // themes.js attaches a DOMContentLoaded listener; since jsdom fires
  // that event synchronously when readyState is 'complete', we just
  // require the module and dispatch the event manually.
  jest.resetModules();
  require('../frontend/themes');
  // Dispatch DOMContentLoaded so renderThemeButtons runs
  document.dispatchEvent(new Event('DOMContentLoaded'));
}

beforeEach(() => {
  setupDOM();

  // Mock globals that core.js would provide
  window.setActiveQuestions = jest.fn();
  window.newQuestion = jest.fn();

  // Mock fetch
  global.fetch = jest.fn();

  loadThemesModule();
});

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Test 1: Renders 6 theme buttons with correct data attributes
// ---------------------------------------------------------------------------
describe('renderThemeButtons', () => {
  it('renders 6 theme buttons with correct data-theme and data-label attributes', () => {
    const container = document.getElementById('theme-selector');
    const buttons = container.querySelectorAll('.theme-btn');
    expect(buttons).toHaveLength(6);

    const expectedThemes = [
      { slug: 'home-abroad',          label: 'Home & Abroad' },
      { slug: 'education-employment', label: 'Education and Employment' },
      { slug: 'personal-life',        label: 'Personal Life and Relationships' },
      { slug: 'world-around-us',      label: 'The World Around Us' },
      { slug: 'social-activities',    label: 'Social Activities' },
      { slug: 'fitness-health',       label: 'Fitness & Health' },
    ];

    expectedThemes.forEach(({ slug, label }, i) => {
      expect(buttons[i].dataset.theme).toBe(slug);
      expect(buttons[i].dataset.label).toBe(label);
      expect(buttons[i].textContent).toBe(label);
    });
  });
});

// ---------------------------------------------------------------------------
// Test 2: Clicking a theme button calls fetch with correct body
// ---------------------------------------------------------------------------
describe('handleThemeClick — fetch call', () => {
  it('calls fetch("/api/generate-questions", { method: POST, body: { theme, count: 5 } }) when a theme button is clicked', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        questions: ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?'],
      }),
    });

    const btn = document.querySelector('[data-theme="home-abroad"]');
    btn.click();

    // Yield to microtask queue so async handler runs
    await Promise.resolve();
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'home-abroad', count: 5 }),
    });
  });
});

// ---------------------------------------------------------------------------
// Test 3: On success — setActiveQuestions called with mapped Question objects
// ---------------------------------------------------------------------------
describe('handleThemeClick — success path', () => {
  it('calls window.setActiveQuestions with mapped Question objects on successful response', async () => {
    const rawQuestions = [
      'Décris ta maison.',
      'Où habites-tu?',
      'Que penses-tu de ta région?',
      'Décris ton quartier.',
      "Comment est-ce que tu aides à la maison?",
    ];

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ questions: rawQuestions }),
    });

    const btn = document.querySelector('[data-theme="home-abroad"]');
    btn.click();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(window.setActiveQuestions).toHaveBeenCalledTimes(1);

    const [passedQuestions, passedSource] = window.setActiveQuestions.mock.calls[0];

    expect(passedSource).toBe('ai-generated');
    expect(passedQuestions).toHaveLength(5);

    passedQuestions.forEach((q, i) => {
      expect(q.q).toBe(rawQuestions[i]);
      expect(q.answer).toBeNull();
      expect(q.translation).toBeNull();
      expect(q.theme).toBe('home-abroad');
    });
  });

  it('updates #mode-indicator to "AI Theme: [Theme Name]" on success', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        questions: ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?'],
      }),
    });

    const btn = document.querySelector('[data-theme="education-employment"]');
    btn.click();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const indicator = document.getElementById('mode-indicator');
    expect(indicator.textContent).toBe('AI Theme: Education and Employment');
  });

  it('calls window.newQuestion() after a successful bank swap', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        questions: ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?'],
      }),
    });

    document.querySelector('[data-theme="personal-life"]').click();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(window.newQuestion).toHaveBeenCalledTimes(1);
  });

  it('marks the clicked theme button with "active" CSS class on success', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        questions: ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?'],
      }),
    });

    const btn = document.querySelector('[data-theme="social-activities"]');
    btn.click();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(btn.classList.contains('active')).toBe(true);

    // All other buttons must NOT have active class
    const others = document.querySelectorAll('.theme-btn:not([data-theme="social-activities"])');
    others.forEach(other => {
      expect(other.classList.contains('active')).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Test 4: API failure — show inline error, do NOT call setActiveQuestions
// ---------------------------------------------------------------------------
describe('handleThemeClick — failure path', () => {
  it('shows inline error and does NOT call setActiveQuestions when fetch returns non-ok', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => ({ error: 'Generation failed', detail: 'Claude unreachable' }),
    });

    document.querySelector('[data-theme="fitness-health"]').click();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(window.setActiveQuestions).not.toHaveBeenCalled();

    const errorEl = document.getElementById('theme-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toBe('Could not generate questions — please try again');
  });

  it('shows inline error and does NOT call setActiveQuestions when fetch throws a network error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network failure'));

    document.querySelector('[data-theme="world-around-us"]').click();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(window.setActiveQuestions).not.toHaveBeenCalled();

    const errorEl = document.getElementById('theme-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toBe('Could not generate questions — please try again');
  });

  it('re-enables all theme buttons after a failed request', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network failure'));

    document.querySelector('[data-theme="home-abroad"]').click();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const buttons = document.querySelectorAll('.theme-btn');
    buttons.forEach(btn => {
      expect(btn.disabled).toBe(false);
    });
  });

  it('does NOT update #mode-indicator on API failure', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => ({}),
    });

    document.querySelector('[data-theme="home-abroad"]').click();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const indicator = document.getElementById('mode-indicator');
    expect(indicator.textContent).toBe('Practising with 30 seeded questions');
  });
});

// ---------------------------------------------------------------------------
// Test 5: Buttons disabled during request; re-enabled after
// ---------------------------------------------------------------------------
describe('handleThemeClick — loading state', () => {
  it('disables all theme buttons while the request is in flight', async () => {
    let resolveRequest;
    global.fetch.mockReturnValueOnce(
      new Promise(resolve => { resolveRequest = resolve; })
    );

    document.querySelector('[data-theme="home-abroad"]').click();

    // Request is in flight — buttons should be disabled
    await Promise.resolve();

    const buttons = document.querySelectorAll('.theme-btn');
    buttons.forEach(btn => {
      expect(btn.disabled).toBe(true);
    });

    // Resolve the request
    resolveRequest({
      ok: true,
      json: async () => ({ questions: ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?'] }),
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // After resolution — buttons should be re-enabled
    buttons.forEach(btn => {
      expect(btn.disabled).toBe(false);
    });
  });
});
