#!/usr/bin/env node
'use strict';

/**
 * test-upload.js — Unit tests for s3-upload module with mocked S3 client.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { uploadFileWithRetry, uploadJsonWithRetry, MULTIPART_THRESHOLD } = require('./lib/s3-upload');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.log(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.log(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

// Create a temp WAV file for testing
function createTempFile(sizeBytes) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boothapp-test-'));
  const filePath = path.join(tmpDir, 'recording.wav');
  const buf = Buffer.alloc(sizeBytes, 0x42);
  fs.writeFileSync(filePath, buf);
  return { tmpDir, filePath };
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// Mock S3 client that records calls
function createMockS3({ failCount = 0 } = {}) {
  let callCount = 0;
  const calls = [];

  return {
    calls,
    send(command) {
      callCount++;
      calls.push({ name: command.constructor.name, input: command.input });
      if (callCount <= failCount) {
        return Promise.reject(new Error(`Mock failure #${callCount}`));
      }
      // For GetObjectCommand, return mock metadata
      if (command.constructor.name === 'GetObjectCommand') {
        return Promise.resolve({
          Body: {
            transformToString: () => Promise.resolve(JSON.stringify({
              session_id: 'TEST123',
              status: 'completed',
            })),
          },
        });
      }
      return Promise.resolve({});
    },
  };
}

async function runTests() {
  console.log('=== s3-upload unit tests ===\n');

  // -- Constants --
  test('MULTIPART_THRESHOLD is 100MB', () => {
    assert.strictEqual(MULTIPART_THRESHOLD, 100 * 1024 * 1024);
  });

  // -- Small file upload (PutObject) --
  await testAsync('uploadFileWithRetry: small file uses PutObjectCommand', async () => {
    const { tmpDir, filePath } = createTempFile(1024);
    const mock = createMockS3();
    await uploadFileWithRetry(mock, 'test-bucket', 'test/key.wav', filePath, 'audio/wav');
    assert.strictEqual(mock.calls.length, 1);
    assert.strictEqual(mock.calls[0].name, 'PutObjectCommand');
    cleanup(tmpDir);
  });

  // -- Retry on failure --
  await testAsync('uploadFileWithRetry: retries on transient failure', async () => {
    const { tmpDir, filePath } = createTempFile(1024);
    const mock = createMockS3({ failCount: 2 }); // fail twice, succeed on 3rd
    await uploadFileWithRetry(mock, 'test-bucket', 'test/key.wav', filePath, 'audio/wav');
    assert.strictEqual(mock.calls.length, 3);
    cleanup(tmpDir);
  });

  // -- Exhausted retries --
  await testAsync('uploadFileWithRetry: throws after MAX_RETRIES exhausted', async () => {
    const { tmpDir, filePath } = createTempFile(1024);
    const mock = createMockS3({ failCount: 5 }); // always fail
    try {
      await uploadFileWithRetry(mock, 'test-bucket', 'test/key.wav', filePath, 'audio/wav');
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('after 3 attempts'));
    }
    cleanup(tmpDir);
  });

  // -- JSON upload --
  await testAsync('uploadJsonWithRetry: uploads JSON object', async () => {
    const mock = createMockS3();
    await uploadJsonWithRetry(mock, 'test-bucket', 'test/data.json', { foo: 'bar' });
    assert.strictEqual(mock.calls.length, 1);
    assert.strictEqual(mock.calls[0].name, 'PutObjectCommand');
  });

  // -- JSON retry --
  await testAsync('uploadJsonWithRetry: retries on failure', async () => {
    const mock = createMockS3({ failCount: 1 });
    await uploadJsonWithRetry(mock, 'test-bucket', 'test/data.json', { a: 1 });
    assert.strictEqual(mock.calls.length, 2);
  });

  // -- File not found --
  await testAsync('uploadFileWithRetry: throws if file missing', async () => {
    const mock = createMockS3();
    try {
      await uploadFileWithRetry(mock, 'test-bucket', 'test/key.wav', '/nonexistent/file.wav', 'audio/wav');
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('ENOENT') || err.message.includes('no such file'));
    }
  });

  console.log(`\n=== Results: ${passed}/${passed + failed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
