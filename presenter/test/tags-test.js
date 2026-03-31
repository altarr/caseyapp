'use strict';

// Test for session tag API routes
// Mocks S3Cache — tests route logic only

const http = require('http');
const express = require('express');
const assert = require('assert');

// Suppress ERR_HTTP_HEADERS_SENT from response-time middleware (pre-existing in sessions.js)
process.on('uncaughtException', (e) => {
  if (e.code === 'ERR_HTTP_HEADERS_SENT') return;
  console.error(e);
  process.exit(1);
});

// Mock S3Cache
class MockS3Cache {
  constructor() {
    this.store = {
      'sessions/TEST-001/metadata.json': {
        session_id: 'TEST-001',
        visitor_name: 'Test User',
        status: 'completed',
        tags: ['existing-tag']
      }
    };
  }
  async listSessions() {
    return Object.values(this.store).map(m => ({ session_id: m.session_id, ...m }));
  }
  async _getCachedJson(key) {
    return this.store[key] || null;
  }
  async updateSessionTags(sessionId, tags) {
    const key = `sessions/${sessionId}/metadata.json`;
    if (!this.store[key]) throw new Error('Not found');
    this.store[key].tags = tags;
    return tags;
  }
  stats() { return { entries: 0 }; }
}

// Patch S3Cache constructor before requiring sessions
const s3CacheMod = require('../../infra/s3-cache');
const OrigS3Cache = s3CacheMod.S3Cache;
const mockCache = new MockS3Cache();
s3CacheMod.S3Cache = function() { return mockCache; };

const { createRouter } = require('../lib/sessions');

// Restore
s3CacheMod.S3Cache = OrigS3Cache;

const app = express();
app.use(createRouter({ bucket: 'test-bucket' }));
// Suppress ERR_HTTP_HEADERS_SENT from response-time middleware (pre-existing issue)
app.use((err, req, res, next) => { if (!res.headersSent) res.status(500).json({ error: err.message }); });

let server;
let baseUrl;

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname };
    const headers = {};
    let bodyStr;
    if (body) {
      bodyStr = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    opts.headers = headers;
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function runTests() {
  // Start server
  server = app.listen(0);
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.log(`  [FAIL] ${name}: ${e.message}`);
      failed++;
    }
  }

  console.log('Tag API tests:');

  await test('PUT /api/sessions/:id/tags adds a tag', async () => {
    const res = await req('PUT', '/api/sessions/TEST-001/tags', { tag: 'hot-lead' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.tags.includes('hot-lead'));
    assert.ok(res.body.tags.includes('existing-tag'));
  });

  await test('PUT /api/sessions/:id/tags deduplicates', async () => {
    const res = await req('PUT', '/api/sessions/TEST-001/tags', { tag: 'hot-lead' });
    assert.strictEqual(res.status, 200);
    const count = res.body.tags.filter(t => t === 'hot-lead').length;
    assert.strictEqual(count, 1);
  });

  await test('PUT /api/sessions/:id/tags rejects empty tag', async () => {
    const res = await req('PUT', '/api/sessions/TEST-001/tags', { tag: '' });
    assert.strictEqual(res.status, 400);
  });

  await test('PUT /api/sessions/:id/tags 404 for unknown session', async () => {
    const res = await req('PUT', '/api/sessions/NONEXIST/tags', { tag: 'test' });
    assert.strictEqual(res.status, 404);
  });

  await test('DELETE /api/sessions/:id/tags/:tag removes a tag', async () => {
    const res = await req('DELETE', '/api/sessions/TEST-001/tags/hot-lead');
    assert.strictEqual(res.status, 200);
    assert.ok(!res.body.tags.includes('hot-lead'));
    assert.ok(res.body.tags.includes('existing-tag'));
  });

  await test('DELETE /api/sessions/:id/tags/:tag is idempotent', async () => {
    const res = await req('DELETE', '/api/sessions/TEST-001/tags/nonexistent');
    assert.strictEqual(res.status, 200);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => { console.error(e); process.exit(1); });
