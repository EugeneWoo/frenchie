# Product Mission

## Pitch

Frenchie is a web app that helps UK teenagers preparing for their **GCSE French speaking exam**
practice independently by providing AI-powered evaluation, natural-sounding French audio prompts,
and personalised feedback that improves with every session.

## Users

### Primary Customers

- **Parents of exam students**: Building or sourcing tools to supplement school preparation at home
- **Secondary school students**: Needing low-pressure, self-directed practice outside of class time

### User Personas

**Exam Student** (14–16, Year 10–11)
- **Role:** GCSE French candidate (AQA / Edexcel / OCR)
- **Context:** Preparing for the GCSE Speaking component — role play, photo card, and general conversation on 2 chosen themes; limited time to practise with a native speaker or tutor outside school
- **Pain Points:** Awkward to practise speaking alone; school feedback is infrequent; doesn't know if their grammar or vocabulary range is good enough; gets bored with repetitive flashcard tools
- **Goals:** Feel confident in the general conversation section; hit the right vocab and tense range for the mark scheme; track improvement on specific questions over time

**Parent** (35–55)
- **Role:** Non-expert enabler — wants to support their child's revision without needing to speak French themselves
- **Context:** Setting up and occasionally checking the tool; may upload custom question sheets from the school
- **Pain Points:** Existing tools are either too basic (no real feedback) or too complex to configure; quality TTS in browser is unreliable
- **Goals:** A working, self-contained tool the child can use without supervision; visibility into how practice is going

## The Problem

### Heuristic Scoring Gives Useless Feedback

Simple keyword-matching and rule-based scoring cannot assess French fluency. A student can
score well by hitting vocabulary targets while producing grammatically broken sentences.
Conversely, a nuanced answer using complex structures may score poorly if it doesn't match
expected keywords. Students receive a number but no actionable guidance on how to improve.

**Our Solution:** Replace all local scoring with Claude AI evaluation that assesses grammar,
vocabulary range, fluency, and relevance — and explains the reasoning in plain English.

### Browser TTS Is Unreliable for French

The Web Speech API produces robotic, inconsistent French pronunciation and has no guaranteed
voice quality across browsers. Poor audio makes it harder to learn natural spoken French
cadence and makes the tool feel unpolished.

**Our Solution:** Use the ElevenLabs API to deliver clear, natural-sounding French audio for
every question prompt.

### Recording Has No Reliable Cross-Browser Support

webkitSpeechRecognition in continuous mode creates restart loops and only works in Chrome.
Students on Safari or Firefox cannot use the verbal input path at all.

**Our Solution:** Use the MediaRecorder API to capture audio, send it to a backend transcription
service (Whisper via OpenAI or similar), and return a transcript — removing the browser
dependency entirely.

## Differentiators

### AI Coach, Not a Scorecard

Unlike flashcard apps or simple quiz tools, Frenchie provides natural language feedback on each
response — identifying specific errors, suggesting better phrasing, and noting vocabulary gaps.
This results in students understanding *why* they scored as they did and knowing exactly what
to work on next.

### Progress-Aware Repetition

Unlike static practice tools, Frenchie tracks every attempt at a given question and asks Claude
to compare the latest response against prior attempts. This results in direct, concrete feedback
on whether the student is actually improving over time on specific questions.

### Flexible Question Sources

Unlike tools locked to a fixed curriculum bank, Frenchie accepts both uploaded Excel question
sheets (matching school-provided materials) and AI-generated themed questions. This results in
practice that mirrors the student's actual exam content.

## Key Features

### Core Features

- **AI Evaluation:** Claude assesses each spoken or typed response for grammar, vocabulary, fluency, and relevance — then returns a score and plain-English feedback
- **High-Quality French TTS:** ElevenLabs voices read each question aloud in natural French so the student hears correct pronunciation before responding
- **Verbal and Typed Input:** Student can speak their answer (recorded and transcribed) or type it — their choice per question

### Practice Modes

- **Excel Upload Mode:** Parent or student uploads a two-column spreadsheet (Question | Model Answer); the app parses it client-side and uses it as the question bank
- **AI Theme Mode:** Student picks a GCSE theme (Identity & Culture, Travel & Tourism, Local & Global Issues, School & Future Plans, etc.) and Claude generates fresh questions with no fixed model answer — evaluation is contextual and mark-scheme-aware

### Progress Features

- **History Sidebar:** A slide-out panel showing all past Q&As with scores, timestamps, and AI feedback
- **Repeat Comparison:** When a question is answered again, Claude automatically compares the new attempt to previous ones and highlights improvements or regressions
