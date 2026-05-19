# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

Phase A complete. Phase B complete. Phase C complete. D1 complete. D2 complete. D3 complete. ALL PHASES DONE.

## Architecture

**Frenchie** — GCSE French oral practice web app.

### Stack
- **Frontend**: Vanilla HTML/CSS/JS, no framework, no build step — served as static files from `frontend/`
- **Backend**: Node.js + Express — acts as API proxy/gateway only; all API keys are server-side
- **Deployment**: Railway (nixpacks builder, `node backend/server.js` start command); `Dockerfile` also present (node:20-alpine, `EXPOSE 3001`) for container deploys

### File Layout
```
frontend/
  index.html      # Entry point, served at GET /
  app.js          # Shared API fetch helper (apiFetch); loaded before all modules
  data.js         # Shared data contract: SEEDED_QUESTIONS (30 Q&As), typedefs
  core.js         # Core UI loop, evaluate flow, feedback panel (C1)
  audio.js        # TTS playback (fetch /api/tts → msedge-tts, blob URL cached) + MediaRecorder transcription (C2)
  excel.js        # Excel upload mode — SheetJS parsing, drag-drop (C3)
  themes.js       # AI theme mode — topic picker, question generation (C4)
  history.js      # History slide-out panel, localStorage persistence (C5)
  styles.css      # All CSS (skeuomorphic design, parchment palette)
backend/
  server.js       # Express app — CORS, static, health, mounts routes
  routes/
    tts.js              # POST /api/tts — ElevenLabs proxy
    transcribe.js       # POST /api/transcribe — Whisper proxy
    evaluate.js         # POST /api/evaluate — Claude evaluation proxy
    generateQuestions.js # POST /api/generate-questions — Claude generation proxy
  services/
    claude.js           # Claude API client (evaluate + generateQuestions logic)
    elevenlabs.js       # ElevenLabs TTS client
    stt.js              # Groq Whisper STT client
  middleware/
    upload.js           # multer memoryStorage (shared by transcribe route)
tests/
  server.test.js          # Backend foundation tests (Jest + supertest)
  evaluate.test.js        # B3 evaluate endpoint tests
  generateQuestions.test.js # B4 generate-questions endpoint tests
  transcribe.test.js      # B2 transcribe endpoint tests
  tts.test.js             # B1 TTS endpoint tests (stub)
  excel.test.js           # C3 Excel upload tests (jsdom)
  core.test.js            # C1 core UI loop tests (jsdom)
  audio.test.js           # C2 audio tests (jsdom)
  themes.test.js          # C4 AI theme mode tests (jsdom)
  history.test.js         # C5 history panel tests (jsdom)
  integration.test.js     # D2 cross-module integration tests (jsdom)
  gaps.test.js             # D3 gap tests — Node env (CORS no-Origin, priorAttempts route cap)
  gaps-jsdom.test.js       # D3 gap tests — jsdom env (TTL boundary, evaluate error, Excel no-header, mode switch)
  history_real.test.js     # Bug fix regression — loads actual history.js via eval, tests real save/render pipeline
```

### Key Architectural Decisions
- `backend/server.js` exports `app` without calling `app.listen()` when `require.main !== module` — this allows supertest to import the app cleanly in tests without binding a port.
- `multer` lives in `backend/middleware/upload.js` (memoryStorage); route files `require('../middleware/upload')` directly.
- CORS: when `FRONTEND_ORIGIN` env var is set, only that exact origin is allowed; when unset (local dev), `origin: '*'` is used. The CORS origin callback rejects non-matching origins silently (no ACAO header returned).
- `.env` is gitignored; `.env.example` (with comments) is committed as the canonical reference for Railway env vars.
- `node-fetch` v2 (CommonJS) is used — v3 is ESM-only and would require `"type": "module"` in package.json, which conflicts with the CommonJS route files.
- **Frontend module split (Phase C)**: each C-group owns a separate `.js` file (`data.js`, `core.js`, `audio.js`, `excel.js`, `themes.js`, `history.js`). `data.js` is loaded first and provides `SEEDED_QUESTIONS` as a global.
- **C3 excel.js**: SheetJS is loaded via CDN (`https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js`) in `index.html` before `excel.js`. The module exports `parseAndLoad(arrayBuffer, filename)` for direct test use. Error display supports both `#excel-error` (test DOM) and `#upload-error` (production HTML) element IDs. Tests use `@jest-environment jsdom` docblock. Upload zone shows column hint: Column A = Question, Column B = Answer (omit for AI-judged scoring).
- **jest test environments**: backend tests use the default `node` environment. Frontend tests require `@jest-environment jsdom` docblock at the top of each test file since the global jest config sets `testEnvironment: "node"`.
- **TTS: msedge-tts** — `backend/services/edge-tts.js` uses `msedge-tts` npm package (`fr-FR-DeniseNeural`, `AUDIO_24KHZ_48KBITRATE_MONO_MP3`). ElevenLabs free tier blocks all voices via API. `ELEVENLABS_VOICE_ID` env var is obsolete. Frontend `audio.js` calls `/api/tts` and caches blob URL for replay. No API key needed for TTS. `audio.playbackRate = 0.75` set on play.
- **Scoring scale**: Communication 0–5, Range & Accuracy 0–5, overallScore = sum (0–10). `scoreBandClass(score, max)` is percentage-based (≤40% red, ≤70% amber, else green) — always pass `max` (10 for overall, 5 for categories). Prior attempts display uses `/10`.
- **STT: Groq Whisper** — `stt.js` uses `whisper-large-v3-turbo` via `POST https://api.groq.com/openai/v1/audio/transcriptions`. `GROQ_API_KEY` env var. ElevenLabs Scribe was replaced because ElevenLabs free tier blocks cloud-hosted IPs (Railway) with "detected_unusual_activity". Groq free tier is cloud-IP-safe.
- **history.js safety rules**: (1) All `localStorage.setItem` calls are wrapped in try/catch with `console.error` — a bare `setItem` outside try/catch would propagate as "Evaluation failed" from core.js's catch block, hiding the real cause. (2) All `entry.*` field accesses in `renderHistoryEntries` use `|| ''` guards (including `entry.question`). (3) Never use `arguments.callee` — history.js is `'use strict'`; use a named function instead.
- **history.js testing**: `tests/history.test.js` uses inlined versions of save/render (doesn't import the real module). `tests/history_real.test.js` loads the actual `frontend/history.js` via `eval()` to test the real code path. When changing history.js, run both test files.
- **Scoring LLM: Gemini 2.5 Flash Lite** — `backend/services/claude.js` (filename unchanged, no route changes needed) uses `@google/generative-ai` with model `gemini-2.5-flash-lite`. `systemInstruction` param used for system prompt. `GEMINI_API_KEY` env var; `ANTHROPIC_API_KEY` removed. `@anthropic-ai/sdk` removed from package.json.
- **Translation reveal** — `data.js` `translation` field = English translation of the French *question* (not the model answer). Button always shown after `newQuestion()`. If `currentQuestion.translation` is null (Excel/AI questions), clicking the button lazily calls `POST /api/translate`, caches result on `currentQuestion.translation`, then shows it. `generateQuestions` (Gemini) now returns `[{q, translation}]` objects; `themes.js` maps them with a string fallback guard.
- **`POST /api/translate`** — new route (`backend/routes/translate.js`), calls `translateQuestion()` in `claude.js`. Used only for on-demand translation of Excel/uploaded questions.
- **Frontend global name collision risk**: all `.js` files are plain scripts (not ES modules), so top-level `function` declarations are global. `excel.js` previously collided with `core.js` on `showError`/`clearError` — fixed by renaming to `showUploadError`/`clearUploadError`. Rule: all new helper functions in a frontend module must use a module-specific name prefix.
- **Audio eval for prosody deliberately omitted**: Edexcel GCSE oral marking (AO1/AO2) does not separately score pronunciation/intonation — transcription-based text eval is sufficient. Sending audio to Gemini would add ~750 tokens/eval and 1–3s latency for no marking benefit.

### D2 Cross-Module Wiring Contract (DO NOT CHANGE without updating all callers)

**core.js ↔ audio.js**
- `window.playQuestionAudio(text)` — assigned by `audio.js`; called by `core.js` `newQuestion()`
- `window.getCurrentTranscript()` — assigned by `audio.js`; called by `core.js` `submitResponse()` in speech mode
- `audio.js` `playQuestionAudio()` shows `#audio-replay-btn` on first successful TTS call (hidden on load)
- Speech mode empty transcript error: "Please record your answer first."

**core.js ↔ history.js**
- `window.saveHistory(entry)` — assigned by `history.js`; called by `core.js` after successful evaluate
- `window.getQuestionHistory()` — assigned by `history.js`; called by `core.js` for `priorAttempts` lookup
- `window.clearHistoryStorage()` — assigned by `history.js`; called by `core.js` `clearAll()`
- `history.js` `saveHistory()` stores `{ response, overallScore, comments, timestamp }` in `frenchie_questionHistory` — `comments` field is required for `priorAttempts.comments` in evaluate payloads
- `history.js` DOMContentLoaded runs `loadHistory()` (TTL prune) automatically on page load

**core.js ↔ excel.js / themes.js**
- `window.setActiveQuestions(questions, source)` — assigned by `core.js`; called by excel.js and themes.js
- `window.newQuestion()` — assigned by `core.js`; called by themes.js after a successful question generation
- Mode indicator: `setActiveQuestions` sets a generic label; `themes.js` overrides immediately after with `"AI Theme: ${label}"`

**submit-btn state machine**
- `hidden` on load; `hidden=false` after `newQuestion()`; `hidden=true` again after successful submit
- Remains enabled on error path so student can retry without clicking New Question

**priorAttempts shape sent to /api/evaluate**
- `Array<{ response: string, overallScore: number, comments: string }>` — last 3 (capped), oldest first

### Environment Variables (see `.env.example`)
- `ELEVENLABS_API_KEY` — TTS (`/api/tts`) via ElevenLabs (kept for potential future use; msedge-tts currently used instead — no key needed for TTS)
- `GROQ_API_KEY` — STT (`/api/transcribe`) via Groq Whisper — get free key at console.groq.com
- `GEMINI_API_KEY` — Gemini evaluation + question generation (replaced ANTHROPIC_API_KEY)
- `FRONTEND_ORIGIN` — CORS allowlist (e.g. `https://frenchie.up.railway.app`); set to `http://localhost:PORT` locally
- `PORT` — server port (Railway sets automatically; locally default 3000; note macOS port 5000 is taken by AirPlay Receiver)

## Common Commands

- **Dev server**: `npm run dev` (nodemon, auto-restart)
- **Production**: `npm start` (`node backend/server.js`)
- **Tests**: `npm test` (Jest + supertest, `tests/` directory only)
- **Single test file**: `npx jest tests/integration.test.js --no-coverage`
- **Single test by name**: `npx jest --testNamePattern="health" --forceExit`

## Git Workflow

- Branch from `main` for all work
- Use `/caveman-commit` for commit messages (ultra-compressed conventional commits)
- Keep CLAUDE.md updated with architectural changes

## Links

- Spec: `agent-os/specs/2026-05-18-frenchie-gcse-oral-practice-web-app/spec.md`
- Tasks: `agent-os/specs/2026-05-18-frenchie-gcse-oral-practice-web-app/tasks.md`
- Railway: https://railway.app (deploy from `main`)


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session
<!-- END BEADS INTEGRATION -->
