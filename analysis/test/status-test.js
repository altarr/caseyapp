'use strict';

// Unit tests for analysis/lib/status.js
// Mocks S3 to capture what would be written, then verifies the payloads.

const { createTracker, STAGES } = require('../lib/status');

// --- S3 mock ---
const captured = [];
const originalPut = require('@aws-sdk/client-s3').S3Client.prototype.send;

require('@aws-sdk/client-s3').S3Client.prototype.send = async function (cmd) {
  if (cmd.constructor.name === 'PutObjectCommand') {
    captured.push({
      key: cmd.input.Key,
      body: JSON.parse(cmd.input.Body),
    });
    return {};
  }
  return originalPut.call(this, cmd);
};

let failures = 0;

function assert(condition, label) {
  if (!condition) {
    console.error('  FAIL: ' + label);
    failures++;
  } else {
    console.log('  PASS: ' + label);
  }
}

async function runTests() {
  // Test 1: update writes correct fields
  console.log('Test 1: update writes correct fields');
  captured.length = 0;
  const tracker = createTracker('sess-001', 'my-bucket');
  await tracker.update('correlating', 'Building timeline');
  assert(captured.length === 1, 'one S3 write');
  const payload = captured[0].body;
  assert(payload.session_id === 'sess-001', 'session_id');
  assert(payload.stage === 'correlating', 'stage');
  assert(payload.progress_pct === 20, 'progress_pct = 20');
  assert(typeof payload.started_at === 'string', 'started_at is string');
  assert(typeof payload.updated_at === 'string', 'updated_at is string');
  assert(payload.estimated_completion !== null, 'estimated_completion not null');
  assert(payload.message === 'Building timeline', 'message');
  assert(captured[0].key === 'sessions/sess-001/output/status.json', 'S3 key');

  // Test 2: complete sets 100%
  console.log('Test 2: complete sets 100%');
  captured.length = 0;
  await tracker.complete();
  assert(captured.length === 1, 'one S3 write');
  assert(captured[0].body.stage === 'complete', 'stage = complete');
  assert(captured[0].body.progress_pct === 100, 'progress_pct = 100');
  assert(captured[0].body.estimated_completion === null, 'no estimated_completion when complete');

  // Test 3: fail sets error stage
  console.log('Test 3: fail sets error stage');
  captured.length = 0;
  await tracker.fail('Something broke');
  assert(captured.length === 1, 'one S3 write');
  assert(captured[0].body.stage === 'error', 'stage = error');
  assert(captured[0].body.progress_pct === -1, 'progress_pct = -1');
  assert(captured[0].body.message === 'Something broke', 'error message');

  // Test 4: all stages defined
  console.log('Test 4: all stages have valid pct');
  const stageKeys = Object.keys(STAGES);
  assert(stageKeys.length >= 6, 'at least 6 stages defined');
  for (const key of stageKeys) {
    assert(typeof STAGES[key].pct === 'number', key + ' has numeric pct');
    assert(typeof STAGES[key].typicalSeconds === 'number', key + ' has typicalSeconds');
  }

  // Test 5: progress percentages are monotonically increasing (except error)
  console.log('Test 5: progress percentages increase through stages');
  const orderedStages = stageKeys.filter(k => k !== 'error');
  for (let i = 1; i < orderedStages.length; i++) {
    assert(
      STAGES[orderedStages[i]].pct > STAGES[orderedStages[i - 1]].pct,
      orderedStages[i] + ' > ' + orderedStages[i - 1]
    );
  }

  // Test 6: estimated_completion decreases as stages progress
  console.log('Test 6: estimated_completion decreases over time');
  captured.length = 0;
  const tracker2 = createTracker('sess-002', 'my-bucket');
  await tracker2.update('fetching');
  await tracker2.update('analyzing');
  const est1 = new Date(captured[0].body.estimated_completion).getTime();
  const est2 = new Date(captured[1].body.estimated_completion).getTime();
  assert(est2 <= est1, 'later stage has earlier estimated_completion');

  console.log('');
  if (failures === 0) {
    console.log('All status tests passed.');
  } else {
    console.log(failures + ' test(s) failed.');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
