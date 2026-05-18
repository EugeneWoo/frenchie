# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

Phase A complete. Phase B complete. Phase C complete. D1 complete. D2 complete. D3 complete. ALL PHASES DONE.

## Architecture

**Frenchie** — GCSE French oral practice web app.

### Stack
- **Frontend**: Vanilla HTML/CSS/JS, no framework, no build step — served as static files from `frontend/`
- **Backend**: Node.js + Express — acts as API proxy/gateway only; all API keys are server-side
- **Deployment**: Railway (nixpacks builder, `node backend/server.js` start command)

### File Layout
```
frontend/
  index.html      # Entry point, served at GET /
  data.js         # Shared data contract: SEEDED_QUESTIONS (30 Q&As), typedefs
  core.js         # Core UI loop, evaluate flow, feedback panel (C1)
  audio.js        # TTS playback + MediaRecorder transcription (C2)
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
```

### Key Architectural Decisions
- `backend/server.js` exports `app` without calling `app.listen()` when `require.main !== module` — this allows supertest to import the app cleanly in tests without binding a port.
- `multer` is initialised with `memoryStorage()` in `server.js` and exposed via `app.locals.upload` for route files to use.
- CORS: when `FRONTEND_ORIGIN` env var is set, only that exact origin is allowed; when unset (local dev), `origin: '*'` is used. The CORS origin callback rejects non-matching origins silently (no ACAO header returned).
- `.env` is gitignored; `.env.example` (with comments) is committed as the canonical reference for Railway env vars.
- `node-fetch` v2 (CommonJS) is used — v3 is ESM-only and would require `"type": "module"` in package.json, which conflicts with the CommonJS route files.
- **Frontend module split (Phase C)**: each C-group owns a separate `.js` file (`data.js`, `core.js`, `audio.js`, `excel.js`, `themes.js`, `history.js`). `data.js` is loaded first and provides `SEEDED_QUESTIONS` as a global.
- **C3 excel.js**: SheetJS is loaded via CDN (`https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js`) in `index.html` before `excel.js`. The module exports `parseAndLoad(arrayBuffer, filename)` for direct test use. Error display supports both `#excel-error` (test DOM) and `#upload-error` (production HTML) element IDs. Tests use `@jest-environment jsdom` docblock.
- **jest test environments**: backend tests use the default `node` environment. Frontend tests require `@jest-environment jsdom` docblock at the top of each test file since the global jest config sets `testEnvironment: "node"`.

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
- `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` — TTS
- `OPENAI_API_KEY` — Whisper transcription
- `ANTHROPIC_API_KEY` — Claude evaluation + question generation
- `FRONTEND_ORIGIN` — CORS allowlist (e.g. `https://frenchie.up.railway.app`)
- `PORT` — server port (Railway sets this automatically)

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
