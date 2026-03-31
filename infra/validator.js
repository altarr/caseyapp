#!/usr/bin/env node
// Session data validator
// Validates session data completeness and correctness before analysis.
// Pure validation — no S3 or I/O dependencies. Accepts parsed objects.
//
// Usage:
//   const { validateSession } = require('./validator');
//   const result = validateSession(metadata, clicks, transcript);
//   // result = { valid: boolean, errors: string[], warnings: string[] }

'use strict';

// Check if a string is a valid ISO-8601 date
function isValidISODate(str) {
  if (typeof str !== 'string') return false;
  const d = new Date(str);
  return !isNaN(d.getTime()) && str.includes('T');
}

// Check if a string is a valid HH:MM:SS or HH:MM:SS.mmm offset timestamp
function isValidOffsetTimestamp(str) {
  if (typeof str !== 'string') return false;
  return /^\d{1,2}:\d{2}:\d{2}(\.\d{1,3})?$/.test(str);
}

// Parse an offset timestamp (HH:MM:SS.mmm) to milliseconds for ordering comparison
function offsetToMs(str) {
  const match = str.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) return NaN;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const s = parseInt(match[3], 10);
  const ms = match[4] ? parseInt(match[4].padEnd(3, '0'), 10) : 0;
  return ((h * 3600) + (m * 60) + s) * 1000 + ms;
}

// Check if timestamps are chronologically ordered.
// Accepts ISO dates or HH:MM:SS.mmm offsets.
function areChronological(timestamps) {
  if (timestamps.length < 2) return true;

  const isISO = isValidISODate(timestamps[0]);
  for (let i = 1; i < timestamps.length; i++) {
    let prev, curr;
    if (isISO) {
      prev = new Date(timestamps[i - 1]).getTime();
      curr = new Date(timestamps[i]).getTime();
    } else {
      prev = offsetToMs(timestamps[i - 1]);
      curr = offsetToMs(timestamps[i]);
    }
    if (curr < prev) return false;
  }
  return true;
}

function validateMetadata(metadata, errors, warnings) {
  if (!metadata || typeof metadata !== 'object') {
    errors.push('metadata.json is missing or not an object');
    return;
  }

  if (!metadata.session_id) {
    errors.push('metadata.json: missing required field "session_id"');
  }
  if (!metadata.visitor_name) {
    errors.push('metadata.json: missing required field "visitor_name"');
  }
  if (metadata.status !== 'completed' && metadata.status !== 'ended') {
    errors.push(`metadata.json: status must be "completed" or "ended", got "${metadata.status}"`);
  }

  // Warnings for optional but expected fields
  if (!metadata.started_at) {
    warnings.push('metadata.json: missing "started_at" timestamp');
  } else if (!isValidISODate(metadata.started_at)) {
    warnings.push('metadata.json: "started_at" is not a valid ISO date');
  }
  if (!metadata.ended_at) {
    warnings.push('metadata.json: missing "ended_at" timestamp');
  } else if (!isValidISODate(metadata.ended_at)) {
    warnings.push('metadata.json: "ended_at" is not a valid ISO date');
  }
}

function validateClicks(clicks, errors, warnings) {
  if (!clicks || typeof clicks !== 'object') {
    errors.push('clicks.json is missing or not an object');
    return;
  }

  if (!Array.isArray(clicks.events)) {
    errors.push('clicks.json: "events" must be an array');
    return;
  }

  if (clicks.events.length === 0) {
    errors.push('clicks.json: "events" array must have at least 1 click');
    return;
  }

  const timestamps = [];
  clicks.events.forEach((evt, i) => {
    const prefix = `clicks.json events[${i}]`;

    if (!evt.timestamp) {
      errors.push(`${prefix}: missing "timestamp"`);
    } else if (!isValidISODate(evt.timestamp)) {
      errors.push(`${prefix}: "timestamp" is not a valid ISO date`);
    } else {
      timestamps.push(evt.timestamp);
    }

    // DATA-CONTRACT uses page_url, but spec says "url" — accept either
    const url = evt.page_url || evt.url;
    if (!url) {
      errors.push(`${prefix}: missing "page_url" (or "url")`);
    }

    if (!evt.element || typeof evt.element !== 'object') {
      errors.push(`${prefix}: missing "element" object`);
    }
  });

  if (timestamps.length > 1 && !areChronological(timestamps)) {
    warnings.push('clicks.json: click timestamps are not in chronological order');
  }
}

function validateTranscript(transcript, errors, warnings) {
  if (!transcript || typeof transcript !== 'object') {
    errors.push('transcript.json is missing or not an object');
    return;
  }

  if (!Array.isArray(transcript.entries)) {
    errors.push('transcript.json: "entries" must be an array');
    return;
  }

  if (transcript.entries.length === 0) {
    errors.push('transcript.json: "entries" array must have at least 1 entry');
    return;
  }

  const timestamps = [];
  transcript.entries.forEach((entry, i) => {
    const prefix = `transcript.json entries[${i}]`;

    if (!entry.timestamp) {
      errors.push(`${prefix}: missing "timestamp"`);
    } else if (!isValidISODate(entry.timestamp) && !isValidOffsetTimestamp(entry.timestamp)) {
      errors.push(`${prefix}: "timestamp" is not a valid ISO date or HH:MM:SS offset`);
    } else {
      timestamps.push(entry.timestamp);
    }

    if (!entry.speaker) {
      errors.push(`${prefix}: missing "speaker"`);
    }

    if (!entry.text) {
      errors.push(`${prefix}: missing "text"`);
    }
  });

  if (timestamps.length > 1 && !areChronological(timestamps)) {
    warnings.push('transcript.json: entry timestamps are not in chronological order');
  }
}

// Validate a complete session's data.
// All three arguments are parsed JSON objects (not file paths).
// Returns { valid: boolean, errors: string[], warnings: string[] }
function validateSession(metadata, clicks, transcript) {
  const errors = [];
  const warnings = [];

  validateMetadata(metadata, errors, warnings);
  validateClicks(clicks, errors, warnings);
  validateTranscript(transcript, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

module.exports = { validateSession, isValidISODate, isValidOffsetTimestamp, areChronological };
