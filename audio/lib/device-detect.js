'use strict';

/**
 * device-detect.js
 * Auto-detect USB/wireless microphone device name via ffmpeg DirectShow enumeration.
 * Windows only — uses -f dshow.
 */

const { execFile } = require('child_process');

// Keywords that identify a USB or wireless mic in the dshow device list
const MIC_KEYWORDS = ['usb', 'wireless', 'microphone', 'mic', 'headset', 'yeti', 'blue', 'rode', 'shure'];

/**
 * Parse ffmpeg dshow -list_devices output and return audio device names.
 * ffmpeg prints device info to stderr.
 *
 * Example stderr lines:
 *   [dshow @ 0x...] "Microphone (USB Audio Device)" (audio)
 *   [dshow @ 0x...] "Stereo Mix (Realtek Audio)" (audio)
 *
 * @param {string} stderr
 * @returns {string[]} list of audio device names
 */
function parseDevices(stderr) {
  const devices = [];
  // Match quoted device names followed by (audio)
  const re = /"([^"]+)"\s*\(audio\)/g;
  let m;
  while ((m = re.exec(stderr)) !== null) {
    devices.push(m[1]);
  }
  return devices;
}

/**
 * Score a device name — higher = more likely to be the target USB/wireless mic.
 * @param {string} name
 * @returns {number}
 */
function scoreDevice(name) {
  const lower = name.toLowerCase();
  return MIC_KEYWORDS.reduce((score, kw) => score + (lower.includes(kw) ? 1 : 0), 0);
}

/**
 * List all audio input devices visible to ffmpeg/dshow.
 * @returns {Promise<string[]>}
 */
function listDevices() {
  return new Promise((resolve, reject) => {
    execFile(
      'ffmpeg',
      ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'],
      { timeout: 10000 },
      (err, stdout, stderr) => {
        // ffmpeg always exits non-zero for this command — that's expected
        const devices = parseDevices(stderr || '');
        if (devices.length === 0 && err && !stderr) {
          return reject(new Error(`ffmpeg not found or failed: ${err.message}`));
        }
        resolve(devices);
      }
    );
  });
}

/**
 * Auto-detect the best USB/wireless mic from available dshow devices.
 * If AUDIO_DEVICE env var is set, validates it exists and returns it.
 * Otherwise picks the highest-scoring device.
 *
 * @returns {Promise<string>} device name suitable for use in -i "audio=<name>"
 * @throws if no suitable mic is found
 */
async function detectMic() {
  const forced = process.env.AUDIO_DEVICE;

  const devices = await listDevices();

  if (devices.length === 0) {
    throw new Error(
      'No audio input devices found. Is ffmpeg installed and a microphone connected?\n' +
      'Set AUDIO_DEVICE env var to override.'
    );
  }

  if (forced) {
    if (devices.includes(forced)) {
      return forced;
    }
    throw new Error(
      `AUDIO_DEVICE="${forced}" not found in device list.\n` +
      `Available devices:\n${devices.map(d => `  - ${d}`).join('\n')}`
    );
  }

  // Pick highest-scoring device; ties broken by first match
  const scored = devices.map(d => ({ name: d, score: scoreDevice(d) }));
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best.score === 0) {
    // No keyword match — list devices and ask for manual config
    throw new Error(
      'Could not auto-detect a USB/wireless mic. Found these audio devices:\n' +
      devices.map(d => `  - ${d}`).join('\n') +
      '\nSet AUDIO_DEVICE="<device name>" to pick one manually.'
    );
  }

  return best.name;
}

module.exports = { detectMic, listDevices, parseDevices };
