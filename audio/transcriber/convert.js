'use strict';

/**
 * Format a time in seconds to HH:MM:SS.mmm
 * @param {number} seconds
 * @returns {string}
 */
function formatTimestamp(seconds) {
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSecs = Math.floor(totalMs / 1000);
  const secs = totalSecs % 60;
  const totalMins = Math.floor(totalSecs / 60);
  const mins = totalMins % 60;
  const hours = Math.floor(totalMins / 60);

  const hh = String(hours).padStart(2, '0');
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const mmm = String(ms).padStart(3, '0');

  return `${hh}:${mm}:${ss}.${mmm}`;
}

/**
 * Map an AWS Transcribe speaker label to "SE" or "Visitor".
 * @param {string} label - e.g. "spk_0"
 * @param {string} seSpeakerLabel - the label assigned to SE, e.g. "spk_0"
 * @returns {"SE"|"Visitor"}
 */
function mapSpeaker(label, seSpeakerLabel) {
  return label === seSpeakerLabel ? 'SE' : 'Visitor';
}

/**
 * Convert raw AWS Transcribe JSON to transcript.json format.
 * @param {object} raw - parsed AWS Transcribe output JSON
 * @param {string} sessionId
 * @param {string} seSpeakerLabel - AWS Transcribe label for the SE speaker
 * @returns {object} transcript.json object
 */
function convertTranscript(raw, sessionId, seSpeakerLabel) {
  const items = (raw.results && raw.results.items) || [];

  // Filter to pronunciation items only (for iteration), but we'll handle punctuation inline
  const pronunciationItems = items.filter((item) => item.type === 'pronunciation');

  if (pronunciationItems.length === 0) {
    return {
      session_id: sessionId,
      source: 'recording.wav',
      duration_seconds: 0,
      entries: [],
    };
  }

  // We'll iterate through all items in order, grouping pronunciations into utterances
  // and appending punctuation to the current utterance text.

  const entries = [];
  let currentUtterance = null; // { speaker, startTime, endTime, words[] }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.type === 'punctuation') {
      // Append punctuation directly to current utterance (no space)
      if (currentUtterance) {
        const punct = item.alternatives[0].content;
        currentUtterance.words.push({ isPunctuation: true, content: punct });
      }
      continue;
    }

    if (item.type !== 'pronunciation') {
      continue;
    }

    const startTime = parseFloat(item.start_time);
    const endTime = parseFloat(item.end_time);
    const speakerLabel = item.speaker_label;
    const content = item.alternatives[0].content;

    if (currentUtterance === null) {
      // Start first utterance
      currentUtterance = {
        speaker: speakerLabel,
        startTime,
        endTime,
        words: [{ isPunctuation: false, content }],
      };
    } else {
      // Check if we should continue or split
      const speakerChanged = speakerLabel !== currentUtterance.speaker;
      const gap = startTime - currentUtterance.endTime;
      const gapTooLarge = gap > 2;

      if (speakerChanged || gapTooLarge) {
        // Flush current utterance
        entries.push(buildEntry(currentUtterance, seSpeakerLabel));
        // Start new utterance
        currentUtterance = {
          speaker: speakerLabel,
          startTime,
          endTime,
          words: [{ isPunctuation: false, content }],
        };
      } else {
        // Continue current utterance
        currentUtterance.endTime = endTime;
        currentUtterance.words.push({ isPunctuation: false, content });
      }
    }
  }

  // Flush final utterance
  if (currentUtterance) {
    entries.push(buildEntry(currentUtterance, seSpeakerLabel));
  }

  // duration = ceil of last pronunciation item's end_time
  const lastPronunciation = pronunciationItems[pronunciationItems.length - 1];
  const durationSeconds = Math.ceil(parseFloat(lastPronunciation.end_time));

  return {
    session_id: sessionId,
    source: 'recording.wav',
    duration_seconds: durationSeconds,
    entries,
  };
}

/**
 * Build a single transcript entry from an utterance object.
 * @param {{ speaker: string, startTime: number, endTime: number, words: Array<{isPunctuation: boolean, content: string}> }} utterance
 * @param {string} seSpeakerLabel
 * @returns {{ timestamp: string, speaker: string, text: string }}
 */
function buildEntry(utterance, seSpeakerLabel) {
  let text = '';
  for (const word of utterance.words) {
    if (word.isPunctuation) {
      text += word.content;
    } else {
      if (text.length > 0) {
        text += ' ';
      }
      text += word.content;
    }
  }

  return {
    timestamp: formatTimestamp(utterance.startTime),
    speaker: mapSpeaker(utterance.speaker, seSpeakerLabel),
    text,
  };
}

module.exports = {
  formatTimestamp,
  mapSpeaker,
  convertTranscript,
};
