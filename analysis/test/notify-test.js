#!/usr/bin/env node
// notify-test.js — Dry-run notification test (no S3 required)
//
// Usage:
//   node analysis/test/notify-test.js
//   WEBHOOK_URL=https://hooks.slack.com/... node analysis/test/notify-test.js
//
// Tests the notification module with sample data, skipping S3 writes.

'use strict';

const { sendNotification, buildNotification } = require('../lib/notify');

const sampleMetadata = {
  session_id: 'TEST-001',
  visitor_name: 'Priya Sharma',
  company: 'Acme Corp',
  started_at: '2026-08-06T10:15:00Z',
  ended_at: '2026-08-06T10:32:00Z',
  se_name: 'Casey Mondoux',
  status: 'completed',
};

const sampleSummary = {
  session_id: 'TEST-001',
  visitor_name: 'Priya Sharma',
  demo_duration_seconds: 1020,
  session_score: 8,
  products_demonstrated: ['XDR', 'Endpoint Security'],
  key_interests: [
    { topic: 'XDR correlation', confidence: 'high', evidence: 'asked 3 questions about it' },
  ],
  follow_up_actions: [
    'Schedule deep-dive on XDR workbench',
    'Share XDR integration guide PDF',
  ],
};

const sampleFollowUp = {
  session_id: 'TEST-001',
  priority: 'high',
  sdr_notes: 'Priya is a SOC manager at Acme Corp evaluating XDR solutions. Strong interest in XDR correlation and endpoint integration. Currently using a competitor product. Wants to see a PoC within 2 weeks.',
  tags: ['xdr', 'endpoint'],
};

async function runTest() {
  console.log('=== Notification Module Test (dry run) ===\n');

  // Test 1: buildNotification
  console.log('--- Test 1: buildNotification ---');
  const notification = buildNotification({
    sessionId: 'TEST-001',
    bucket: 'test-bucket',
    metadata: sampleMetadata,
    summary: sampleSummary,
    followUp: sampleFollowUp,
  });

  const requiredFields = ['session_id', 'visitor_name', 'company', 'session_score', 'score', 'executive_summary', 'products_demonstrated', 'completed_at', 'report_url'];
  const missing = requiredFields.filter((f) => !(f in notification));
  if (missing.length > 0) {
    console.error(`FAIL: Missing fields: ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log('PASS: All required fields present');
  console.log(`  session_id: ${notification.session_id}`);
  console.log(`  visitor_name: ${notification.visitor_name}`);
  console.log(`  company: ${notification.company}`);
  console.log(`  session_score: ${notification.session_score}`);
  console.log(`  score: ${notification.score}`);
  console.log(`  products_demonstrated: ${JSON.stringify(notification.products_demonstrated)}`);
  console.log(`  report_url: ${notification.report_url}`);
  console.log('');

  // Test 2: sendNotification (dry run)
  console.log('--- Test 2: sendNotification (dry run) ---');
  const result = await sendNotification({
    sessionId: 'TEST-001',
    bucket: 'test-bucket',
    metadata: sampleMetadata,
    summary: sampleSummary,
    followUp: sampleFollowUp,
    dryRun: true,
  });

  if (result.session_id !== 'TEST-001') {
    console.error('FAIL: Returned notification has wrong session_id');
    process.exit(1);
  }
  console.log('PASS: Dry-run notification completed');

  // Test 3: score mapping
  console.log('\n--- Test 3: Score mapping ---');
  for (const [priority, expected] of [['high', 'high'], ['medium', 'medium'], ['low', 'low']]) {
    const n = buildNotification({
      sessionId: 'TEST-SCORE',
      bucket: 'b',
      metadata: {},
      summary: {},
      followUp: { priority },
    });
    if (n.score !== expected) {
      console.error(`FAIL: priority=${priority} -> score=${n.score}, expected ${expected}`);
      process.exit(1);
    }
  }
  console.log('PASS: All priority->score mappings correct');

  // Test 4: session_score and products_demonstrated
  console.log('\n--- Test 4: Webhook payload fields ---');
  const webhookNotification = buildNotification({
    sessionId: 'TEST-WEBHOOK',
    bucket: 'b',
    metadata: { company: 'TestCo' },
    summary: { visitor_name: 'Jane Doe', session_score: 7, products_demonstrated: ['XDR', 'Cloud Security'] },
    followUp: { priority: 'high', sdr_notes: 'Strong interest in XDR.' },
  });
  if (webhookNotification.session_score !== 7) {
    console.error(`FAIL: session_score=${webhookNotification.session_score}, expected 7`);
    process.exit(1);
  }
  if (!Array.isArray(webhookNotification.products_demonstrated) || webhookNotification.products_demonstrated.length !== 2) {
    console.error(`FAIL: products_demonstrated=${JSON.stringify(webhookNotification.products_demonstrated)}, expected 2-element array`);
    process.exit(1);
  }
  if (webhookNotification.executive_summary !== 'Strong interest in XDR.') {
    console.error(`FAIL: executive_summary mismatch`);
    process.exit(1);
  }
  console.log('PASS: session_score, products_demonstrated, executive_summary correct');

  // Test 5: missing summary fields default gracefully
  console.log('\n--- Test 5: Missing summary fields ---');
  const sparseNotification = buildNotification({
    sessionId: 'TEST-SPARSE',
    bucket: 'b',
    metadata: {},
    summary: {},
    followUp: { priority: 'low' },
  });
  if (sparseNotification.session_score !== null) {
    console.error(`FAIL: session_score should be null when missing, got ${sparseNotification.session_score}`);
    process.exit(1);
  }
  if (!Array.isArray(sparseNotification.products_demonstrated) || sparseNotification.products_demonstrated.length !== 0) {
    console.error(`FAIL: products_demonstrated should be empty array when missing`);
    process.exit(1);
  }
  console.log('PASS: Missing fields default correctly (null / empty array)');

  console.log('\n=== All tests passed ===');
}

runTest().catch((err) => {
  console.error(`Test FATAL: ${err.message}`);
  process.exit(1);
});
