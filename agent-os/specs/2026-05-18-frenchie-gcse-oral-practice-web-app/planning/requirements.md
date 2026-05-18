# Spec Requirements: Frenchie GCSE Oral Practice Web App

## Initial Description

A web app that helps UK GCSE French students (Year 10-11) practice their speaking exam independently. Key features:

1. Claude AI as coach (replaces local JS heuristic scoring)
2. ElevenLabs TTS for high-quality French audio prompts
3. Reliable audio recording via MediaRecorder API + Whisper transcription (replaces buggy webkitSpeechRecognition)
4. Two question modes: upload 2-column Excel sheet (Q|A) OR Claude-generated GCSE-themed questions
5. Toggle between typed text and verbal audio response
6. Slideout history panel with past Q&As and scores
7. Repeat question performance comparison via Claude

## Requirements Discussion

### First Round Questions

**Q1:** For the initial question bank, should we seed it from the existing ~30 Q&A pairs in the prototype HTML file, or start fresh with a new set? And should the question selection be random, or allow the student to browse/pick?
**Answer:** Seed from the existing ~30 Q&As in the prototype HTML file (`/Users/eugenewoo/Downloads/french_oral_practice_v5.html`). Keep random selection.

**Q2:** For the history sidebar, I'm assuming it slides out from the right and overlays the main content rather than pushing it. Should it take up roughly half the screen width, or something narrower like a third?
**Answer:** Slides out from the right (overlay style). Max one-third of screen width.

**Q3:** For AI Theme Mode, the roadmap mentions themes like "Identity & Culture, Travel & Tourism, Local & Global Issues, School & Future Plans." The mission also mentions Edexcel. Should we align to a specific exam board's official topic list, and if so, which one? Or keep a generic set?
**Answer:** Edexcel exam board. Exactly 6 topic areas: Home & Abroad, Education and Employment, Personal Life and Relationships, The World Around Us, Social Activities, Fitness & Health.

**Q4:** For the AI evaluation feedback panel, I'm thinking it should include: Overall score (e.g. 1–9), Communication score, Range & Accuracy of Language score, a corrected version of the student's answer, a model answer (if available), and plain-English comments. Is that the right set of sections, and should any be added or removed?
**Answer:** Yes to the proposed set. Also include "Raw Response from user." All feedback sections (except model answer and corrected version of their answer) must be in English.

**Q5:** For Excel upload mode, if the user uploads a sheet with no model answer column (just questions), should the app reject it with an error, or allow it and fall back to contextual Claude evaluation?
**Answer:** Optional — if the model answer column is missing, Claude evaluates contextually.

**Q6:** For history persistence, since this is single-user with no login, I'm assuming history lives in localStorage. When should it be cleared: only on an explicit "Clear" button click, or also on browser refresh, or after a time limit?
**Answer:** Single-user, no login. History cleared on browser refresh OR "Clear" button click OR after 48 hours — whichever comes first.

**Q7:** For the UI design, should we carry over the flat minimal style from the prototype (white cards, blue accents, plain sans-serif), or take this as an opportunity for a fresh visual direction (e.g. a more playful, French-themed aesthetic)?
**Answer:** Fresh skeuomorphic UI. The app name is "Frenchie."

**Q8:** To confirm scope: no user accounts, no mobile app, no multi-student profiles, no teacher dashboard, no gamification (streaks, badges). Correct?
**Answer:** Confirmed — all of those are out of scope.

### Existing Code to Reference

**Similar Features Identified:**
- Feature: Prototype HTML app - Path: `/Users/eugenewoo/Downloads/french_oral_practice_v5.html`
  - Contains the full ~30 Q&A seed question bank (questions and model answers in French, with English translations)
  - Contains existing UI layout patterns: question display card, mode toggle (text/speech), response area, feedback panel, history sidebar, button group
  - Contains localStorage persistence logic for history and questionHistory objects
  - Contains existing feedback section structure (score, feedback-label, feedback-text, feedback-section)
  - Note: This prototype uses heuristic scoring and webkitSpeechRecognition — both to be replaced. Its structure and Q&A data are the reference, not its AI/audio logic.

### Follow-up Questions

None required. All answers were clear and complete.

## Visual Assets

### Files Provided:

No visual assets provided.

### Visual Insights:

No visual assets provided. Design direction is specified in answers: fresh skeuomorphic UI, app named "Frenchie."

## Requirements Summary

### Functional Requirements

- Display a randomly selected French oral exam question from the seeded question bank (30 Q&As from prototype)
- Play the question aloud using ElevenLabs TTS (natural French voice) before the student responds
- Allow the student to respond via typed text OR verbal audio recording (MediaRecorder API + Whisper transcription)
- Submit response to Claude for evaluation; display structured feedback in a feedback panel
- Feedback panel sections: Overall score, Communication score, Range & Accuracy score, Raw Response from user, Corrected version of student's answer (in French), Model answer (in French, if available), Plain-English comments
- All feedback sections except model answer and corrected answer must be displayed in English
- Support two question source modes:
  - Excel Upload Mode: user uploads a two-column .xlsx file (Question | Model Answer); model answer column is optional; if absent, Claude evaluates contextually
  - AI Theme Mode: student picks one of 6 Edexcel topics (Home & Abroad; Education and Employment; Personal Life and Relationships; The World Around Us; Social Activities; Fitness & Health) and Claude generates fresh GCSE-style questions
- When a question is answered again (repeat), Claude compares the new attempt against prior attempts and returns a progress comparison alongside standard evaluation
- History sidebar: slides out from the right as an overlay, max one-third screen width, shows all past Q&As with scores, timestamps, and feedback
- History persistence via localStorage; cleared on: browser refresh, explicit "Clear" button click, or after 48 hours — whichever comes first
- "New Question" button selects a random next question
- "Clear" button resets the current session and clears history

### Reusability Opportunities

- Q&A seed data: extract all 30 question/answer/translation objects from the prototype HTML and use as the hardcoded static question bank
- UI layout reference: the prototype's card-based layout (question card, mode toggle, response area, feedback panel, button group, sidebar) informs the information architecture even though the visual style will be replaced with skeuomorphic design
- localStorage structure from the prototype (history array + questionHistory map keyed by question text) is a useful reference for the persistence layer

### Scope Boundaries

**In Scope:**
- Single-user web app (no login, no accounts)
- Two input modes: typed response, verbal (recorded) response
- Two question source modes: Excel upload, AI Theme Mode (Edexcel topics)
- Claude AI evaluation with structured multi-section feedback
- ElevenLabs TTS for question audio playback
- Whisper transcription for verbal responses
- LocalStorage-based history with 48-hour expiry
- Slide-out history sidebar (right side, max one-third width, overlay)
- Repeat question detection and Claude performance comparison
- Fresh skeuomorphic UI design branded as "Frenchie"
- Deployment on Vercel

**Out of Scope:**
- User accounts or authentication
- Multi-student profiles
- Teacher dashboard or admin interface
- Mobile app (native iOS/Android)
- Gamification (streaks, badges, leaderboards)
- Persistent server-side history/database
- Social or sharing features

### Technical Considerations

- Frontend: Vanilla HTML/CSS/JS (no framework, no build step)
- Backend: Node.js + Express (API proxy for all external services)
- Claude (`claude-sonnet-4-6`) for: evaluation, feedback generation, themed question generation, repeat performance comparison
- ElevenLabs for French TTS; proxied through backend
- OpenAI Whisper for speech-to-text; proxied through backend
- SheetJS (xlsx) for client-side Excel parsing
- localStorage for session history with 48-hour TTL (timestamp stored alongside data)
- Vercel for hosting; secrets managed via Vercel environment variables
- Feedback from Claude must return a structured JSON response that maps to the defined feedback sections
- History cleared on: page refresh (check timestamp on load), "Clear" button, or TTL expiry detected on load
- The 30-question seed bank from the prototype covers topics across Home & Abroad, Personal Life, Transport, and Social Activities — these map loosely to Edexcel themes and should be tagged accordingly where possible
