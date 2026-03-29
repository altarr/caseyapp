'use strict';

/**
 * ffmpeg-recorder.js
 * Wraps ffmpeg to record audio from a DirectShow device to a WAV file.
 *
 * Output format: WAV, 44100 Hz, stereo (matches DATA-CONTRACT.md)
 * Windows: uses -f dshow
 * Graceful stop: sends 'q\n' to ffmpeg stdin, then waits for exit.
 * Fallback stop: SIGTERM after 5s if ffmpeg doesn't exit cleanly.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

const GRACEFUL_STOP_TIMEOUT_MS = 5000;

class FfmpegRecorder extends EventEmitter {
  /**
   * @param {object} options
   * @param {string} options.device   - dshow audio device name
   * @param {string} options.outputPath - full path for output .wav file
   */
  constructor(options) {
    super();
    if (!options.device) throw new Error('options.device is required');
    if (!options.outputPath) throw new Error('options.outputPath is required');

    this.device = options.device;
    this.outputPath = options.outputPath;
    this._proc = null;
    this._stopping = false;
  }

  /**
   * Start recording. Emits 'started' when ffmpeg is running.
   * @returns {Promise<void>} resolves when recording has started
   */
  start() {
    return new Promise((resolve, reject) => {
      // Ensure output directory exists
      const dir = path.dirname(this.outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const args = [
        '-y',                        // overwrite output file
        '-f', 'dshow',               // DirectShow input (Windows)
        '-i', `audio=${this.device}`,
        '-ar', '44100',              // 44100 Hz sample rate
        '-ac', '2',                  // stereo
        '-acodec', 'pcm_s16le',      // 16-bit PCM (standard WAV)
        this.outputPath,
      ];

      this._proc = spawn('ffmpeg', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let started = false;

      this._proc.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        // ffmpeg prints "Press [q] to stop" when it's recording
        if (!started && (text.includes('Press [q]') || text.includes('size='))) {
          started = true;
          this.emit('started', { device: this.device, outputPath: this.outputPath });
          resolve();
        }
        // Forward stderr for debugging
        this.emit('ffmpeg-output', text);
      });

      this._proc.stdout.on('data', (chunk) => {
        this.emit('ffmpeg-output', chunk.toString());
      });

      this._proc.on('error', (err) => {
        if (!started) reject(err);
        else this.emit('error', err);
      });

      this._proc.on('close', (code, signal) => {
        this.emit('stopped', { code, signal, outputPath: this.outputPath });
        if (!started) {
          reject(new Error(`ffmpeg exited before starting (code=${code})`));
        }
      });

      // Timeout if ffmpeg never signals it's recording
      setTimeout(() => {
        if (!started) {
          this._proc.kill();
          reject(new Error('ffmpeg did not start recording within 10 seconds'));
        }
      }, 10000);
    });
  }

  /**
   * Stop recording gracefully. Sends 'q' to ffmpeg stdin, waits for clean exit.
   * Falls back to SIGTERM after GRACEFUL_STOP_TIMEOUT_MS.
   * @returns {Promise<void>} resolves when ffmpeg has exited
   */
  stop() {
    return new Promise((resolve) => {
      if (!this._proc || this._stopping) {
        resolve();
        return;
      }
      this._stopping = true;

      // Graceful stop: send 'q' to ffmpeg's stdin
      try {
        this._proc.stdin.write('q\n');
        this._proc.stdin.end();
      } catch (_) {
        // stdin may already be closed
      }

      const timeout = setTimeout(() => {
        if (this._proc) {
          this._proc.kill('SIGTERM');
        }
      }, GRACEFUL_STOP_TIMEOUT_MS);

      this._proc.on('close', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  /** Whether ffmpeg is currently running. */
  get isRecording() {
    return this._proc !== null && !this._stopping;
  }
}

module.exports = { FfmpegRecorder };
