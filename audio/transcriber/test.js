'use strict';

const assert = require('assert');
const { formatTimestamp, mapSpeaker, convertTranscript } = require('./convert');

// --- Test 1: formatTimestamp(0) ---
assert.strictEqual(formatTimestamp(0), '00:00:00.000', 'Test 1 failed: formatTimestamp(0)');

// --- Test 2: formatTimestamp(3.0) ---
assert.strictEqual(formatTimestamp(3.0), '00:00:03.000', 'Test 2 failed: formatTimestamp(3.0)');

// --- Test 3: formatTimestamp(83.45) ---
assert.strictEqual(formatTimestamp(83.45), '00:01:23.450', 'Test 3 failed: formatTimestamp(83.45)');

// --- Test 4: formatTimestamp(3661.5) ---
assert.strictEqual(formatTimestamp(3661.5), '01:01:01.500', 'Test 4 failed: formatTimestamp(3661.5)');

// --- Test 5: mapSpeaker SE ---
assert.strictEqual(mapSpeaker('spk_0', 'spk_0'), 'SE', 'Test 5 failed: mapSpeaker SE');

// --- Test 6: mapSpeaker Visitor ---
assert.strictEqual(mapSpeaker('spk_1', 'spk_0'), 'Visitor', 'Test 6 failed: mapSpeaker Visitor');

// --- Test 7: convertTranscript with empty items ---
const emptyResult = convertTranscript({ results: { items: [] } }, 'SES001', 'spk_0');
assert.deepStrictEqual(
  emptyResult,
  { session_id: 'SES001', source: 'recording.wav', duration_seconds: 0, entries: [] },
  'Test 7 failed: empty items'
);

// --- Test 8: 2-speaker sample ---
const sampleRaw = {
  results: {
    items: [
      { type: 'pronunciation', start_time: '0.07', end_time: '0.54', speaker_label: 'spk_0', alternatives: [{ content: 'Welcome' }] },
      { type: 'punctuation', alternatives: [{ content: ',' }] },
      { type: 'pronunciation', start_time: '0.60', end_time: '1.10', speaker_label: 'spk_0', alternatives: [{ content: 'let' }] },
      { type: 'pronunciation', start_time: '1.15', end_time: '1.55', speaker_label: 'spk_0', alternatives: [{ content: 'me' }] },
      { type: 'pronunciation', start_time: '1.60', end_time: '2.10', speaker_label: 'spk_0', alternatives: [{ content: 'show' }] },
      { type: 'pronunciation', start_time: '2.15', end_time: '2.55', speaker_label: 'spk_0', alternatives: [{ content: 'you' }] },
      { type: 'pronunciation', start_time: '2.60', end_time: '3.20', speaker_label: 'spk_0', alternatives: [{ content: 'Vision' }] },
      { type: 'pronunciation', start_time: '3.25', end_time: '3.80', speaker_label: 'spk_0', alternatives: [{ content: 'One' }] },
      { type: 'punctuation', alternatives: [{ content: '.' }] },
      { type: 'pronunciation', start_time: '5.00', end_time: '5.50', speaker_label: 'spk_1', alternatives: [{ content: 'Great' }] },
      { type: 'punctuation', alternatives: [{ content: ',' }] },
      { type: 'pronunciation', start_time: '5.60', end_time: '6.20', speaker_label: 'spk_1', alternatives: [{ content: "I'm" }] },
    ],
  },
};

const result8 = convertTranscript(sampleRaw, 'SES001', 'spk_0');

assert.strictEqual(result8.entries.length, 2, 'Test 8 failed: expected 2 entries');
assert.strictEqual(result8.entries[0].speaker, 'SE', 'Test 8 failed: first speaker should be SE');
assert.strictEqual(result8.entries[0].text, 'Welcome, let me show you Vision One.', 'Test 8 failed: first entry text');
assert.strictEqual(result8.entries[0].timestamp, '00:00:00.070', 'Test 8 failed: first entry timestamp');
assert.strictEqual(result8.entries[1].speaker, 'Visitor', 'Test 8 failed: second speaker should be Visitor');
assert.strictEqual(result8.entries[1].text, "Great, I'm", 'Test 8 failed: second entry text');
assert.strictEqual(result8.entries[1].timestamp, '00:00:05.000', 'Test 8 failed: second entry timestamp');

// --- Test 9: Punctuation appended without space ---
const punctRaw = {
  results: {
    items: [
      { type: 'pronunciation', start_time: '1.00', end_time: '1.50', speaker_label: 'spk_0', alternatives: [{ content: 'Hello' }] },
      { type: 'punctuation', alternatives: [{ content: '!' }] },
      { type: 'punctuation', alternatives: [{ content: '?' }] },
    ],
  },
};
const result9 = convertTranscript(punctRaw, 'S001', 'spk_0');
assert.strictEqual(result9.entries.length, 1, 'Test 9 failed: expected 1 entry');
assert.strictEqual(result9.entries[0].text, 'Hello!?', 'Test 9 failed: punctuation should be appended without space');

// --- Test 10: Gap > 2s creates new utterance for same speaker ---
const gapRaw = {
  results: {
    items: [
      { type: 'pronunciation', start_time: '0.00', end_time: '0.50', speaker_label: 'spk_0', alternatives: [{ content: 'First' }] },
      { type: 'pronunciation', start_time: '3.00', end_time: '3.50', speaker_label: 'spk_0', alternatives: [{ content: 'Second' }] },
    ],
  },
};
const result10 = convertTranscript(gapRaw, 'S002', 'spk_0');
assert.strictEqual(result10.entries.length, 2, 'Test 10 failed: gap > 2s should create new utterance');
assert.strictEqual(result10.entries[0].text, 'First', 'Test 10 failed: first utterance text');
assert.strictEqual(result10.entries[1].text, 'Second', 'Test 10 failed: second utterance text');
assert.strictEqual(result10.entries[0].speaker, 'SE', 'Test 10 failed: both utterances should be SE');
assert.strictEqual(result10.entries[1].speaker, 'SE', 'Test 10 failed: both utterances should be SE');

console.log('All tests passed.');
