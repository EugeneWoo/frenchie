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
// Test group 1: playQuestionAudio — fetch /api/tts + audio element
// ---------------------------------------------------------------------------
describe('playQuestionAudio(text)', () => {
  beforeEach(() => {
    buildDOM();
    jest.resetModules();

    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls POST /api/tts and sets <audio> src to the returned blob URL', async () => {
    const mockBlob = new Blob(['audio-data'], { type: 'audio/mpeg' });
    global.fetch.mockResolvedValue({
      ok: true,
      blob: jest.fn().mockResolvedValue(mockBlob),
    });

    const audioEl = document.getElementById('tts-audio');
    audioEl.play = jest.fn().mockResolvedValue(undefined);

    const { playQuestionAudio } = loadAudioModule();

    await playQuestionAudio('Décris-moi la ville où tu habites.');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/tts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'Décris-moi la ville où tu habites.' }),
      })
    );
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(audioEl.src).toContain('blob:mock-url');
    expect(audioEl.play).toHaveBeenCalled();
  });

  it('stores blob URL — replay re-plays without re-fetching', async () => {
    const mockBlob = new Blob(['audio-data'], { type: 'audio/mpeg' });
    global.fetch.mockResolvedValue({
      ok: true,
      blob: jest.fn().mockResolvedValue(mockBlob),
    });

    const audioEl = document.getElementById('tts-audio');
    audioEl.play = jest.fn().mockResolvedValue(undefined);

    const { playQuestionAudio, replayAudio } = loadAudioModule();

    await playQuestionAudio('Bonjour');

    const fetchCallsAfterFirstPlay = global.fetch.mock.calls.length;

    replayAudio();

    expect(global.fetch.mock.calls.length).toBe(fetchCallsAfterFirstPlay);
    expect(audioEl.play).toHaveBeenCalledTimes(2);
  });

  it('shows inline TTS error and does not throw when fetch returns non-ok', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 502, statusText: 'Bad Gateway' });

    const { playQuestionAudio } = loadAudioModule();

    await expect(playQuestionAudio('Bonjour')).resolves.toBeUndefined();

    const errorEl = document.getElementById('tts-error');
    expect(errorEl.hasAttribute('hidden')).toBe(false);
    expect(errorEl.textContent).toMatch(/audio unavailable/i);
  });

  it('shows inline TTS error and does not throw on network rejection', async () => {
    global.fetch.mockRejectedValue(new Error('Network failure'));

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
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('replays audio without re-fetching /api/tts when blob URL already cached', async () => {
    const mockBlob = new Blob(['audio-data'], { type: 'audio/mpeg' });
    global.fetch.mockResolvedValue({
      ok: true,
      blob: jest.fn().mockResolvedValue(mockBlob),
    });

    const audioEl = document.getElementById('tts-audio');
    audioEl.play = jest.fn().mockResolvedValue(undefined);

    const { playQuestionAudio } = loadAudioModule();

    await playQuestionAudio('Quelque chose');
    const fetchCountAfterPlay = global.fetch.mock.calls.length;

    document.getElementById('audio-replay-btn').click();

    expect(global.fetch.mock.calls.length).toBe(fetchCountAfterPlay);
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
