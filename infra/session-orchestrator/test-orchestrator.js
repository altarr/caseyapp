#!/usr/bin/env node
'use strict';
/**
 * End-to-end Lambda handler test.
 *
 * Invokes the Lambda handler (index.js) with simulated API Gateway events
 * and verifies S3 state after each call. This tests the full path:
 *   HTTP event -> handler routing -> orchestrator logic -> S3 writes
 *
 * Steps:
 *   1. POST /sessions           -> createSession, verify metadata.json + commands/start.json
 *   2. GET  /sessions/:id       -> verify session readable via API
 *   3. POST /sessions/:id/end   -> endSession, verify commands/end.json + status=ended
 *
 * Usage:
 *   S3_BUCKET=boothapp-sessions-752266476357 AWS_PROFILE=hackathon node test-orchestrator.js
 *
 * Exit 0 on all pass, non-zero on any failure.
 */
var { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
var { handler } = require('./index');

var BUCKET = process.env.S3_BUCKET;
var REGION = process.env.AWS_REGION || 'us-east-1';
var DEMO_PC = 'e2epc' + Date.now();

if (!BUCKET) {
  console.error('ERROR: S3_BUCKET env var required');
  process.exit(1);
}

var s3 = new S3Client({ region: REGION });
var passed = 0;
var failed = 0;

async function check(desc, fn) {
  try {
    await fn();
    console.log('  [PASS] ' + desc);
    passed++;
  } catch (err) {
    console.error('  [FAIL] ' + desc + ': ' + err.message);
    failed++;
  }
}

function lambdaEvent(method, path, body) {
  return {
    httpMethod: method,
    path: path,
    body: body ? JSON.stringify(body) : null,
  };
}

async function s3Exists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (_) {
    return false;
  }
}

async function s3Get(key) {
  var res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return JSON.parse(await res.Body.transformToString());
}

(async function main() {
  console.log('\n=== Session Orchestrator Lambda E2E Test ===');
  console.log('Bucket: ' + BUCKET);
  console.log('Demo PC: ' + DEMO_PC);

  // -- Step 1: POST /sessions (createSession) --------------------------------

  console.log('\n-- POST /sessions (createSession) --');
  var createResp = await handler(lambdaEvent('POST', '/sessions', {
    visitor_name: 'E2E Test Visitor',
    demo_pc: DEMO_PC,
    se_name: 'E2E Tester',
    audio_consent: true,
  }));
  var createBody = JSON.parse(createResp.body);
  var sid = createBody.session_id;
  console.log('  HTTP ' + createResp.statusCode + ', session_id: ' + sid);

  await check('createSession returns 201', function() {
    if (createResp.statusCode !== 201)
      throw new Error('expected 201, got ' + createResp.statusCode);
  });

  await check('createSession returns session_id', function() {
    if (!sid) throw new Error('missing session_id in response body');
  });

  await check('metadata.json exists in S3', async function() {
    if (!await s3Exists('sessions/' + sid + '/metadata.json'))
      throw new Error('sessions/' + sid + '/metadata.json not found');
  });

  await check('metadata.json status = active', async function() {
    var meta = await s3Get('sessions/' + sid + '/metadata.json');
    if (meta.status !== 'active')
      throw new Error('expected active, got ' + meta.status);
  });

  await check('commands/start.json written for demo PC', async function() {
    if (!await s3Exists('commands/' + DEMO_PC + '/start.json'))
      throw new Error('commands/' + DEMO_PC + '/start.json not found');
  });

  await check('start.json references correct session_id', async function() {
    var cmd = await s3Get('commands/' + DEMO_PC + '/start.json');
    if (cmd.session_id !== sid)
      throw new Error('expected ' + sid + ', got ' + cmd.session_id);
  });

  // -- Step 2: GET /sessions/:id (getSession) --------------------------------

  console.log('\n-- GET /sessions/:id (getSession) --');
  var getResp = await handler(lambdaEvent('GET', '/sessions/' + sid));
  var getBody = JSON.parse(getResp.body);

  await check('getSession returns 200', function() {
    if (getResp.statusCode !== 200)
      throw new Error('expected 200, got ' + getResp.statusCode);
  });

  await check('getSession returns correct session_id', function() {
    if (getBody.session_id !== sid)
      throw new Error('expected ' + sid + ', got ' + getBody.session_id);
  });

  await check('getSession shows start command sent', function() {
    if (!getBody.commands || !getBody.commands.start_sent)
      throw new Error('commands.start_sent is false or missing');
  });

  // -- Step 3: POST /sessions/:id/end (endSession) ---------------------------

  console.log('\n-- POST /sessions/:id/end (endSession) --');
  var endResp = await handler(lambdaEvent('POST', '/sessions/' + sid + '/end', {
    demo_pc: DEMO_PC,
  }));
  var endBody = JSON.parse(endResp.body);
  console.log('  HTTP ' + endResp.statusCode + ', status: ' + endBody.status);

  await check('endSession returns 200', function() {
    if (endResp.statusCode !== 200)
      throw new Error('expected 200, got ' + endResp.statusCode);
  });

  await check('endSession returns status ended', function() {
    if (endBody.status !== 'ended')
      throw new Error('expected ended, got ' + endBody.status);
  });

  await check('commands/end.json written for demo PC', async function() {
    if (!await s3Exists('commands/' + DEMO_PC + '/end.json'))
      throw new Error('commands/' + DEMO_PC + '/end.json not found');
  });

  await check('end.json references correct session_id', async function() {
    var cmd = await s3Get('commands/' + DEMO_PC + '/end.json');
    if (cmd.session_id !== sid)
      throw new Error('expected ' + sid + ', got ' + cmd.session_id);
  });

  await check('metadata.json status = ended after endSession', async function() {
    var meta = await s3Get('sessions/' + sid + '/metadata.json');
    if (meta.status !== 'ended')
      throw new Error('expected ended, got ' + meta.status);
  });

  await check('metadata.json has ended_at timestamp', async function() {
    var meta = await s3Get('sessions/' + sid + '/metadata.json');
    if (!meta.ended_at)
      throw new Error('ended_at is null/missing');
  });

  // -- Step 4: Verify idempotent re-end ---------------------------------------

  console.log('\n-- POST /sessions/:id/end (re-end, idempotent) --');
  var reEndResp = await handler(lambdaEvent('POST', '/sessions/' + sid + '/end', {
    demo_pc: DEMO_PC,
  }));
  var reEndBody = JSON.parse(reEndResp.body);

  await check('re-ending returns 200 (idempotent)', function() {
    if (reEndResp.statusCode !== 200)
      throw new Error('expected 200, got ' + reEndResp.statusCode);
  });

  await check('re-ending returns already-ended message', function() {
    if (!reEndBody.message || !reEndBody.message.includes('already'))
      throw new Error('expected already-ended message, got: ' + JSON.stringify(reEndBody));
  });

  // -- Step 5: GET /health ----------------------------------------------------

  console.log('\n-- GET /health --');
  var healthResp = await handler(lambdaEvent('GET', '/health'));

  await check('health returns 200', function() {
    if (healthResp.statusCode !== 200)
      throw new Error('expected 200, got ' + healthResp.statusCode);
  });

  // -- Summary ----------------------------------------------------------------

  console.log('\n---------------------------------');
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed > 0 ? 1 : 0);
})();
