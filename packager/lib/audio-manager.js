'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class AudioManager {
  constructor() {
    this.process = null;
    this.recording = false;
    this.wavPath = null;
    this.stopFile = null;
  }

  async start(outputDir) {
    if (this.recording) return true;

    this.wavPath = path.join(outputDir, 'recording.wav');
    this.stopFile = path.join(outputDir, 'stop-recording');

    // Remove stale stop file
    try { fs.unlinkSync(this.stopFile); } catch (_) {}

    const scriptPath = path.join(__dirname, 'record-audio.ps1');

    return new Promise((resolve) => {
      this.process = spawn('powershell.exe', [
        '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath,
        '-OutputFile', this.wavPath,
        '-StopFile', this.stopFile,
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      let started = false;

      this.process.stdout.on('data', (chunk) => {
        const text = chunk.toString().trim();
        console.log(`  [audio] ${text}`);
        if (!started && text.includes('RECORDING')) {
          started = true;
          this.recording = true;
          resolve(true);
        }
      });

      this.process.stderr.on('data', (chunk) => {
        console.error(`  [audio] err: ${chunk.toString().trim()}`);
      });

      this.process.on('error', (err) => {
        console.error(`  [audio] process error: ${err.message}`);
        this.recording = false;
        if (!started) resolve(false);
      });

      this.process.on('close', (code) => {
        this.recording = false;
        this.process = null;
        if (!started) resolve(false);
      });

      // Timeout
      setTimeout(() => { if (!started) { this.kill(); resolve(false); } }, 10000);
    });
  }

  async stop() {
    if (!this.recording || !this.stopFile) return this.wavPath;

    // Signal stop by creating the stop file
    try {
      fs.writeFileSync(this.stopFile, 'stop');
    } catch (_) {}

    // Wait for process to exit
    return new Promise((resolve) => {
      if (!this.process) { this.recording = false; resolve(this.wavPath); return; }

      const timeout = setTimeout(() => {
        console.log('  [audio] Stop timeout, killing process');
        this.kill();
        resolve(this.wavPath);
      }, 10000);

      this.process.on('close', () => {
        clearTimeout(timeout);
        this.recording = false;
        console.log('  [audio] Recording stopped');
        resolve(this.wavPath);
      });
    });
  }

  kill() {
    if (this.process) {
      try { this.process.kill(); } catch (_) {}
      this.process = null;
      this.recording = false;
    }
  }
}

module.exports = { AudioManager };
