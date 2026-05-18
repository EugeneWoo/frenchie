'use strict';

// ---------------------------------------------------------------------------
// audio.js — TTS playback and MediaRecorder recording/transcription
//
// Public API (also assigned to window for use by core.js):
//   playQuestionAudio(text)  → fetches /api/tts, plays via #tts-audio
//   replayAudio()            → replays stored blob URL without re-fetching
//   toggleRecord()           → starts/stops MediaRecorder; posts to /api/transcribe
//   getCurrentTranscript()   → returns current transcript string
//
// HTML elements used:
//   #tts-audio               <audio> element (injected lazily if absent)
//   #audio-replay-btn        Replay button
//   #tts-error               Inline TTS error paragraph
//   #record-btn              Record/stop/spinner button
//   #speech-display          Container div for speech transcript area
//   #speech-transcript-text  <p> inside #speech-display showing the transcript
//   #transcribe-error        Inline transcription error (inside #speech-display)
//   #response-textarea       Textarea — copy transcript here in text mode
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------
let lastSpokenText = null;    // text cached for replay via speechSynthesis
let currentTranscript = '';   // last successful transcript
let mediaRecorder = null;     // active MediaRecorder instance
let audioChunks = [];         // audio data collected while recording
let isRecording = false;      // track recording state

// ---------------------------------------------------------------------------
// DOM helpers — accessed lazily so tests can build the DOM before importing
// ---------------------------------------------------------------------------
function getTtsErrorEl() {
  return document.getElementById('tts-error');
}

function getReplayBtn() {
  return document.getElementById('audio-replay-btn');
}

function getRecordBtn() {
  return document.getElementById('record-btn');
}

/**
 * Returns the element to write transcript text into.
 * Prefers #speech-transcript-text; falls back to #speech-display itself.
 */
function getSpeechTranscriptEl() {
  return document.getElementById('speech-transcript-text') ||
         document.getElementById('speech-display');
}

/**
 * Returns the #speech-display container (to toggle visibility).
 */
function getSpeechDisplayContainer() {
  return document.getElementById('speech-display');
}

function getTranscribeErrorEl() {
  return document.getElementById('transcribe-error');
}

function getResponseTextarea() {
  return document.getElementById('response-textarea');
}

// ---------------------------------------------------------------------------
// Record button visual states
// ---------------------------------------------------------------------------
const BTN_STATES = {
  idle: {
    text: '🎤',   // 🎤
    className: 'record-btn--idle',
    disabled: false,
  },
  recording: {
    text: '⏹',          // ⏹
    className: 'record-btn--recording',
    disabled: false,
  },
  processing: {
    text: '⏳',          // ⏳
    className: 'record-btn--processing',
    disabled: true,
  },
};

function setRecordBtnState(state) {
  const btn = getRecordBtn();
  if (!btn) return;
  const cfg = BTN_STATES[state];
  btn.textContent = cfg.text;
  btn.disabled = cfg.disabled;
  // Remove all state classes then add the active one
  Object.values(BTN_STATES).forEach((s) => btn.classList.remove(s.className));
  btn.classList.add(cfg.className);
}

// ---------------------------------------------------------------------------
// showTtsError / hideTtsError
// ---------------------------------------------------------------------------
function showTtsError(message) {
  const el = getTtsErrorEl();
  if (!el) return;
  el.textContent = message;
  el.removeAttribute('hidden');
  el.style.display = '';
}

function hideTtsError() {
  const el = getTtsErrorEl();
  if (!el) return;
  el.setAttribute('hidden', '');
  el.style.display = 'none';
}

// ---------------------------------------------------------------------------
// showTranscribeError / hideTranscribeError
// ---------------------------------------------------------------------------
function showTranscribeError(message) {
  const el = getTranscribeErrorEl();
  if (!el) return;
  el.textContent = message;
  el.removeAttribute('hidden');
  el.style.display = '';
}

function hideTranscribeError() {
  const el = getTranscribeErrorEl();
  if (!el) return;
  el.setAttribute('hidden', '');
  el.style.display = 'none';
}

// ---------------------------------------------------------------------------
// playQuestionAudio(text)
//
// Speaks text via browser speechSynthesis with lang fr-FR.
// On failure: shows inline error, does NOT throw.
// Shows #audio-replay-btn after the first successful speech call.
// ---------------------------------------------------------------------------
async function playQuestionAudio(text) {
  hideTtsError();
  lastSpokenText = text;

  if (typeof window === 'undefined' || !window.speechSynthesis) {
    showTtsError('Audio unavailable — please read the question above.');
    return;
  }

  window.speechSynthesis.cancel();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.9;

    const replayBtn = getReplayBtn();
    if (replayBtn) {
      replayBtn.hidden = false;
      replayBtn.disabled = true;
    }

    utterance.onend = () => {
      if (replayBtn) replayBtn.disabled = false;
      resolve();
    };

    utterance.onerror = (e) => {
      // 'interrupted' fires when cancel() is called — not a real error
      if (e.error !== 'interrupted') {
        showTtsError('Audio unavailable — please read the question above.');
      }
      if (replayBtn) replayBtn.disabled = false;
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
}

// ---------------------------------------------------------------------------
// replayAudio()
//
// Re-speaks the last question via speechSynthesis. No-op if nothing spoken yet.
// ---------------------------------------------------------------------------
function replayAudio() {
  if (!lastSpokenText) return;
  playQuestionAudio(lastSpokenText);
}

// ---------------------------------------------------------------------------
// detectMimeType() — MIME negotiation for MediaRecorder
// ---------------------------------------------------------------------------
function detectMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return ''; // fall back to browser default
}

// ---------------------------------------------------------------------------
// toggleRecord()
//
// First call: start recording (getUserMedia → MediaRecorder.start)
// Second call: stop recording (MediaRecorder.stop → assemble blob → POST transcribe)
// ---------------------------------------------------------------------------
async function toggleRecord() {
  if (isRecording) {
    // Stop recording
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    return;
  }

  // Start recording
  hideTranscribeError();

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    showTranscribeError('Microphone access denied — you can type your answer instead.');
    const textarea = getResponseTextarea();
    if (textarea) {
      textarea.removeAttribute('hidden');
      textarea.style.display = '';
    }
    return;
  }

  const mimeType = detectMimeType();
  const options = mimeType ? { mimeType } : {};

  try {
    mediaRecorder = new MediaRecorder(stream, options);
  } catch (err) {
    // Fallback: try without options
    mediaRecorder = new MediaRecorder(stream);
  }

  audioChunks = [];
  isRecording = true;
  setRecordBtnState('recording');

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    isRecording = false;
    setRecordBtnState('processing');

    // Stop all tracks to release the microphone
    if (stream && stream.getTracks) {
      stream.getTracks().forEach((track) => track.stop());
    }

    const blobType = mimeType || 'audio/webm';
    const audioBlob = new Blob(audioChunks, { type: blobType });
    audioChunks = [];

    // Build file extension from MIME type
    let ext = 'webm';
    if (blobType.includes('ogg')) ext = 'ogg';
    else if (blobType.includes('mp4')) ext = 'mp4';

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.' + ext);

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Transcription request failed with status ${res.status}`);
      }

      const data = await res.json();
      currentTranscript = data.transcript || '';

      // Populate transcript display
      const transcriptEl = getSpeechTranscriptEl();
      if (transcriptEl) {
        transcriptEl.textContent = currentTranscript;
      }

      // Make speech-display container visible
      const speechContainer = getSpeechDisplayContainer();
      if (speechContainer) {
        speechContainer.removeAttribute('hidden');
        speechContainer.style.display = '';
      }

      // If textarea is visible (text mode fallback), copy transcript there too
      const textarea = getResponseTextarea();
      if (textarea && textarea.style.display !== 'none' && !textarea.hasAttribute('hidden')) {
        textarea.value = currentTranscript;
      }

      setRecordBtnState('idle');
    } catch (err) {
      showTranscribeError('Transcription failed — you can type your answer instead.');

      // Reveal textarea fallback
      const textarea = getResponseTextarea();
      if (textarea) {
        textarea.removeAttribute('hidden');
        textarea.style.display = '';
      }

      setRecordBtnState('idle');
    }
  };

  mediaRecorder.start();
}

// ---------------------------------------------------------------------------
// getCurrentTranscript()
//
// Returns the current transcript string (used by core.js for submit).
// ---------------------------------------------------------------------------
function getCurrentTranscript() {
  return currentTranscript;
}

// ---------------------------------------------------------------------------
// Wire up replay button and record button click handlers once DOM is ready
// ---------------------------------------------------------------------------
function initAudioUI() {
  const replayBtn = getReplayBtn();
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      replayAudio();
    });
  }

  const recordBtn = getRecordBtn();
  if (recordBtn) {
    recordBtn.addEventListener('click', () => {
      toggleRecord();
    });
  }
}

// Run init when DOM is ready (or immediately if already loaded)
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAudioUI);
  } else {
    initAudioUI();
  }
}

// ---------------------------------------------------------------------------
// Exports (CommonJS for tests; also assigned to window for browser use)
// ---------------------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    playQuestionAudio,
    replayAudio,
    toggleRecord,
    getCurrentTranscript,
    detectMimeType,
  };
}

if (typeof window !== 'undefined') {
  window.playQuestionAudio = playQuestionAudio;
  window.replayAudio = replayAudio;
  window.toggleRecord = toggleRecord;
  window.getCurrentTranscript = getCurrentTranscript;
}
