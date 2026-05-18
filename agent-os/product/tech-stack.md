# Tech Stack

## Frontend

| Layer | Choice | Notes |
|---|---|---|
| Framework | Vanilla HTML/CSS/JS | No build step, no framework overhead — keeps the project simple for a single-user tool and easy to hand off or modify |
| Excel Parsing | SheetJS (xlsx) | Client-side parsing of two-column question sheets; no server round-trip needed |
| Audio Capture | MediaRecorder API | Cross-browser (Chrome, Safari, Firefox) audio recording; replaces buggy webkitSpeechRecognition |
| Audio Playback | HTML5 `<audio>` | Streams TTS audio returned from the backend |
| State / Persistence | localStorage | Stores practice history (Q&A attempts, scores, feedback, timestamps) without requiring a database |

## Backend

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node.js | Consistent language across frontend and backend; large ecosystem |
| Framework | Express | Minimal, well-understood HTTP server; sufficient for a proxy/API-gateway role |
| Environment Config | dotenv | API keys stored in `.env`, never exposed to the client |

## External APIs

| Service | Purpose | Notes |
|---|---|---|
| Anthropic Claude (`claude-sonnet-4-6`) | Response evaluation, feedback generation, themed question generation, repeat performance comparison | Proxied through the Express backend to keep the API key server-side |
| ElevenLabs | High-quality French text-to-speech | Proxied through the Express backend; audio streamed back to the client |
| OpenAI Whisper | Speech-to-text transcription of recorded audio answers | Proxied through the Express backend; accepts audio blob, returns transcript |

## Deployment

| Layer | Choice | Notes |
|---|---|---|
| Hosting | Railway | Single-service deployment serving both static frontend and Express backend; matches existing Mintclip project setup |
| Secrets | Railway Environment Variables | API keys injected at deploy time, never committed to the repository |

## Development Tooling

| Tool | Purpose |
|---|---|
| ESLint | JavaScript linting |
| Prettier | Code formatting |
| Git + GitHub | Version control |
| bd (beads) | Issue tracking |
