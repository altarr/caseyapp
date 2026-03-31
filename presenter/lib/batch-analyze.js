'use strict';

// Batch analysis API — queue multiple sessions for re-analysis
//
// POST /api/analyze-batch  { session_ids: ["id1", "id2"] }
// GET  /api/analyze-status

const { Router } = require('express');
const path = require('path');
const { spawn } = require('child_process');

// In-memory batch state (single-server, survives across requests but not restarts)
let batch = {
  id: null,
  started_at: null,
  session_ids: [],
  status: {},       // { sessionId: 'queued' | 'running' | 'completed' | 'failed' }
  errors: [],
};

function resetBatch(sessionIds) {
  const status = {};
  for (const id of sessionIds) {
    status[id] = 'queued';
  }
  batch = {
    id: Date.now().toString(36),
    started_at: new Date().toISOString(),
    session_ids: sessionIds,
    status,
    errors: [],
  };
}

function runPipeline(sessionId, bucket) {
  return new Promise((resolve, reject) => {
    const script = path.resolve(__dirname, '..', '..', 'analysis', 'pipeline-run.js');
    const env = { ...process.env, S3_BUCKET: bucket };
    const proc = spawn(process.execPath, [script, sessionId, bucket], {
      env,
      stdio: 'pipe',
    });

    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk; });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pipeline exited ${code}: ${stderr.slice(-500)}`));
    });
    proc.on('error', reject);
  });
}

async function processSession(sessionId, bucket) {
  batch.status[sessionId] = 'running';
  try {
    await runPipeline(sessionId, bucket);
    batch.status[sessionId] = 'completed';
  } catch (err) {
    batch.status[sessionId] = 'failed';
    batch.errors.push({ session_id: sessionId, error: err.message });
  }
}

function createRouter(opts) {
  const router = Router();
  const bucket = (opts && opts.bucket) || process.env.S3_BUCKET || 'boothapp-sessions-752266476357';

  // Lazy-load S3 helpers — only needed at request time, not at import
  let s3;
  function getS3() {
    if (!s3) s3 = require('../../analysis/lib/s3');
    return s3;
  }

  router.use(require('express').json());

  // POST /api/analyze-batch
  router.post('/api/analyze-batch', async (req, res) => {
    const { session_ids } = req.body || {};

    if (!Array.isArray(session_ids) || session_ids.length === 0) {
      return res.status(400).json({ error: 'session_ids must be a non-empty array' });
    }

    // Cap batch size to prevent abuse
    if (session_ids.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 sessions per batch' });
    }

    // Check which sessions already have analysis output
    const toQueue = [];
    let alreadyAnalyzed = 0;

    try {
      const checks = await Promise.all(
        session_ids.map(async (id) => {
          const claimed = await getS3().isAlreadyClaimed(bucket, id);
          return { id, claimed };
        })
      );

      for (const { id, claimed } of checks) {
        if (claimed) {
          alreadyAnalyzed++;
        }
        // Queue all sessions — even already-analyzed ones get re-analyzed
        // (that's the whole point of batch reprocessing)
        toQueue.push(id);
      }
    } catch (err) {
      return res.status(500).json({ error: `S3 check failed: ${err.message}` });
    }

    // Reset batch state and queue all sessions
    resetBatch(toQueue);

    // Fire-and-forget: process sessions sequentially to avoid overwhelming Bedrock
    (async () => {
      for (const sessionId of toQueue) {
        await processSession(sessionId, bucket);
      }
    })();

    res.json({
      batch_id: batch.id,
      queued: toQueue.length,
      already_analyzed: alreadyAnalyzed,
      total: session_ids.length,
    });
  });

  // GET /api/analyze-status
  router.get('/api/analyze-status', (req, res) => {
    if (!batch.id) {
      return res.json({ active: false, message: 'No batch has been submitted' });
    }

    const counts = { queued: 0, running: 0, completed: 0, failed: 0 };
    for (const status of Object.values(batch.status)) {
      counts[status] = (counts[status] || 0) + 1;
    }

    const total = batch.session_ids.length;
    const done = counts.completed + counts.failed;

    res.json({
      active: done < total,
      batch_id: batch.id,
      started_at: batch.started_at,
      total,
      ...counts,
      progress_pct: total > 0 ? Math.round((done / total) * 100) : 0,
      errors: batch.errors,
    });
  });

  return router;
}

module.exports = { createRouter };
