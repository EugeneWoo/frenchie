# Product Roadmap

1. [ ] Backend API Server — A minimal Node.js/Express server with environment-variable-managed API keys, a health-check endpoint, and CORS configured for the frontend origin; all subsequent features proxy through this server. `S`

2. [ ] ElevenLabs TTS Integration — A backend `/api/tts` endpoint accepts a French text string and returns an audio stream from ElevenLabs; the frontend plays the audio when a question is displayed so the student hears natural French before responding. `S`

3. [ ] Static Question Bank and Basic UI — The frontend renders a question selected from the existing 30 hardcoded Q&A pairs, plays the TTS audio for the question, and presents a text input area and a Submit button so the core practice loop is end-to-end functional. `S`

4. [ ] AI Evaluation with Claude — A backend `/api/evaluate` endpoint sends the question, optional model answer, and student response to Claude (claude-sonnet-4-6) with a GCSE mark-scheme-aware system prompt (assessing communication, range/accuracy of language, and pronunciation approximation); returns a structured score plus plain-English feedback the student can act on. `M`

5. [ ] Reliable Audio Recording and Transcription — The frontend records the student's spoken answer using the MediaRecorder API and posts the audio blob to a backend `/api/transcribe` endpoint (Whisper); the returned transcript is treated identically to a typed answer so both input modes share the same evaluation path. `M`

6. [ ] Excel Question Upload — The frontend uses SheetJS to parse a user-uploaded two-column Excel file (Question | Model Answer) client-side and stores the parsed pairs as the active question bank for the session, replacing the hardcoded questions. `S`

7. [ ] AI Theme Mode — A backend `/api/generate-questions` endpoint accepts a GCSE theme string (Identity & Culture, Travel & Tourism, Local & Global Issues, School & Future Plans, Current Events) and asks Claude to generate questions matching real GCSE general conversation style; the frontend lets the student pick a theme and loads the generated questions, with evaluation handled contextually against GCSE speaking criteria. `M`

8. [ ] Practice History and Repeat Comparison — LocalStorage persists every Q&A attempt (question, response, score, feedback, timestamp); a slide-out history sidebar displays past attempts; when a question is answered again the frontend sends prior attempts to a backend `/api/compare` endpoint so Claude can return a progress comparison alongside the standard evaluation. `L`

> Notes
> - Items 1–3 establish the end-to-end skeleton (server, audio, UI loop) before any AI integration.
> - Items 4–5 complete the core AI coaching loop (evaluate typed and spoken answers).
> - Items 6–7 add the two question-source modes described in the mission.
> - Item 8 adds the history and progress-comparison layer on top of the working core.
> - Each item is independently testable before the next begins.
