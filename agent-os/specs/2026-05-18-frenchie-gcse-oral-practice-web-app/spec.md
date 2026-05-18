# Specification: Frenchie GCSE French Oral Practice Web App

## Goal

Build a single-user web app called "Frenchie" that helps UK GCSE French students (Year 10–11) practise their speaking exam independently, replacing heuristic scoring and unreliable browser speech APIs with Claude AI evaluation, ElevenLabs TTS, and Whisper transcription — all proxied through a Node/Express backend.

## User Stories

- As a GCSE French student, I want to hear each question spoken in natural French, record or type my answer, and receive structured AI feedback in English so that I know exactly what to improve before my speaking exam.
- As a parent or student, I want to upload a custom Excel question sheet or pick an Edexcel topic so that practice mirrors the actual exam content being studied in school.
- As a returning student, I want to see how my latest attempt compares to my previous attempts on the same question so that I can measure real progress over time.

## Specific Requirements

**Project Structure and Architecture**
- Vanilla HTML/CSS/JS frontend — no framework, no build step, served as static files
- Node.js + Express backend acts solely as a proxy/API gateway; all API keys are server-side only
- File layout: `frontend/index.html`, `frontend/app.js`, `frontend/styles.css`; `backend/server.js`, `backend/routes/`
- Backend endpoints: `POST /api/tts`, `POST /api/transcribe`, `POST /api/evaluate`, `POST /api/compare`, `POST /api/generate-questions`
- All secrets stored in `.env` (never committed); Railway environment variables used in production
- CORS configured to allow only the frontend origin
- A `GET /api/health` endpoint returns `{ status: "ok" }` for liveness checks

**Seeded Question Bank (30 Q&As)**
- Hardcoded as a JS array in `frontend/app.js` — no database required
- Each entry has four fields: `q` (French question string), `answer` (French model answer string), `translation` (English translation of the model answer), `theme` (one of the 6 Edexcel theme slugs below)
- The 30 questions extracted verbatim from the prototype and their theme assignments:
  - `home-abroad`: "Décris-moi la ville/la région où tu habites.", "Quelle est la différence entre vivre à la campagne et vivre en ville?...", "Où aimerais-tu habiter plus tard?...", "Comment est-ce que la région s'est améliorée pendant les dix dernières années?", "Décris-moi ta maison, ton jardin, etc.", "Est-ce que tu as ta propre chambre? Décris-la-moi.", "Comment serait ta maison idéale et où serait-elle?"
  - `home-abroad` (travel sub-topic): "Préfères-tu passer les vacances à la campagne, au bord de la mer ou à la montagne?...", "Préfères-tu les voyages organisés ou indépendants?", "Pourquoi est-ce que les voyages à l'étranger sont importants?", "Qu'est-ce que tu as fait pendant les dernières vacances?", "Est-ce que tu as déjà passé des vacances en France?...", "Que vas-tu faire pour les prochaines vacances?", "Où aimerais-tu partir en vacances si tu avais beaucoup d'argent?"
  - `home-abroad` (culture sub-topic): "Quelles traditions françaises connais-tu?...", "Quelles traditions suivez-vous dans ta famille?"
  - `personal-life`: "Tu as une routine journalière? Et le weekend c'est différent?", "Quelle serait ta routine idéale?", "À ton avis, pourquoi est-il important que les adolescents aident à la maison?", "Qu'est-ce que tu fais à la dernière fois pour aider à la maison?", "Est-ce que les tâches ménagères sont partagées équitablement chez toi?", "Quelles sont les caractéristiques d'un vrai ami selon toi?", "Décris-moi ton/ta meilleur(e) ami(e).", "Comment est-ce que tu t'entends avec tes parents?...", "Qu'est-ce qui est le plus important pour toi, ta famille ou tes amis?...", "Comment serait la famille idéale?"
  - `home-abroad` (transport sub-topic): "Quel mode de transport utilises-tu et quand/pourquoi?", "Quels sont les avantages et les inconvénients?", "Comment sont les transports en commun dans ta ville...?"
  - `social-activities`: "Préfères-tu lire ou regarder un film?...", "Quel est le dernier livre que tu as lu?", "Raconte-moi la dernière fois que tu es allé au cinéma..."
- The 6 Edexcel theme slugs and display labels: `home-abroad` → "Home & Abroad", `education-employment` → "Education and Employment", `personal-life` → "Personal Life and Relationships", `world-around-us` → "The World Around Us", `social-activities` → "Social Activities", `fitness-health` → "Fitness & Health"
- Random selection on "New Question" button press — `Math.random()` over the active question array (seeded bank or loaded bank)

**ElevenLabs TTS for French Audio**
- `POST /api/tts` accepts `{ text: string }` and proxies to ElevenLabs; returns audio as `audio/mpeg` stream
- Backend selects a fixed ElevenLabs voice ID appropriate for French (configured via `ELEVENLABS_VOICE_ID` env var)
- Frontend fetches `/api/tts` on every new question load and plays the returned audio blob via an HTML5 `<audio>` element
- A "Replay" button allows the student to replay the audio at any time without re-fetching
- If the TTS request fails, show an inline error message; do not block the student from answering

**Audio Recording and Whisper Transcription**
- In speech mode, the frontend uses `MediaRecorder` to record audio into an in-memory blob (preferred MIME type: `audio/webm;codecs=opus`, falling back to `audio/ogg` or `audio/mp4` depending on browser support)
- On "Stop Recording", the blob is POSTed as `multipart/form-data` to `POST /api/transcribe`
- The backend forwards the audio file to OpenAI's Whisper API (`whisper-1` model) with `language: "fr"` and returns `{ transcript: string }`
- The returned transcript is displayed in the speech display area and treated identically to typed text for submission
- Visual states for the record button: idle (microphone icon), recording (pulsing red stop icon), processing (spinner)
- If transcription fails, show an inline error and allow the student to type manually instead

**Text / Speech Response Toggle**
- A two-button mode toggle sits below the question card: "Text response" and "Speech response"
- In text mode: a `<textarea>` is shown for typed French input; the record button and transcript display are hidden
- In speech mode: the `<textarea>` is hidden; a transcript display area and record/stop button are shown
- Mode can be switched at any time including after recording; switching to text mode after a recording retains the transcript in the textarea
- The active mode button has a visually distinct pressed/active state consistent with the skeuomorphic design

**Claude AI Evaluation (7-Section Feedback)**
- `POST /api/evaluate` accepts `{ question, studentResponse, modelAnswer?: string, priorAttempts?: Array<{response, feedback}> }`
- The backend sends a structured prompt to `claude-sonnet-4-6` with a GCSE Edexcel speaking mark-scheme-aware system prompt covering: communication (relevance, fluency, breadth of response), range and accuracy of language (grammar, vocabulary, tense variety), and pronunciation approximation (inferred from transcribed text patterns)
- Claude must return a valid JSON object with exactly these fields: `overallScore` (integer 0–9, matching GCSE band descriptors), `communicationScore` (integer 0–5), `rangeAccuracyScore` (integer 0–9), `rawResponse` (the student's original response, echoed back), `correctedAnswer` (French — corrected version of the student's response), `modelAnswer` (French — the seeded or uploaded model answer; omit or null if unavailable and no context is sufficient), `comments` (English — plain-language explanation of the scores, specific errors, and what to improve)
- All fields except `correctedAnswer` and `modelAnswer` are displayed in English
- If `modelAnswer` is absent (AI Theme Mode with no uploaded answer), Claude evaluates contextually against GCSE band descriptors and omits the `modelAnswer` field in the response
- The feedback panel renders all 7 sections with clear labelled headings; section layout: Overall Score → Communication Score → Range & Accuracy Score → Raw Response → Corrected Answer → Model Answer → Comments
- Feedback panel is hidden until a submission is made; it replaces itself on each new submission

**Excel Upload Mode**
- A file input (styled as a drag-and-drop zone or button) accepts `.xlsx` and `.xls` files
- SheetJS (`xlsx` CDN) parses the file client-side; reads the first sheet, expects column A = question (French), column B = model answer (French, optional)
- If column B is entirely empty or absent, the app uses contextual Claude evaluation (no model answer passed to `/api/evaluate`)
- On successful parse, the uploaded Q&A pairs replace the seeded question bank for the session; the mode indicator updates to show "Custom questions loaded (N questions)"
- Validation: reject files with fewer than 1 valid question row; show an inline error message for parse failures or unsupported file types
- A "Return to default questions" link reverts to the seeded bank without a page reload

**AI Theme Mode**
- A theme selector UI (6 buttons or a dropdown) lets the student pick one of the 6 Edexcel topics
- On selection, the frontend calls `POST /api/generate-questions` with `{ theme: string, count: 5 }`
- The backend prompts `claude-sonnet-4-6` to generate 5 GCSE-style general conversation questions for that theme in French, returned as a JSON array of strings (no model answers)
- Generated questions replace the active question bank for the session; the mode indicator updates to show the selected theme name
- Questions are generated fresh each time the theme button is clicked; there is no client-side caching of generated questions
- Evaluation of responses to generated questions uses contextual Claude evaluation (no model answer)

**History Slide-Out Panel**
- A "History" button or tab (fixed to the right edge of the viewport) opens the slide-out panel
- The panel slides in from the right as an overlay (CSS `transform: translateX`) — it does not push or resize the main content area
- Maximum panel width: `33vw` (one-third of viewport width); minimum: `320px`; the panel is scrollable vertically
- Each history entry shows: question text, the student's response (italic), overall score badge, timestamp (locale string), and the comments snippet (first 100 characters, expandable)
- Entries are listed most-recent-first
- A "Clear" button inside the panel (and a standalone "Clear" button on the main UI) triggers `confirm()` before wiping localStorage keys `frenchie_history` and `frenchie_questionHistory`
- An "X" or close button collapses the panel back to the right; clicking outside the panel also closes it
- Empty state: "No practice history yet" centred in the panel
- Repeat attempts on the same question show a delta badge (e.g. "+2" in green or "-1" in red) next to the score

**History Persistence (localStorage, 48h TTL)**
- On every submission, append to `frenchie_history` (array of history entry objects) and `frenchie_questionHistory` (object keyed by question text, value is array of `{ response, score, timestamp }`)
- Each history entry object: `{ id: uuid-v4, question, userResponse, overallScore, communicationScore, rangeAccuracyScore, correctedAnswer, modelAnswer, comments, timestamp: ISO8601, source: "seeded"|"uploaded"|"ai-generated", theme }`
- On page load: read `frenchie_history` from localStorage; if the most recent entry's `timestamp` is older than 48 hours, delete both keys and start fresh; if any entry timestamp is stale, prune only that entry
- On browser refresh: the page load check handles the 48h TTL; the history panel is rendered from whatever remains in localStorage after the TTL check
- The "Clear" button deletes both localStorage keys immediately without TTL logic

**Repeat Question Performance Comparison**
- Before calling `/api/evaluate`, the frontend checks `frenchie_questionHistory` for prior attempts on the current question (match by exact question string)
- If one or more prior attempts exist, they are included in the `POST /api/evaluate` body as `priorAttempts: [ { response, overallScore, comments } ]` (most recent first, capped at 3 prior attempts)
- The backend includes the prior attempts in the Claude prompt and asks Claude to add a `progressComparison` field to the JSON response: a plain-English paragraph comparing the new attempt to the most recent prior attempt (improvements, regressions, patterns)
- The `progressComparison` section is rendered as an 8th section in the feedback panel, labelled "Progress vs last attempt", shown only when prior attempts exist
- The history entry for a repeat attempt stores `progressComparison` alongside the standard fields

**Skeuomorphic "Frenchie" UI Design**
- Overall aesthetic: textured paper or parchment background, subtle drop shadows, slightly rounded corners, embossed/debossed button effects — evokes a physical French exercise book
- Colour palette: warm cream/ivory (`#FAF7F0`) background, French blue (`#0055A4`) and red (`#EF4135`) accent colours (French flag), dark ink (`#2C2C2C`) for text
- Typography: a serif or semi-serif heading font for "Frenchie" branding (e.g. Google Fonts `Playfair Display`); a clean sans-serif (`Inter` or system font) for body text and UI labels
- The "Frenchie" wordmark appears in the top-left header; consider a small Eiffel Tower or beret icon alongside it
- Question card: styled as a slightly off-white index card with a faint ruled-line texture or subtle border; the question text is centred and slightly larger
- Buttons use a pressed/raised effect: `box-shadow` on the unpressed state, reduced/inset shadow on `:active`; button text uses a slightly bold serif or small-caps style
- Score badges in the feedback panel use a stamped or wax-seal visual metaphor (circular badge, bold number, colour-coded by band: red 0–3, amber 4–6, green 7–9)
- The history slide-out panel has a slightly darker parchment texture than the main area, with a subtle left-edge shadow indicating it sits above the content
- The mode toggle (Text / Speech) uses a physical toggle-switch or tab metaphor rather than flat buttons

## API Contracts

**POST /api/tts**
- Request: `{ "text": "Décris-moi la ville où tu habites." }`
- Response: binary `audio/mpeg` stream (pipe ElevenLabs response directly)
- Error: `{ "error": "TTS failed", "detail": "..." }` with HTTP 502

**POST /api/transcribe**
- Request: `multipart/form-data` with field `audio` (audio blob)
- Response: `{ "transcript": "J'habite à Londres..." }`
- Error: `{ "error": "Transcription failed", "detail": "..." }` with HTTP 502

**POST /api/evaluate**
- Request: `{ "question": "...", "studentResponse": "...", "modelAnswer": "..." (optional), "priorAttempts": [...] (optional) }`
- Response: `{ "overallScore": 7, "communicationScore": 4, "rangeAccuracyScore": 7, "rawResponse": "...", "correctedAnswer": "...", "modelAnswer": "..." | null, "comments": "...", "progressComparison": "..." (only if priorAttempts provided) }`
- Error: `{ "error": "Evaluation failed", "detail": "..." }` with HTTP 502

**POST /api/generate-questions**
- Request: `{ "theme": "home-abroad", "count": 5 }`
- Response: `{ "questions": ["Décris-moi...", "Où aimerais-tu..."] }`
- Error: `{ "error": "Generation failed", "detail": "..." }` with HTTP 502

**POST /api/compare** _(merged into /api/evaluate via priorAttempts field; this endpoint is not needed as a separate route)_

**GET /api/health**
- Response: `{ "status": "ok" }`

## Data Models

**Question Bank Entry (in-memory JS object)**
```
{
  q: string,           // French question text
  answer: string,      // French model answer
  translation: string, // English translation of model answer
  theme: string        // Edexcel theme slug
}
```

**History Entry (localStorage array item)**
```
{
  id: string,                // UUIDv4
  question: string,          // French question text
  userResponse: string,      // Raw student response (typed or transcribed)
  overallScore: number,      // 0–9
  communicationScore: number,// 0–5
  rangeAccuracyScore: number,// 0–9
  correctedAnswer: string,   // French
  modelAnswer: string|null,  // French or null
  comments: string,          // English
  progressComparison: string|null, // English or null
  timestamp: string,         // ISO8601
  source: string,            // "seeded" | "uploaded" | "ai-generated"
  theme: string              // Edexcel theme slug or "custom"
}
```

**Question History Map (localStorage object)**
```
{
  [questionText: string]: [
    { response: string, overallScore: number, timestamp: string }
  ]
}
```

## Existing Code to Leverage

**30-question Q&A array from `french_oral_practice_v5.html`**
- Copy verbatim: all 30 `{ q, answer, translation }` objects from the `questions` array (lines 100–260 of the prototype); add a `theme` field to each using the assignments defined in the question bank requirement above
- These are production-quality French Q&A pairs vetted for GCSE relevance — do not modify the French text

**localStorage save/load pattern from prototype**
- The prototype's `saveToStorage()` / `loadFromStorage()` pattern (using `JSON.stringify` / `JSON.parse` on two keys) is the correct pattern to replicate; replace the key names with `frenchie_history` and `frenchie_questionHistory`; add the 48h TTL check on load by comparing `Date.now()` against the oldest entry's parsed ISO timestamp

**`questionHistory` map keyed by question text**
- The prototype's `questionHistory` object — a map from question string to array of attempt objects — is the right data structure for repeat detection; replicate this pattern in the new persistence layer

**UI information architecture from prototype**
- The prototype's layout regions — question display card, mode toggle row, response area, feedback panel, button group (New Question / Submit / Clear), and history panel — define the correct information hierarchy; preserve this layout even though the visual style changes completely to skeuomorphic

**Feedback section structure from prototype**
- The prototype's feedback HTML pattern (`feedback-score` → `feedback-section` → `feedback-label` + `feedback-text`) is a good template for the 7-section AI feedback panel; extend it with the additional Claude-specific sections (corrected answer, model answer, progress comparison)

## Out of Scope

- User accounts, authentication, or login of any kind
- Multi-student profiles or per-student data isolation
- Teacher dashboard, admin interface, or progress reports for teachers
- Native mobile app (iOS or Android)
- Gamification: streaks, badges, XP, leaderboards
- Persistent server-side database or history storage
- Social features: sharing results, comparing with friends
- Offline mode or service workers
- Role-play and photo-card exam formats (general conversation only in this spec)
- Real-time pronunciation scoring (phoneme-level analysis beyond what Whisper transcription implies)
- Multiple exam boards beyond Edexcel (no AQA or OCR topic sets)
- Automated regression tests or CI pipeline
