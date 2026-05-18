'use strict';

// ---------------------------------------------------------------------------
// AI Theme Mode — Topic Picker and Question Generation
// Handles rendering 6 Edexcel theme buttons and calling /api/generate-questions
// ---------------------------------------------------------------------------

const THEMES = [
  { slug: 'home-abroad',          label: 'Home & Abroad' },
  { slug: 'education-employment', label: 'Education and Employment' },
  { slug: 'personal-life',        label: 'Personal Life and Relationships' },
  { slug: 'world-around-us',      label: 'The World Around Us' },
  { slug: 'social-activities',    label: 'Social Activities' },
  { slug: 'fitness-health',       label: 'Fitness & Health' },
];

/**
 * Render 6 theme buttons inside #theme-selector.
 * Each button carries data-theme (slug) and data-label (display label).
 */
function renderThemeButtons() {
  const container = document.getElementById('theme-selector');
  if (!container) return;

  container.innerHTML = '';

  THEMES.forEach(({ slug, label }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-btn';
    btn.dataset.theme = slug;
    btn.dataset.label = label;
    btn.textContent = label;
    btn.addEventListener('click', () => handleThemeClick(btn, slug, label));
    container.appendChild(btn);
  });
}

/**
 * Show an inline error message in #theme-selector.
 * Replaces any previous error; buttons are re-enabled by the caller.
 */
function showThemeError(message) {
  const existing = document.getElementById('theme-error');
  if (existing) existing.remove();

  const err = document.createElement('p');
  err.id = 'theme-error';
  err.className = 'theme-error';
  err.textContent = message;

  const container = document.getElementById('theme-selector');
  if (container) container.appendChild(err);
}

/**
 * Set all theme buttons to disabled or enabled state.
 */
function setThemeButtonsDisabled(disabled) {
  const container = document.getElementById('theme-selector');
  if (!container) return;
  container.querySelectorAll('.theme-btn').forEach(btn => {
    btn.disabled = disabled;
  });
}

/**
 * Mark one button as the active (selected) theme; clear others.
 */
function setActiveThemeButton(activeSlug) {
  const container = document.getElementById('theme-selector');
  if (!container) return;
  container.querySelectorAll('.theme-btn').forEach(btn => {
    if (btn.dataset.theme === activeSlug) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Handle a theme button click:
 *   1. Show loading state on the clicked button; disable all buttons.
 *   2. POST /api/generate-questions with { theme: slug, count: 5 }.
 *   3. On success: map questions, call window.setActiveQuestions, update
 *      #mode-indicator, mark button active, call window.newQuestion().
 *   4. On failure: show inline error, leave activeQuestions unchanged.
 *   5. Re-enable buttons in both paths.
 */
async function handleThemeClick(btn, slug, label) {
  // Clear any previous error
  const existing = document.getElementById('theme-error');
  if (existing) existing.remove();

  // Loading state
  const originalText = btn.textContent;
  btn.textContent = 'Loading…';
  setThemeButtonsDisabled(true);

  try {
    const res = await fetch('/api/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: slug, count: 5 }),
    });

    if (!res.ok) {
      let detail = res.statusText;
      try { detail = (await res.json()).detail || detail; } catch (_) {}
      throw new Error(detail);
    }

    const data = await res.json();
    const questions = (data.questions || []).map(item => ({
      q: typeof item === 'string' ? item : item.q,
      answer: null,
      translation: typeof item === 'object' ? (item.translation || null) : null,
      theme: slug,
    }));

    // Swap the active question bank
    if (typeof window.setActiveQuestions === 'function') {
      window.setActiveQuestions(questions, 'ai-generated');
    }

    // Update mode indicator
    const indicator = document.getElementById('mode-indicator');
    if (indicator) indicator.textContent = `AI Theme: ${label}`;

    // Mark the clicked button as active
    btn.textContent = originalText;
    setActiveThemeButton(slug);

    // Auto-load first generated question
    if (typeof window.newQuestion === 'function') {
      window.newQuestion();
    }
  } catch (err) {
    btn.textContent = originalText;
    showThemeError('Could not generate questions — please try again');
  } finally {
    setThemeButtonsDisabled(false);
  }
}

// ---------------------------------------------------------------------------
// Initialise on DOM ready
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', renderThemeButtons);
