'use strict';

const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

async function textToSpeech(text) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata('fr-FR-DeniseNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);
  return audioStream;
}

module.exports = { textToSpeech };
