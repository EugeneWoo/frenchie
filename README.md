# Frenchie

GCSE French oral practice web app. Students hear questions spoken aloud, respond in French (text or speech), and get AI-scored feedback against Edexcel band descriptors.

## Features

- 30 seeded GCSE French questions across common oral themes
- Text or speech answer mode (microphone via ElevenLabs Scribe STT)
- AI evaluation scored against Edexcel band descriptors (Claude)
- TTS playback of questions in French (Microsoft Edge Neural, no API key)
- Excel upload — paste your own questions from a spreadsheet (Column A: Question, Column B: Answer — omit B for AI-judged scoring)
- AI Theme mode — generate a fresh set of questions on any topic
- History panel — persists past attempts with TTL pruning, feeds prior-attempt context into scoring

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vanilla HTML/CSS/JS — no framework, no build step |
| Backend | Node.js + Express (API proxy/gateway) |
| TTS | `msedge-tts` — `fr-FR-DeniseNeural`, free, no key |
| STT | ElevenLabs Scribe v2 |
| AI | Anthropic Claude (`claude-sonnet-4-6`) |
| Deploy | Railway (nixpacks) |

## Local Setup

**Prerequisites:** Node.js 18+

```bash
git clone https://github.com/EugeneWoo/frenchie.git
cd frenchie
npm install
cp .env.example .env   # fill in your keys
npm run dev            # starts on PORT 3001
```

Open `http://localhost:3001`.

> **macOS note:** Port 5000 is taken by AirPlay Receiver. Use `PORT=3001` if needed.

## Environment Variables

See `.env.example` for the full list. Required:

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude evaluation + question generation |
| `ELEVENLABS_API_KEY` | ElevenLabs Scribe STT (speech-to-text) |
| `FRONTEND_ORIGIN` | CORS allowlist in production (e.g. `https://frenchie.up.railway.app`) |
| `PORT` | Server port

TTS runs via `msedge-tts` with no key.

## Commands

```bash
npm run dev    # nodemon dev server, auto-restart
npm start      # production server
npm test       # Jest + supertest (122 tests, 13 suites)
```

Run a single test file:

```bash
npx jest tests/integration.test.js --no-coverage
```

## Project Structure

```
frontend/
  index.html          # Entry point
  app.js              # Shared apiFetch helper
  data.js             # SEEDED_QUESTIONS (30 Q&As), typedefs
  core.js             # Main UI loop + evaluate flow
  audio.js            # TTS playback + MediaRecorder STT
  excel.js            # Excel upload (SheetJS)
  themes.js           # AI theme question generation
  history.js          # History panel + localStorage
  styles.css          # Skeuomorphic parchment design
backend/
  server.js           # Express app
  routes/             # tts, transcribe, evaluate, generateQuestions
  services/           # claude.js, edge-tts.js, stt.js
  middleware/
    upload.js         # multer memoryStorage
tests/                # Jest test suites (node + jsdom environments)
```

## Deploy

Deployed on Railway via nixpacks. Start command: `node backend/server.js`.

Set all env vars in the Railway dashboard. `PORT` is injected automatically.

## License

MIT
