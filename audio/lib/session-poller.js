'use strict';

/**
 * session-poller.js
 * Polls S3 for session lifecycle events.
 *
 * Reads: sessions/<session_id>/metadata.json
 * Triggers:
 *   - 'start'  when metadata.status === 'active'
 *   - 'stop'   when metadata.status === 'completed' | metadata.ended_at is set
 *   - 'stop'   when a stop-audio command file exists: sessions/<id>/commands/stop-audio
 *
 * Config (env vars):
 *   S3_BUCKET        — bucket name (required)
 *   SESSION_ID       — session ID to watch (required)
 *   POLL_INTERVAL_MS — polling interval in ms (default: 2000)
 *   AWS_REGION       — AWS region (default: us-east-1)
 *   AWS_PROFILE      — AWS profile (default: hackathon)
 */

const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const EventEmitter = require('events');

const DEFAULT_INTERVAL_MS = 2000;
const STOP_STATUSES = new Set(['completed', 'ended', 'cancelled']);

class SessionPoller extends EventEmitter {
  constructor(options = {}) {
    super();
    this.bucket = options.bucket || process.env.S3_BUCKET;
    this.sessionId = options.sessionId || process.env.SESSION_ID;
    this.intervalMs = options.intervalMs || parseInt(process.env.POLL_INTERVAL_MS || DEFAULT_INTERVAL_MS, 10);

    if (!this.bucket) throw new Error('S3_BUCKET env var or options.bucket is required');
    if (!this.sessionId) throw new Error('SESSION_ID env var or options.sessionId is required');

    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      profile: process.env.AWS_PROFILE || 'hackathon',
    });

    this._timer = null;
    this._started = false;
    this._stopped = false;
  }

  get metadataKey() {
    return `sessions/${this.sessionId}/metadata.json`;
  }

  get stopCommandKey() {
    return `sessions/${this.sessionId}/commands/stop-audio`;
  }

  /** Fetch and parse metadata.json from S3. Returns null if not found yet. */
  async _fetchMetadata() {
    try {
      const resp = await this.s3.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.metadataKey,
      }));
      const body = await resp.Body.transformToString();
      return JSON.parse(body);
    } catch (err) {
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        return null; // Not created yet — keep polling
      }
      throw err;
    }
  }

  /** Check if the stop-audio command file exists. */
  async _stopCommandExists() {
    try {
      await this.s3.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: this.stopCommandKey,
      }));
      return true;
    } catch (err) {
      return false;
    }
  }

  /** Single poll tick. */
  async _tick() {
    try {
      const [metadata, stopCmd] = await Promise.all([
        this._fetchMetadata(),
        this._stopCommandExists(),
      ]);

      if (stopCmd) {
        this.emit('stop', { reason: 'stop-audio command', metadata });
        this.stop();
        return;
      }

      if (!metadata) return; // Session not created yet

      if (!this._started && metadata.status === 'active') {
        this._started = true;
        this.emit('start', metadata);
      }

      if (this._started && !this._stopped) {
        const shouldStop =
          STOP_STATUSES.has(metadata.status) ||
          (metadata.ended_at != null);

        if (shouldStop) {
          this.emit('stop', { reason: `status=${metadata.status}`, metadata });
          this.stop();
        }
      }
    } catch (err) {
      this.emit('error', err);
    }
  }

  /** Start polling. */
  start() {
    this._timer = setInterval(() => this._tick(), this.intervalMs);
    // Run first tick immediately
    this._tick();
  }

  /** Stop polling. */
  stop() {
    this._stopped = true;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}

module.exports = { SessionPoller };
