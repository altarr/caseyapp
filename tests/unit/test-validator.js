#!/usr/bin/env node
// Unit tests for infra/validator.js
// Run: node tests/unit/test-validator.js

'use strict';

const { validateSession, isValidISODate, isValidOffsetTimestamp, areChronological } = require('../../infra/validator');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

function test(name, fn) {
  console.log(`  ${name}`);
  fn();
}

// --- Helper tests ---

console.log('isValidISODate');
test('accepts valid ISO date', () => {
  assert(isValidISODate('2026-08-05T14:32:00Z'), 'UTC ISO date');
  assert(isValidISODate('2026-08-05T14:32:00.123Z'), 'ISO with ms');
});
test('rejects non-ISO strings', () => {
  assert(!isValidISODate('14:32:00'), 'time offset');
  assert(!isValidISODate('not-a-date'), 'garbage');
  assert(!isValidISODate(''), 'empty');
  assert(!isValidISODate(null), 'null');
});

console.log('isValidOffsetTimestamp');
test('accepts HH:MM:SS formats', () => {
  assert(isValidOffsetTimestamp('00:01:30'), 'basic');
  assert(isValidOffsetTimestamp('0:01:30.123'), 'with ms');
});
test('rejects bad offsets', () => {
  assert(!isValidOffsetTimestamp('2026-08-05T14:32:00Z'), 'ISO date');
  assert(!isValidOffsetTimestamp('abc'), 'garbage');
});

console.log('areChronological');
test('empty and single are chronological', () => {
  assert(areChronological([]), 'empty');
  assert(areChronological(['2026-01-01T00:00:00Z']), 'single');
});
test('ordered ISO dates pass', () => {
  assert(areChronological(['2026-01-01T00:00:00Z', '2026-01-01T00:01:00Z']), 'ordered');
});
test('unordered ISO dates fail', () => {
  assert(!areChronological(['2026-01-01T00:01:00Z', '2026-01-01T00:00:00Z']), 'unordered');
});
test('ordered offsets pass', () => {
  assert(areChronological(['0:00:10', '0:01:30', '0:05:00']), 'ordered offsets');
});
test('unordered offsets fail', () => {
  assert(!areChronological(['0:05:00', '0:01:30']), 'unordered offsets');
});

// --- Full validation tests ---

function validMetadata() {
  return { session_id: 'TEST1', visitor_name: 'Alice', status: 'completed', started_at: '2026-01-01T00:00:00Z', ended_at: '2026-01-01T00:30:00Z' };
}

function validClicks() {
  return {
    session_id: 'TEST1',
    events: [{
      timestamp: '2026-01-01T00:05:00Z',
      page_url: 'https://example.com',
      element: { tag: 'button', id: 'btn1', class: 'primary', text: 'Click me' },
    }],
  };
}

function validTranscript() {
  return {
    session_id: 'TEST1',
    entries: [{
      timestamp: '0:01:00',
      speaker: 'SE',
      text: 'Welcome to the demo',
    }],
  };
}

console.log('\nvalidateSession — valid data');
test('all valid returns valid=true, no errors', () => {
  const r = validateSession(validMetadata(), validClicks(), validTranscript());
  assert(r.valid === true, `expected valid=true, got ${r.valid}`);
  assert(r.errors.length === 0, `expected 0 errors, got ${r.errors.length}: ${r.errors.join('; ')}`);
});

console.log('\nvalidateSession — metadata errors');
test('missing session_id', () => {
  const m = validMetadata();
  delete m.session_id;
  const r = validateSession(m, validClicks(), validTranscript());
  assert(!r.valid, 'should be invalid');
  assert(r.errors.some(e => e.includes('session_id')), 'error mentions session_id');
});
test('missing visitor_name', () => {
  const m = validMetadata();
  delete m.visitor_name;
  const r = validateSession(m, validClicks(), validTranscript());
  assert(!r.valid, 'should be invalid');
  assert(r.errors.some(e => e.includes('visitor_name')), 'error mentions visitor_name');
});
test('wrong status', () => {
  const m = validMetadata();
  m.status = 'active';
  const r = validateSession(m, validClicks(), validTranscript());
  assert(!r.valid, 'should be invalid');
  assert(r.errors.some(e => e.includes('status')), 'error mentions status');
});
test('status=ended is accepted', () => {
  const m = validMetadata();
  m.status = 'ended';
  const r = validateSession(m, validClicks(), validTranscript());
  assert(r.valid, 'ended should be accepted');
});
test('null metadata', () => {
  const r = validateSession(null, validClicks(), validTranscript());
  assert(!r.valid, 'should be invalid');
});

console.log('\nvalidateSession — clicks errors');
test('empty events array', () => {
  const c = validClicks();
  c.events = [];
  const r = validateSession(validMetadata(), c, validTranscript());
  assert(!r.valid, 'should be invalid');
  assert(r.errors.some(e => e.includes('at least 1')), 'error mentions minimum');
});
test('click missing timestamp', () => {
  const c = validClicks();
  delete c.events[0].timestamp;
  const r = validateSession(validMetadata(), c, validTranscript());
  assert(!r.valid, 'should be invalid');
});
test('click missing page_url', () => {
  const c = validClicks();
  delete c.events[0].page_url;
  const r = validateSession(validMetadata(), c, validTranscript());
  assert(!r.valid, 'should be invalid');
});
test('click with url instead of page_url is accepted', () => {
  const c = validClicks();
  delete c.events[0].page_url;
  c.events[0].url = 'https://example.com';
  const r = validateSession(validMetadata(), c, validTranscript());
  assert(r.valid, 'url alias should work');
});
test('click missing element', () => {
  const c = validClicks();
  delete c.events[0].element;
  const r = validateSession(validMetadata(), c, validTranscript());
  assert(!r.valid, 'should be invalid');
});

console.log('\nvalidateSession — transcript errors');
test('empty entries array', () => {
  const t = validTranscript();
  t.entries = [];
  const r = validateSession(validMetadata(), validClicks(), t);
  assert(!r.valid, 'should be invalid');
});
test('entry missing speaker', () => {
  const t = validTranscript();
  delete t.entries[0].speaker;
  const r = validateSession(validMetadata(), validClicks(), t);
  assert(!r.valid, 'should be invalid');
});
test('entry missing text', () => {
  const t = validTranscript();
  delete t.entries[0].text;
  const r = validateSession(validMetadata(), validClicks(), t);
  assert(!r.valid, 'should be invalid');
});
test('entry with ISO timestamp works', () => {
  const t = validTranscript();
  t.entries[0].timestamp = '2026-01-01T00:01:00Z';
  const r = validateSession(validMetadata(), validClicks(), t);
  assert(r.valid, 'ISO timestamp in transcript should work');
});

console.log('\nvalidateSession — chronological order warnings');
test('out-of-order clicks produce warning', () => {
  const c = validClicks();
  c.events.push({
    timestamp: '2026-01-01T00:01:00Z', // earlier than first event
    page_url: 'https://example.com/2',
    element: { tag: 'a' },
  });
  const r = validateSession(validMetadata(), c, validTranscript());
  assert(r.valid, 'out-of-order is warning not error');
  assert(r.warnings.some(w => w.includes('chronological')), 'warning mentions chronological');
});

console.log('\nvalidateSession — warnings for missing optional metadata');
test('missing started_at produces warning', () => {
  const m = validMetadata();
  delete m.started_at;
  const r = validateSession(m, validClicks(), validTranscript());
  assert(r.valid, 'still valid');
  assert(r.warnings.some(w => w.includes('started_at')), 'warning for started_at');
});

// --- Summary ---
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log('All tests passed.');
