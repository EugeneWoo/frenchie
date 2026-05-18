'use strict';

// ---------------------------------------------------------------------------
// API helper — all fetch calls use relative paths (same-origin in prod + dev)
// ---------------------------------------------------------------------------
async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch (_) {}
    const err = new Error(`API error ${res.status}: ${detail}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

// Phase C implementation goes here
