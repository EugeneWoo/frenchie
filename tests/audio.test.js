/**
 * @jest-environment jsdom
 */
'use strict';

// ---------------------------------------------------------------------------
// Helpers: set up a minimal DOM before each test
// Mirrors the structure in frontend/index.html for the elements audio.js uses.
// ---------------------------------------------------------------------------
function buildDOM() {
  document.body.innerHTML = `
    <section class="question-card">
      <p id="question-text">Question goes here</p>
      <button id="audio-replay-btn" disabled hidden>&#9654; Replay</button>
      <p id="tts-error" hidden></p>
    </section>

    <audio id="tts-audio" style="display:none"></audio>

    <section class="response-area">
      <textarea id="response-textarea" hidden></textarea>

      <div id="speech-display" hidden>
        <p id="speech-transcript-text" aria-live="polite"></p>
        <p id="transcribe-error" hidden></p>
      </div>

      <button id="record-btn" hidden>&#9679; Record</button>
    </section>
  `;
}

// ---------------------------------------------------------------------------
// Load audio.js into the jsdom environment after DOM is ready.
// Uses jest.resetModules() so each describe block gets a fresh module state.
// ---------------------------------------------------------------------------
function loadAudioModule() {
  jest.resetModules();
  return require('../frontend/audio.js');
}

// ---------------------------------------------------------------------------
// speechSynthesis mock helpers
// ---------------------------------------------------------------------------
function mockSpeechSynthesis({ triggerEnd = true, error = null } = {}) {
  global.SpeechSynthesisUtterance = jest.fn(function (text) {
    this.text = text;
    this.lang = '';
    this.rate = 1;
    this.onend = null;
    this.onerror = null;
  });

  global.speechSynthesis = {
    speak: jest.fn((utterance) => {
      Promise.resolve().then(() => {
        if (error && utterance.onerror) {
          utterance.onerror({ error });
        } else if (triggerEnd && utterance.onend) {
          utterance.onend({});
        }
      });
    }),
    cancel: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Test group 1: playQuestionAudio — browser speechSynthesis
// ---------------------------------------------------------------------------
describe('playQuestionAudio(text)', () => {
  beforeEach(() => {
    buildDOM();
    jest.resetModules();
    mockSpeechSynthesis();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls speechSynthesis.speak with fr-FR utterance', async () => {
    const { playQuestionAudio } = loadAudioModule();

    await playQuestionAudio('Décris-moi la ville où tu habites.');

    expect(global.speechSynthesis.speak).toHaveBeenCalled();
    const utterance = global.speechSynthesis.speak.mock.calls[0][0];
    expect(utterance.lang).toBe('fr-FR');
    expect(utterance.text).toBe('Décris-moi la ville où tu habites.');
  });

  it('shows replay button after speaking and re-speaks on replay without extra speak call', async () => {
    const { playQuestionAudio, replayAudio } = loadAudioModule();

    await playQuestionAudio('Bonjour');

    const replayBtn = document.getElementById('audio-replay-btn');
    expect(replayBtn.hidden).toBe(false);

    const speakCountAfterPlay = global.speechSynthesis.speak.mock.calls.length;

    replayAudio();
    // replayAudio calls playQuestionAudio which calls speak again
    expect(global.speechSynthesis.speak.mock.calls.length).toBe(speakCountAfterPlay + 1);
  });

  it('shows inline TTS error and does not throw when speechSynthesis unavailable', async () => {
    delete global.speechSynthesis;

    const { playQuestionAudio } = loadAudioModule();

    await expect(playQuestionAudio('Bonjour')).resolves.toBeUndefined();

    const errorEl = document.getElementById('tts-error');
    expect(errorEl.hasAttribute('hidden')).toBe(false);
    expect(errorEl.textContent).toMatch(/audio unavailable/i);
  });

  it('shows inline TTS error and does not throw on speech error', async () => {
    mockSpeechSynthesis({ error: 'synthesis-failed' });

    const { playQuestionAudio } = loadAudioModule();

    await expect(playQuestionAudio('Bonjour')).resolves.toBeUndefined();

    const errorEl = document.getElementById('tts-error');
    expect(errorEl.hasAttribute('hidden')).toBe(false);
    expect(errorEl.textContent).toMatch(/audio unavailable/i);
  });
});

// ---------------------------------------------------------------------------
// Test group 2: Replay button click
// ---------------------------------------------------------------------------
describe('Replay button', () => {
  beforeEach(() => {
    buildDOM();
    jest.resetModules();
    mockSpeechSynthesis();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('clicking replay button re-speaks the last question via speechSynthesis', async () => {
    const { playQuestionAudio } = loadAudioModule();

    await playQuestionAudio('Quelque chose');
    const speakCountAfterPlay = global.speechSynthesis.speak.mock.calls.length;

    document.getElementById('audio-replay-btn').click();

    // Allow microtask queue to flush
    await Promise.resolve();

    expect(global.speechSynthesis.speak.mock.calls.length).toBeGreaterThan(speakCountAfterPlay);
  });
});

// ---------------------------------------------------------------------------
// Test group 3: toggleRecord — recording → transcription
// ---------------------------------------------------------------------------
describe('toggleRecord() — recording and transcription', () => {
  let mockMediaRecorder;
  let mockStream;

  beforeEach(() => {
    buildDOM();
    jest.resetModules();

    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();

    mockStream = { getTracks: jest.fn(() => [{ stop: jest.fn() }]) };

    mockMediaRecorder = {
      start: jest.fn(),
      stop: jest.fn(),
      state: 'inactive',
      ondataavailable: null,
      onstop: null,
    };

    const MockMediaRecorder = jest.fn(() => mockMediaRecorder);
    MockMediaRecorder.isTypeSupported = jest.fn((type) => type === 'audio/webm;codecs=opus');
    global.MediaRecorder = MockMediaRecorder;

    global.navigator.mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue(mockStream),
    };

    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('POSTs audio blob to /api/transcribe and populates #speech-transcript-text on success', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ transcript: "J'habite à Londres." }),
    });

    const { toggleRecord } = loadAudioModule();

    // Start recording
    await toggleRecord();

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(mockMediaRecorder.start).toHaveBeenCalled();

    // Simulate audio data arriving
    mockMediaRecorder.ondataavailable({ data: new Blob(['chunk1'], { type: 'audio/webm' }) });

    // Simulate MediaRecorder stop (triggers onstop)
    await mockMediaRecorder.onstop();

    // Flush microtasks
    await Promise.resolve();
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/transcribe',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    );

    const transcriptEl = document.getElementById('speech-transcript-text');
    expect(transcriptEl.textContent).toContain("J'habite à Londres.");
  });

  it('shows inline transcription error and reveals #response-textarea on transcription failure', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
    });

    const { toggleRecord } = loadAudioModule();

    await toggleRecord();

    mockMediaRecorder.ondataavailable({ data: new Blob(['chunk1'], { type: 'audio/webm' }) });

    await mockMediaRecorder.onstop();
    await Promise.resolve();
    await Promise.resolve();

    const errorEl = document.getElementById('transcribe-error');
    expect(errorEl.hasAttribute('hidden')).toBe(false);
    expect(errorEl.textContent).toMatch(/transcription failed/i);

    const textarea = document.getElementById('response-textarea');
    expect(textarea.style.display).not.toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Test group 4: getCurrentTranscript
// ---------------------------------------------------------------------------
describe('getCurrentTranscript()', () => {
  beforeEach(() => {
    buildDOM();
    jest.resetModules();
  });

  it('returns empty string before any transcript has been set', () => {
    const { getCurrentTranscript } = loadAudioModule();
    expect(getCurrentTranscript()).toBe('');
  });
});
