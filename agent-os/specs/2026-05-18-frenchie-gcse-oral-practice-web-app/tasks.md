# Task Breakdown: Frenchie GCSE French Oral Practice Web App

## Overview

Total Task Groups: 11 (across 4 phases)
Parallelism Strategy: Groups within the same phase can be executed simultaneously by independent agents. Groups in a later phase cannot start until all groups in the prior phase are complete.

---

## Phase A — Foundation (Sequential, Must Complete First)

**All subsequent phases depend on this phase. Execute sequentially within the group.**

### Group A: Project Scaffold, Server, and Static File Serving

**Dependencies:** None
**Agents:** 1 (sequential)

- [x] A.0 Complete foundation scaffold
  - [x] A.1 Write 2–4 focused tests for server startup and health endpoint
    - Test: `GET /api/health` returns `{ status: "ok" }` with HTTP 200
    - Test: CORS rejects a request from a non-allowlisted origin
    - Test: Static file serving returns `index.html` for `GET /`
  - [x] A.2 Initialise project structure
    - Create directories: `frontend/`, `backend/`, `backend/routes/`
    - Create placeholder files: `frontend/index.html`, `frontend/app.js`, `frontend/styles.css`
    - Create `backend/server.js`
    - Create `package.json` with scripts: `start` (`node backend/server.js`), `dev` (`nodemon backend/server.js`)
    - Dependencies to install: `express`, `cors`, `dotenv`, `multer`, `node-fetch` (or `axios`), `nodemon` (dev)
  - [x] A.3 Configure `.env` and environment variable loading
    - Create `.env.example` with keys: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `FRONTEND_ORIGIN`
    - Create `.env` (gitignored) with placeholder values
    - Load env vars in `backend/server.js` via `dotenv.config()`
    - Add `.env` to `.gitignore`; confirm `.env.example` is committed
  - [x] A.4 Set up Express server with CORS, static serving, and health endpoint
    - Configure `cors` middleware using `FRONTEND_ORIGIN` env var (or `*` in dev mode)
    - Serve `frontend/` as static files via `express.static`
    - Mount `GET /api/health` returning `{ status: "ok" }`
    - Add JSON body parser middleware (`express.json()`)
    - Add `multer` middleware for multipart routes (used later by `/api/transcribe`)
    - Server listens on `PORT` env var, defaulting to `3000`
  - [x] A.5 Create `backend/routes/` stubs for all four API routes
    - Create `backend/routes/tts.js` — stub that returns `{ message: "not implemented" }` with HTTP 501
    - Create `backend/routes/transcribe.js` — stub
    - Create `backend/routes/evaluate.js` — stub
    - Create `backend/routes/generateQuestions.js` — stub
    - Mount all four routers in `backend/server.js` under `/api`
  - [x] A.6 Create Railway deployment config
    - Add `Procfile` or confirm `package.json` `start` script is sufficient for Railway
    - Add `railway.json` or `railway.toml` if needed for port binding
    - Document required Railway environment variables in `README` (or `.env.example` comments)
  - [x] A.7 Verify foundation tests pass
    - Run only the 2–4 tests written in A.1
    - Confirm server starts without errors
    - Confirm health endpoint responds correctly
    - Confirm CORS header is present on API responses

**Acceptance Criteria:**
- `GET /api/health` returns `{ status: "ok" }` with HTTP 200
- CORS allows the configured frontend origin and rejects others
- `GET /` serves `frontend/index.html`
- All four route stubs mount without error and return HTTP 501
- `.env` is gitignored; `.env.example` is present and committed
- All A.1 tests pass

---

## Phase B — Backend API Endpoints (Parallel after Phase A)

**All four groups in Phase B can be developed simultaneously by independent agents. Each agent works only in its own route file. They share no code.**

---

### Group B1: TTS Endpoint — ElevenLabs Integration

**Dependencies:** Group A complete
**Agents:** 1

- [x] B1.0 Complete TTS endpoint
  - [x] B1.1 Write 2–4 focused tests for the TTS endpoint
    - Test: `POST /api/tts` with valid `{ text }` body returns HTTP 200 with `Content-Type: audio/mpeg`
    - Test: `POST /api/tts` with missing `text` field returns HTTP 400 with `{ error: ... }`
    - Test: `POST /api/tts` when ElevenLabs returns an error returns HTTP 502 with `{ error: "TTS failed", detail: "..." }`
    - Use a mock/stub for the ElevenLabs HTTP call to avoid real API usage in tests
  - [x] B1.2 Implement `POST /api/tts` in `backend/routes/tts.js`
    - Accept `{ text: string }` JSON body; return HTTP 400 if `text` is absent or empty
    - Read `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` from env
    - POST to ElevenLabs TTS API: `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
    - Request body: `{ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }`
    - Set `Accept: audio/mpeg` header on ElevenLabs request
    - Pipe the ElevenLabs response stream directly back to the client with `Content-Type: audio/mpeg`
    - On ElevenLabs error: return HTTP 502 with `{ error: "TTS failed", detail: "<status or message>" }`
  - [x] B1.3 Verify B1 tests pass
    - Run only the 2–4 tests written in B1.1
    - Confirm endpoint handles both success and error paths

**Acceptance Criteria:**
- Valid request pipes back audio/mpeg stream with HTTP 200
- Missing `text` returns HTTP 400
- ElevenLabs upstream failure returns HTTP 502 with structured error body
- No API key is exposed in any response or log
- All B1.1 tests pass

---

### Group B2: Transcribe Endpoint — OpenAI Whisper Integration

**Dependencies:** Group A complete
**Agents:** 1

- [ ] B2.0 Complete transcription endpoint
  - [ ] B2.1 Write 2–4 focused tests for the transcribe endpoint
    - Test: `POST /api/transcribe` with a valid audio file upload returns HTTP 200 with `{ transcript: string }`
    - Test: `POST /api/transcribe` with no file attached returns HTTP 400
    - Test: `POST /api/transcribe` when Whisper returns an error returns HTTP 502 with `{ error: "Transcription failed", detail: "..." }`
    - Use a mock/stub for the OpenAI Whisper call in tests
  - [ ] B2.2 Implement `POST /api/transcribe` in `backend/routes/transcribe.js`
    - Accept `multipart/form-data` with field name `audio`; use `multer` (already wired in `server.js`) for file parsing
    - Return HTTP 400 if no file is present in the request
    - Forward audio file to OpenAI Whisper API: `POST https://api.openai.com/v1/audio/transcriptions`
    - Parameters: `model: "whisper-1"`, `language: "fr"`, file as `audio` multipart field
    - On success: return `{ transcript: string }`
    - On Whisper error: return HTTP 502 with `{ error: "Transcription failed", detail: "..." }`
    - Do not persist the audio file to disk; use `multer`'s in-memory storage (`multer.memoryStorage()`)
  - [ ] B2.3 Verify B2 tests pass
    - Run only the 2–4 tests written in B2.1

**Acceptance Criteria:**
- Valid multipart upload returns `{ transcript: string }` with HTTP 200
- Missing file returns HTTP 400
- Whisper upstream failure returns HTTP 502 with structured error body
- Audio data is never written to disk
- All B2.1 tests pass

---

### Group B3: Evaluate Endpoint — Claude AI Evaluation Integration

**Dependencies:** Group A complete
**Agents:** 1

- [x] B3.0 Complete evaluation endpoint
  - [x] B3.1 Write 3–5 focused tests for the evaluate endpoint
    - Test: `POST /api/evaluate` with `{ question, studentResponse }` returns HTTP 200 with all required JSON fields (`overallScore`, `communicationScore`, `rangeAccuracyScore`, `rawResponse`, `correctedAnswer`, `modelAnswer`, `comments`)
    - Test: `POST /api/evaluate` with `priorAttempts` array returns response that also includes `progressComparison` field
    - Test: `POST /api/evaluate` with missing `question` or `studentResponse` returns HTTP 400
    - Test: When Claude returns malformed JSON, endpoint returns HTTP 502 with `{ error: "Evaluation failed", detail: "..." }`
    - Test: `modelAnswer` field is `null` in response when `modelAnswer` is not supplied in request
    - Use a mock/stub for the Anthropic Claude SDK call in tests
  - [x] B3.2 Implement `POST /api/evaluate` in `backend/routes/evaluate.js`
    - Accept `{ question: string, studentResponse: string, modelAnswer?: string, priorAttempts?: Array<{response, overallScore, comments}> }`
    - Return HTTP 400 if `question` or `studentResponse` is absent
    - Construct a GCSE Edexcel speaking mark-scheme-aware system prompt for `claude-sonnet-4-6`:
      - Instruct Claude to act as a GCSE French examiner
      - Reference Edexcel speaking assessment criteria: Communication (0–5) and Range & Accuracy (0–9)
      - Instruct Claude to return a strict JSON object with exactly these fields: `overallScore` (int 0–9), `communicationScore` (int 0–5), `rangeAccuracyScore` (int 0–9), `rawResponse` (echo of student input), `correctedAnswer` (French), `modelAnswer` (French or null), `comments` (English)
      - If `priorAttempts` are included: instruct Claude to also return `progressComparison` (English paragraph comparing new attempt to most recent prior attempt)
      - If `modelAnswer` is absent in request: instruct Claude to evaluate contextually against GCSE band descriptors and omit or null the `modelAnswer` field
    - Call Anthropic API using the `@anthropic-ai/sdk` package
    - Parse Claude's response as JSON; validate all required fields are present
    - On Claude API error or malformed JSON: return HTTP 502 with `{ error: "Evaluation failed", detail: "..." }`
    - On success: return the parsed JSON object with HTTP 200
  - [x] B3.3 Verify B3 tests pass
    - Run only the 3–5 tests written in B3.1

**Acceptance Criteria:**
- Valid request returns HTTP 200 with all 7 required fields
- Request with `priorAttempts` returns response with `progressComparison` field
- Missing required fields return HTTP 400
- Claude upstream failure or malformed JSON returns HTTP 502
- `modelAnswer` is `null` when not supplied in request
- All B3.1 tests pass

---

### Group B4: Generate-Questions Endpoint — Claude AI Theme Generation

**Dependencies:** Group A complete
**Agents:** 1

- [x] B4.0 Complete question generation endpoint
  - [x] B4.1 Write 2–3 focused tests for the generate-questions endpoint
    - Test: `POST /api/generate-questions` with `{ theme: "home-abroad", count: 5 }` returns HTTP 200 with `{ questions: [...] }` where `questions` is an array of 5 strings
    - Test: `POST /api/generate-questions` with missing `theme` returns HTTP 400
    - Test: When Claude returns malformed JSON, endpoint returns HTTP 502 with `{ error: "Generation failed", detail: "..." }`
    - Use a mock/stub for the Anthropic Claude SDK call in tests
  - [x] B4.2 Implement `POST /api/generate-questions` in `backend/routes/generateQuestions.js`
    - Accept `{ theme: string, count: number }` JSON body; return HTTP 400 if `theme` is absent
    - Default `count` to 5 if not provided; cap at 10
    - Validate `theme` is one of the 6 valid Edexcel slugs: `home-abroad`, `education-employment`, `personal-life`, `world-around-us`, `social-activities`, `fitness-health`; return HTTP 400 for invalid theme
    - Construct a system prompt instructing `claude-sonnet-4-6` to generate `count` GCSE Edexcel general conversation questions in French for the given theme; questions must be varied, age-appropriate for Year 10–11, and formatted as a JSON array of strings
    - Call Anthropic API; parse response as JSON array
    - On success: return `{ questions: string[] }` with HTTP 200
    - On Claude error or malformed JSON: return HTTP 502 with `{ error: "Generation failed", detail: "..." }`
  - [x] B4.3 Verify B4 tests pass
    - Run only the 2–3 tests written in B4.1

**Acceptance Criteria:**
- Valid request returns `{ questions: string[] }` with the requested count
- Missing `theme` returns HTTP 400
- Invalid `theme` value returns HTTP 400
- Claude upstream failure returns HTTP 502
- All B4.1 tests pass

---

## Phase C — Frontend Feature Areas (Parallel after Phase B)

**All five groups in Phase C can be developed simultaneously by independent agents. Each group targets a distinct UI region or feature area. They share `frontend/app.js` but should coordinate on a shared data contract (the question bank array format and history entry schema from the spec) before splitting.**

**Pre-condition for Phase C agents:** Before any Phase C work begins, one agent must write the shared data structures into `frontend/app.js` — the 30-entry question bank array and the `HistoryEntry` / `QuestionHistoryMap` schema comments — so all agents reference the same shape. This takes roughly 15 minutes and gates all of Phase C.

---

### Group C1: Question Bank, Core UI Loop, and Feedback Panel

**Dependencies:** Phase B complete; shared data structures written into `frontend/app.js`
**Agents:** 1

- [x] C1.0 Complete core UI loop
  - [x] C1.1 Write 2–4 focused tests for core question flow
    - Test: Clicking "New Question" changes the displayed question text
    - Test: Submitting a typed response calls `POST /api/evaluate` with correct body shape
    - Test: Feedback panel becomes visible after a successful evaluate response and renders all 7 section headings
    - Test: `progressComparison` section is rendered only when the field is present in the evaluate response
  - [x] C1.2 Seed the 30-question question bank in `frontend/app.js`
    - Copy all 30 `{ q, answer, translation }` objects verbatim from the prototype file `french_oral_practice_v5.html` (lines 100–260)
    - Add `theme` field to each entry using the assignments defined in the spec (e.g. `home-abroad`, `personal-life`, `social-activities`)
    - Export / assign as `const SEEDED_QUESTIONS = [...]`
    - Set `let activeQuestions = [...SEEDED_QUESTIONS]` as the working question array
  - [x] C1.3 Implement "New Question" button and question display
    - On click: pick a random entry from `activeQuestions` using `Math.floor(Math.random() * activeQuestions.length)`
    - Render question text into the question card element
    - Store the selected question object as `currentQuestion`
    - Trigger TTS fetch (delegates to C2; for now, leave a stub call `playQuestionAudio(currentQuestion.q)`)
    - Clear the feedback panel on each new question
  - [x] C1.4 Implement text response submission and evaluate API call
    - On "Submit" click (text mode): read value from `<textarea>`; validate it is non-empty
    - Look up `frenchie_questionHistory[currentQuestion.q]` for prior attempts; pass up to 3 most recent as `priorAttempts`
    - POST to `/api/evaluate` with `{ question, studentResponse, modelAnswer, priorAttempts }`
    - Show a loading spinner on the Submit button during the request
    - On success: render all feedback sections; show feedback panel
    - On error: show inline error message below the submit button; keep feedback panel hidden
  - [x] C1.5 Implement feedback panel rendering
    - Render 7 sections in order: Overall Score, Communication Score, Range & Accuracy Score, Raw Response, Corrected Answer, Model Answer, Comments
    - Score badges: circular, colour-coded by band (red 0–3, amber 4–6, green 7–9), stamped visual style
    - Render "Progress vs last attempt" section (8th) only when `progressComparison` is present in response
    - Model Answer section: show "Not available" text if `modelAnswer` is null
    - Feedback panel is hidden by default (`display: none`) and shown after first submission
  - [x] C1.6 Wire up "Clear" button behaviour
    - On confirm: clear `frenchie_history` and `frenchie_questionHistory` from localStorage
    - Reset `activeQuestions` to `SEEDED_QUESTIONS`
    - Reset UI to initial state (clear feedback panel, clear response textarea, clear question card)
  - [x] C1.7 Verify C1 tests pass
    - Run only the 2–4 tests written in C1.1

**Acceptance Criteria:**
- "New Question" selects and displays a random question from the seeded bank
- Submit sends correct payload to `/api/evaluate`
- Feedback panel renders all 7 sections after successful evaluation
- `progressComparison` section appears only when the field exists in the response
- "Clear" button clears localStorage and resets the UI
- All C1.1 tests pass

---

### Group C2: Audio Recording (MediaRecorder) and TTS Playback

**Dependencies:** Phase B complete; shared data structures written; C1 must have stubbed `playQuestionAudio()`
**Agents:** 1

- [x] C2.0 Complete audio recording and TTS playback
  - [x] C2.1 Write 2–4 focused tests for audio features
    - Test: `playQuestionAudio(text)` fetches `POST /api/tts` and sets `<audio>` src to the returned blob URL
    - Test: Clicking "Replay" replays the audio element without re-fetching from `/api/tts`
    - Test: TTS fetch failure shows an inline error message and does not block the student from answering
    - Test: After recording stops, the audio blob is POSTed to `POST /api/transcribe` and the returned transcript is populated in the transcript display area
  - [x] C2.2 Implement TTS playback — `playQuestionAudio(text)`
  - [x] C2.3 Implement "Replay" button
  - [x] C2.4 Implement MediaRecorder audio recording
  - [x] C2.5 Implement ElevenLabs Scribe transcription after recording stops
  - [x] C2.6 Verify C2 tests pass

**Acceptance Criteria:**
- TTS audio plays automatically on each new question load
- Replay button replays audio without a new API call
- TTS failure shows an inline error and does not block answering
- Record button progresses through idle → recording → processing → idle states
- Transcription populates the transcript display area
- Transcription failure shows inline error and enables textarea fallback
- All C2.1 tests pass

---

### Group C3: Excel Upload Mode

**Dependencies:** Phase B complete; shared data structures written into `frontend/app.js`
**Agents:** 1

- [x] C3.0 Complete Excel upload mode
  - [x] C3.1 Write 2–3 focused tests for Excel upload
    - Test: Uploading a valid `.xlsx` file with two columns parses into question/answer pairs and updates `activeQuestions`
    - Test: Uploading a file with only column A (no column B) sets `answer` to `null` on each entry and shows mode indicator "Custom questions loaded (N questions)"
    - Test: Uploading a file with zero valid rows shows an inline error and does not update `activeQuestions`
  - [x] C3.2 Add SheetJS dependency
    - Load SheetJS via CDN in `frontend/index.html`: `<script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>`
  - [x] C3.3 Implement file input and drag-and-drop zone
    - Add a styled `<input type="file" accept=".xlsx,.xls">` element (or drag-and-drop zone) in the UI
    - On file selection (or drop): read the file as an ArrayBuffer; pass to SheetJS parser
  - [x] C3.4 Implement SheetJS parsing
    - Parse with `XLSX.read(arrayBuffer, { type: "array" })`
    - Read the first sheet; iterate rows starting from row 1 (row 0 assumed to be a header, or skip if first cell is non-French)
    - Column A = question string; Column B = model answer string (optional)
    - Build an array of `{ q: string, answer: string|null, translation: null, theme: "custom" }` objects
    - Reject (show inline error) if fewer than 1 valid question row is found
    - Reject (show inline error) if file type is not `.xlsx` or `.xls`
  - [x] C3.5 Activate uploaded question bank
    - On successful parse: set `activeQuestions` to the parsed array
    - Update mode indicator text to "Custom questions loaded (N questions)"
    - Auto-trigger "New Question" to load the first custom question
  - [x] C3.6 Implement "Return to default questions" link
    - Reset `activeQuestions` to `SEEDED_QUESTIONS`
    - Update mode indicator back to default label
    - Auto-trigger "New Question"
    - No page reload required
  - [x] C3.7 Verify C3 tests pass
    - Run only the 2–3 tests written in C3.1

**Acceptance Criteria:**
- Valid `.xlsx` upload replaces the active question bank
- Column B absence sets `answer` to null; Claude evaluates contextually (no model answer sent to `/api/evaluate`)
- Files with zero valid rows show an inline error
- "Return to default questions" reverts to seeded bank without a page reload
- Mode indicator reflects the active question source
- All C3.1 tests pass

---

### Group C4: AI Theme Mode — Topic Picker and Question Generation

**Dependencies:** Phase B complete; shared data structures written into `frontend/app.js`
**Agents:** 1

- [x] C4.0 Complete AI Theme Mode
  - [x] C4.1 Write 2–3 focused tests for AI Theme Mode
    - Test: Clicking a theme button calls `POST /api/generate-questions` with `{ theme, count: 5 }` and populates `activeQuestions` with the returned questions
    - Test: Mode indicator updates to the selected theme display label (e.g. "Home & Abroad")
    - Test: `POST /api/generate-questions` failure shows an inline error and leaves `activeQuestions` unchanged
  - [x] C4.2 Build the 6-theme selector UI
    - Render 6 buttons (or a styled dropdown) for the Edexcel themes:
      - `home-abroad` → "Home & Abroad"
      - `education-employment` → "Education and Employment"
      - `personal-life` → "Personal Life and Relationships"
      - `world-around-us` → "The World Around Us"
      - `social-activities` → "Social Activities"
      - `fitness-health` → "Fitness & Health"
    - Active theme button has a visually distinct pressed/selected state
    - No client-side caching of generated questions; every click triggers a fresh API call
  - [x] C4.3 Implement theme selection handler
    - On theme button click: show a loading indicator on the button; disable all theme buttons during request
    - `POST /api/generate-questions` with `{ theme: slug, count: 5 }`
    - On success: map returned `questions` array to `{ q: string, answer: null, translation: null, theme: slug }` objects; set as `activeQuestions`
    - Update mode indicator to the theme display label
    - Re-enable theme buttons; remove loading indicator
    - Auto-trigger "New Question" to load the first generated question
    - On failure: show inline error "Could not generate questions — please try again"; leave `activeQuestions` unchanged
  - [x] C4.4 Verify C4 tests pass
    - Run only the 2–3 tests written in C4.1

**Acceptance Criteria:**
- Each theme button triggers a fresh question generation request
- Generated questions replace the active question bank for the session
- Mode indicator updates to the selected theme name
- API failure shows inline error without changing `activeQuestions`
- All C4.1 tests pass

---

### Group C5: History Slide-Out Panel and localStorage Persistence

**Dependencies:** Phase B complete; shared data structures written into `frontend/app.js`
**Agents:** 1

- [x] C5.0 Complete history panel and persistence
  - [x] C5.1 Write 3–5 focused tests for history persistence and panel
    - Test: After a successful evaluation, a new entry is appended to `frenchie_history` in localStorage with all required fields (id, question, userResponse, overallScore, communicationScore, rangeAccuracyScore, correctedAnswer, modelAnswer, comments, timestamp, source, theme)
    - Test: On page load, entries older than 48 hours are pruned from localStorage
    - Test: If the most recent entry is older than 48 hours on page load, both keys are deleted
    - Test: The history panel renders entries most-recent-first, showing question, response, score badge, timestamp, and first 100 characters of comments
    - Test: A repeat attempt on the same question renders a delta badge ("+2" or "-1") next to the score in the history panel
  - [x] C5.2 Implement localStorage save and load
    - `saveHistory(entry)`: load `frenchie_history` from localStorage; append the new entry; save back via `JSON.stringify`
    - `saveQuestionHistory(question, response, overallScore, timestamp)`: load `frenchie_questionHistory`; push `{ response, overallScore, timestamp }` to the array keyed by `question`; save back
    - `loadHistory()`: read `frenchie_history`; run TTL check — if most recent entry timestamp is older than 48 hours, delete both keys and return `[]`; prune individual entries older than 48 hours; return remaining entries
    - `loadQuestionHistory()`: read `frenchie_questionHistory`; return the parsed object (or `{}` if absent/corrupt)
    - Generate UUIDs for history entry IDs using `crypto.randomUUID()` (available in all modern browsers)
  - [x] C5.3 Wire history save into the evaluate submission flow
    - After a successful evaluate response (wired via a callback or event from C1): call `saveHistory(entry)` and `saveQuestionHistory(...)`
    - `source` field: set to `"seeded"` if `activeQuestions === SEEDED_QUESTIONS`, `"uploaded"` if from Excel, `"ai-generated"` if from AI Theme Mode
    - `theme` field: use `currentQuestion.theme` or `"custom"` for uploaded questions
    - `progressComparison`: include if present in the evaluate response
  - [x] C5.4 Implement the history slide-out panel HTML and CSS
    - Fixed panel on the right edge of the viewport
    - Max width `33vw`, min width `320px`
    - Slides in/out using CSS `transform: translateX(100%)` / `translateX(0)` with a CSS transition
    - Panel sits above main content as an overlay (no layout shift); use `position: fixed` and a high `z-index`
    - Slightly darker parchment background texture than the main area
    - Subtle left-edge box shadow indicating depth
    - Vertically scrollable content
    - "X" close button in the top-right of the panel
    - Empty state: "No practice history yet" centred in the panel
  - [x] C5.5 Implement history panel open/close logic
    - "History" button (fixed to right edge of viewport, visible at all times) toggles the panel open
    - Clicking outside the panel (on the main content overlay) closes the panel
    - "X" button inside the panel closes the panel
  - [x] C5.6 Implement history entry rendering
    - Read from localStorage via `loadHistory()` on each panel open
    - Render entries most-recent-first
    - Each entry shows: question text, student response (italic), overall score badge (colour-coded), locale timestamp string, first 100 characters of comments with an expand toggle
    - Delta badge for repeat questions: compare the current entry's `overallScore` against the immediately prior entry's `overallScore` for the same question (look up `frenchie_questionHistory`); render "+N" in green or "-N" in red as appropriate; no badge if it is the first attempt
  - [x] C5.7 Verify C5 tests pass
    - Run only the 3–5 tests written in C5.1

**Acceptance Criteria:**
- Every successful submission appends a correctly shaped entry to `frenchie_history` in localStorage
- 48-hour TTL pruning works correctly on page load
- History panel opens and closes with slide animation
- Entries render most-recent-first with all required fields
- Delta badges appear on repeat questions with correct sign and colour
- Clicking outside the panel closes it
- Empty state renders when no history exists
- All C5.1 tests pass

---

## Phase D — Integration, Styling, Polish, and Deployment (Sequential after Phase C)

**Phase D must happen after all Phase C groups are complete. Execute sequentially or with light parallelism between D1 (styling) and D2 (wiring), as both teams must communicate on class names and element IDs.**

---

### Group D1: Skeuomorphic "Frenchie" UI Design and Styling

**Dependencies:** All Phase C groups complete (HTML structure is stable)
**Agents:** 1

- [x] D1.0 Complete skeuomorphic design and styling
  - [x] D1.1 Write 2–3 focused tests for design/style
    - Test: The page renders the "Frenchie" wordmark in the header
    - Test: Score badges render with the correct colour class for each band (red 0–3, amber 4–6, green 7–9)
    - Test: The record button has the `recording` CSS class applied while `MediaRecorder` state is `recording`
  - [x] D1.2 Set up typography and global design tokens in `styles.css`
    - Import Google Fonts: `Playfair Display` (headings / wordmark) and `Inter` (body, labels)
    - Define CSS custom properties (variables):
      - `--bg-cream: #FAF7F0`
      - `--french-blue: #0055A4`
      - `--french-red: #EF4135`
      - `--ink: #2C2C2C`
      - `--parchment-dark: #EDE7D9` (history panel background)
      - `--shadow-raised: 2px 4px 8px rgba(0,0,0,0.15)`
      - `--shadow-inset: inset 1px 2px 4px rgba(0,0,0,0.2)`
    - Set `body` background to `--bg-cream`; optionally add a subtle paper texture via a CSS `background-image` noise pattern or `::before` pseudo-element
  - [x] D1.3 Style the header and "Frenchie" wordmark
    - Render the "Frenchie" wordmark in `Playfair Display`, French blue, large size
    - Consider adding a small decorative Eiffel Tower or beret Unicode character (e.g. "🗼") — only if the user approves; otherwise use a typographic flourish
    - Header has a light bottom border in French blue
  - [x] D1.4 Style the question card
    - Off-white (`#FFFEF8`) background with a slight drop shadow
    - Faint ruled-line texture (CSS `repeating-linear-gradient` with a very light grey line every ~1.5rem)
    - Slightly rounded corners (`border-radius: 6px`)
    - Question text centred, slightly larger font size, `Playfair Display` or a semi-serif style
  - [x] D1.5 Style buttons (raised/pressed skeuomorphic effect)
    - Default state: `box-shadow: var(--shadow-raised)`, background slightly lighter than surrounding
    - `:active` state: `box-shadow: var(--shadow-inset)`, slight downward `transform: translateY(1px)`
    - Button text: slightly bold, small-caps for labels
    - Primary action buttons (Submit, New Question): French blue background, white text
    - Destructive button (Clear): French red background, white text
    - Secondary buttons (Replay, History): cream background, ink text
  - [x] D1.6 Style the mode toggle (Text / Speech)
    - Physical tab/toggle metaphor: two adjacent tabs with a shared border
    - Active tab: raised appearance, French blue text, white background
    - Inactive tab: recessed, grey text, slightly darker background
  - [x] D1.7 Style score badges in the feedback panel
    - Circular badge: `border-radius: 50%`, fixed dimensions (~48px)
    - Band colours: red (`#C0392B`) for 0–3, amber (`#E67E22`) for 4–6, green (`#27AE60`) for 7–9
    - Large bold number centred in the badge; outer ring or subtle shadow for wax-seal effect
  - [x] D1.8 Style the history slide-out panel
    - Slightly darker parchment background (`--parchment-dark`)
    - Subtle left-edge box shadow: `box-shadow: -4px 0 16px rgba(0,0,0,0.18)`
    - History entries separated by a thin ruled line
    - Delta badges: `+N` in green (`#27AE60`), `-N` in red (`#C0392B`), pill shape
  - [x] D1.9 Implement responsive layout
    - Mobile (< 768px): single-column layout; question card, toggle, and response area stack vertically; history panel takes `min(320px, 90vw)` width
    - Tablet (768px–1024px): main content centred at ~700px max width
    - Desktop (> 1024px): main content centred, max 800px; history panel max `33vw`
  - [x] D1.10 Verify D1 tests pass
    - Run only the 2–3 tests written in D1.1

**Acceptance Criteria:**
- "Frenchie" wordmark renders in header with Playfair Display font
- Background has warm cream/parchment tone
- Buttons have visually distinct raised (default) and pressed (active) states
- Score badges are circular and colour-coded by band
- Mode toggle resembles a physical tab/switch
- History panel has darker parchment texture and left-edge shadow
- Delta badges render with correct colour
- Layout is responsive across mobile, tablet, desktop
- All D1.1 tests pass

---

### Group D2: End-to-End Wiring and Integration

**Dependencies:** All Phase C groups complete; D1 can run in parallel with D2 if teams coordinate on element IDs
**Agents:** 1

- [x] D2.0 Complete end-to-end integration
  - [x] D2.1 Write 3–5 end-to-end integration tests
    - Test: Full flow — load page, click "New Question", audio plays, type a response, click "Submit", feedback panel shows 7 sections
    - Test: Speech flow — click "Record", stop recording, transcript appears, click "Submit", feedback panel shows 7 sections
    - Test: Excel upload flow — upload a valid `.xlsx`, a new question is selected, submit a response, evaluate is called with `modelAnswer` from the uploaded file
    - Test: AI Theme Mode flow — select a theme, questions are generated, a question is displayed, submit a response, evaluate is called with no `modelAnswer`
    - Test: History panel shows the most recent entry after a successful submission, with correct score badge
  - [x] D2.2 Integrate C1 (core loop) with C2 (audio/TTS)
    - Replace the `playQuestionAudio()` stub from C1 with the real implementation from C2
    - Ensure "New Question" triggers TTS fetch and playback
    - Ensure speech mode submit path uses the transcript from C2 as `studentResponse`
  - [x] D2.3 Integrate C1 (core loop) with C5 (history persistence)
    - After each successful evaluate response: call `saveHistory(entry)` and `saveQuestionHistory(...)` from C5
    - On "Clear" button: also call `loadHistory()` / refresh the history panel
    - On page load: call `loadHistory()` to initialise history (TTL check runs automatically)
  - [x] D2.4 Integrate C3 (Excel upload) with C1 (core loop)
    - Confirm `activeQuestions` assignment in C3 is read by C1's "New Question" logic
    - Confirm `answer` field from uploaded questions is passed as `modelAnswer` to evaluate (or omitted if null)
    - Confirm "Return to default questions" triggers C1 to reload from `SEEDED_QUESTIONS`
  - [x] D2.5 Integrate C4 (AI Theme Mode) with C1 (core loop)
    - Confirm `activeQuestions` assignment in C4 is read by C1's "New Question" logic
    - Confirm no `modelAnswer` is passed to evaluate for AI-generated questions
  - [x] D2.6 Verify mode indicator state machine
    - Default: "Practising with 30 seeded questions"
    - After Excel upload: "Custom questions loaded (N questions)"
    - After theme selection: "AI Theme: [Theme Display Label]"
    - After "Return to default questions": reverts to default label
  - [x] D2.7 Verify D2 integration tests pass
    - Run only the 3–5 tests written in D2.1
    - Do not run the full test suite

**Acceptance Criteria:**
- Full text-response flow works end-to-end: question → TTS → typed answer → evaluate → feedback panel
- Full speech-response flow works end-to-end: question → TTS → record → transcribe → evaluate → feedback panel
- Excel upload replaces question bank; evaluate receives correct `modelAnswer` from uploaded file
- AI Theme Mode replaces question bank; evaluate receives no `modelAnswer`
- History entry is saved after each submission; history panel reflects latest state
- Mode indicator always reflects the current question source
- All D2.1 integration tests pass

---

### Group D3: Test Review, Gap Analysis, and Final Verification

**Dependencies:** Groups D1 and D2 complete
**Agents:** 1

- [x] D3.0 Complete test review and final verification
  - [x] D3.1 Inventory all tests written across all prior groups
    - A.1: 2–4 tests (server, health, CORS, static serving)
    - B1.1: 2–4 tests (TTS endpoint)
    - B2.1: 2–4 tests (transcribe endpoint)
    - B3.1: 3–5 tests (evaluate endpoint)
    - B4.1: 2–3 tests (generate-questions endpoint)
    - C1.1: 2–4 tests (core UI loop)
    - C2.1: 2–4 tests (audio/TTS)
    - C3.1: 2–3 tests (Excel upload)
    - C4.1: 2–3 tests (AI Theme Mode)
    - C5.1: 3–5 tests (history persistence)
    - D1.1: 2–3 tests (styling)
    - D2.1: 3–5 tests (end-to-end integration)
    - Estimated total: 29–51 tests
  - [x] D3.2 Identify critical gaps for this feature only
    - Focus exclusively on gaps in the Frenchie feature requirements (not the full test suite)
    - Look for untested critical paths: 48h TTL edge cases, CORS rejection, `priorAttempts` being capped at 3, mode switching mid-recording
    - Do not add tests for edge cases, performance, or accessibility unless a business-critical user workflow is at risk
  - [x] D3.3 Write up to 10 additional strategic tests to fill gaps
    - Prioritise integration and cross-group workflows
    - Examples of high-value gap tests:
      - TTL: an entry timestamped exactly 48h+1s is pruned on page load
      - `priorAttempts` cap: only 3 most recent attempts are sent even if 5 exist in history
      - Mode switch mid-recording: transcript is correctly preserved in textarea when switching to text mode
      - Uploaded file with no header row still parses correctly
      - Evaluate error does not wipe the current question or response
    - Cap at 10 new tests maximum
  - [x] D3.4 Run all feature-specific tests
    - Run all tests from D3.1 plus any added in D3.3
    - Expected total: approximately 29–61 tests
    - Do not run the entire application test suite
    - All tests must pass
  - [x] D3.5 Manual smoke test checklist
    - Start the server locally; confirm `GET /health` responds
    - Load the frontend; confirm "Frenchie" wordmark and question card render
    - Click "New Question"; confirm TTS audio plays
    - Type a response and submit; confirm feedback panel renders all 7 sections with scores
    - Click "Record", speak a sentence in French, stop; confirm transcript appears; submit; confirm feedback
    - Upload a sample `.xlsx` file; confirm question bank switches; confirm mode indicator updates
    - Select an AI theme; confirm questions are generated and displayed
    - Submit two answers to the same question; confirm delta badge appears in history panel
    - Confirm "Clear" button wipes history and resets UI
    - Open history panel; confirm slide-in animation and most-recent-first ordering
    - Resize browser to mobile width; confirm responsive layout

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 29–61 total)
- No more than 10 new tests added in D3.3
- Manual smoke test checklist passes without errors
- No API keys appear in any client-side code, response, or browser console

---

## Execution Order Summary

| Phase | Groups | Can Parallelise? | Depends On |
|-------|--------|-----------------|------------|
| A | A | No (sequential) | Nothing |
| B | B1, B2, B3, B4 | Yes — all 4 in parallel | Phase A |
| C | C1, C2, C3, C4, C5 | Yes — all 5 in parallel (after shared data contract written) | Phase B |
| D | D1 + D2 (light parallel), then D3 | D1 and D2 can overlap; D3 must be last | Phase C |

**Recommended agent allocation:**
- Phase A: 1 agent
- Phase B: 4 agents simultaneously (B1, B2, B3, B4)
- Phase C: 5 agents simultaneously (C1, C2, C3, C4, C5) — one agent writes shared data structures first (~15 min), then all 5 start
- Phase D: 2 agents (D1 and D2 in parallel), then 1 agent for D3
