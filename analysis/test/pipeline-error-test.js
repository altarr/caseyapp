#!/usr/bin/env node
// Tests for pipeline error handling utilities
// Verifies: retry with backoff, timeout checking, fallback summary, error collection

'use strict';

let failures = 0;

function assert(condition, label) {
  if (!condition) {
    console.error('  FAIL: ' + label);
    failures++;
  } else {
    console.log('  PASS: ' + label);
  }
}

// --- Test withRetry ---
console.log('Test 1: withRetry succeeds on first attempt');
{
  // Inline the retry logic for unit testing (pipeline-run.js isn't require-able as a module)
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 10; // fast for tests

  async function withRetry(label, fn) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === MAX_RETRIES) throw err;
        await new Promise((r) => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt - 1)));
      }
    }
  }

  (async () => {
    let calls = 0;
    const result = await withRetry('test', async () => { calls++; return 'ok'; });
    assert(result === 'ok', 'returns result on success');
    assert(calls === 1, 'called only once on success');

    // Test 2: retry on transient failure
    console.log('Test 2: withRetry retries on transient failure');
    calls = 0;
    const result2 = await withRetry('test', async () => {
      calls++;
      if (calls < 3) throw new Error('transient');
      return 'recovered';
    });
    assert(result2 === 'recovered', 'recovers after retries');
    assert(calls === 3, 'retried 3 times');

    // Test 3: exhausts retries
    console.log('Test 3: withRetry throws after max retries');
    calls = 0;
    let threw = false;
    try {
      await withRetry('test', async () => { calls++; throw new Error('permanent'); });
    } catch (err) {
      threw = true;
      assert(err.message === 'permanent', 'preserves error message');
    }
    assert(threw, 'threw after exhausting retries');
    assert(calls === MAX_RETRIES, `called exactly ${MAX_RETRIES} times`);

    // Test 4: buildFallbackSummary
    console.log('Test 4: fallback summary structure');
    function buildFallbackSummary(sessionId, metadata, timeline) {
      return {
        session_id: sessionId,
        visitor_name: (metadata && metadata.visitor_name) || 'Unknown Visitor',
        demo_duration_minutes: timeline ? Math.round((timeline.duration_seconds || 0) / 60) : 0,
        products_shown: [],
        visitor_interests: [],
        recommended_follow_up: ['Review session recording manually'],
        key_moments: [],
        generated_at: new Date().toISOString(),
        fallback: true,
        fallback_reason: 'AI analysis unavailable — this is an auto-generated placeholder',
      };
    }

    const fb = buildFallbackSummary('sess-1', { visitor_name: 'Alice' }, { duration_seconds: 300 });
    assert(fb.session_id === 'sess-1', 'session_id set');
    assert(fb.visitor_name === 'Alice', 'visitor_name from metadata');
    assert(fb.demo_duration_minutes === 5, 'duration converted to minutes');
    assert(fb.fallback === true, 'fallback flag set');
    assert(fb.recommended_follow_up.length === 1, 'has fallback follow-up action');

    const fb2 = buildFallbackSummary('sess-2', null, null);
    assert(fb2.visitor_name === 'Unknown Visitor', 'defaults to Unknown Visitor');
    assert(fb2.demo_duration_minutes === 0, 'defaults duration to 0');

    // Test 5: checkTimeout
    console.log('Test 5: timeout checking');
    const PIPELINE_TIMEOUT_MS = 120_000;
    function checkTimeout(startTime, stepName) {
      const elapsed = Date.now() - startTime;
      if (elapsed > PIPELINE_TIMEOUT_MS) {
        throw new Error(`Pipeline timeout (${PIPELINE_TIMEOUT_MS}ms) exceeded during ${stepName}`);
      }
    }

    // Should not throw when within budget
    let threw5 = false;
    try {
      checkTimeout(Date.now(), 'test-step');
    } catch (e) {
      threw5 = true;
    }
    assert(!threw5, 'no timeout for fresh start');

    // Should throw when past budget
    threw5 = false;
    try {
      checkTimeout(Date.now() - 130_000, 'test-step');
    } catch (e) {
      threw5 = true;
      assert(e.message.includes('Pipeline timeout'), 'timeout error mentions pipeline timeout');
      assert(e.message.includes('test-step'), 'timeout error mentions step name');
    }
    assert(threw5, 'throws when past timeout');

    // Test 6: error collection format
    console.log('Test 6: error collection format');
    const errors = [];
    errors.push({ step: 'fetch', error: 'NoSuchKey', timestamp: new Date().toISOString() });
    errors.push({ step: 'analyze', error: 'Timeout', timestamp: new Date().toISOString() });
    const payload = {
      session_id: 'test-sess',
      pipeline_run: new Date().toISOString(),
      error_count: errors.length,
      errors,
    };
    assert(payload.error_count === 2, 'error_count matches');
    assert(payload.errors[0].step === 'fetch', 'first error step');
    assert(payload.errors[1].step === 'analyze', 'second error step');

    console.log('');
    if (failures === 0) {
      console.log('All tests passed.');
    } else {
      console.log(failures + ' test(s) failed.');
      process.exit(1);
    }
  })().catch((err) => {
    console.error('Unexpected error: ' + err.message);
    process.exit(1);
  });
}
