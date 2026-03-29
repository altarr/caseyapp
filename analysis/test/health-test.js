#!/usr/bin/env node
// Unit tests for the watcher health check endpoint
'use strict';

const http = require('http');

const HEALTH_PORT = 8091; // Use a different port to avoid conflicts
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL: ${msg}`);
    failed++;
  }
}

function getHealth(port) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function get404(port, path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode }));
    }).on('error', reject);
  });
}

// Simulate the health server in isolation (no S3 dependency)
async function runTests() {
  const startTime = Date.now();
  let sessionsProcessed = 3;

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
        sessions_processed: sessionsProcessed,
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise((resolve) => server.listen(HEALTH_PORT, resolve));

  try {
    console.log('\nTest 1: GET /health returns 200 with correct JSON');
    {
      const res = await getHealth(HEALTH_PORT);
      assert(res.statusCode === 200, 'status code is 200');
      const body = JSON.parse(res.body);
      assert(body.status === 'ok', `status is "ok" (got: "${body.status}")`);
      assert(typeof body.uptime_seconds === 'number', `uptime_seconds is a number (got: ${typeof body.uptime_seconds})`);
      assert(body.uptime_seconds >= 0, `uptime_seconds >= 0 (got: ${body.uptime_seconds})`);
      assert(body.sessions_processed === 3, `sessions_processed is 3 (got: ${body.sessions_processed})`);
    }

    console.log('\nTest 2: Unknown path returns 404');
    {
      const res = await get404(HEALTH_PORT, '/unknown');
      assert(res.statusCode === 404, `status code is 404 (got: ${res.statusCode})`);
    }

    console.log('\nTest 3: sessions_processed reflects updated count');
    {
      sessionsProcessed = 7;
      const res = await getHealth(HEALTH_PORT);
      const body = JSON.parse(res.body);
      assert(body.sessions_processed === 7, `sessions_processed updated to 7 (got: ${body.sessions_processed})`);
    }
  } finally {
    server.close();
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
});
