// Phantom Recall background service worker
// Captures timed screenshots and POSTs them to the local packager service.
// Records microphone audio via offscreen document.
// Polls S3 for session lifecycle via SigV4 signed requests.

// ─── Audio Recording via Offscreen Document (port-based) ────────────────────

let offscreenReady = false;
let audioRecordingActive = false;
let audioPort = null;
let audioResolve = null; // for stop callback

async function ensureOffscreen() {
  if (offscreenReady && audioPort) return;
  try {
    const exists = await chrome.offscreen.hasDocument();
    if (!exists) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'Recording microphone for demo session',
      });
    }
    offscreenReady = true;
    console.log('Phantom Recall: offscreen ready');
  } catch (e) {
    if (e.message?.includes('single offscreen')) offscreenReady = true;
    else console.error('Phantom Recall: offscreen error:', e);
  }
}

// Listen for the offscreen document to connect via port
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'audio-recorder') {
    audioPort = port;
    console.log('Phantom Recall: audio recorder connected');
    port.onMessage.addListener((msg) => {
      if (msg.type === 'started') {
        console.log('Phantom Recall: audio started:', msg.ok);
      }
      if (msg.type === 'stopped') {
        console.log('Phantom Recall: audio stopped, size:', msg.size);
        if (audioResolve) { audioResolve(msg); audioResolve = null; }
      }
      if (msg.type === 'status') {
        console.log('Phantom Recall: audio status:', msg.recording);
      }
    });
    port.onDisconnect.addListener(() => { audioPort = null; });
  }
});

async function startAudioRecording() {
  await ensureOffscreen();
  // Wait briefly for port to connect
  for (let i = 0; i < 20 && !audioPort; i++) await new Promise(r => setTimeout(r, 100));
  if (!audioPort) { console.error('Phantom Recall: no audio port'); return false; }

  const { audioDeviceId } = await chrome.storage.local.get(['audioDeviceId']);
  audioPort.postMessage({ type: 'start', deviceId: audioDeviceId || '' });
  return true;
}

async function stopAudioAndUpload() {
  if (!audioPort) return;

  const resp = await new Promise((resolve) => {
    audioResolve = resolve;
    audioPort.postMessage({ type: 'stop' });
    // Timeout after 10s
    setTimeout(() => { if (audioResolve) { audioResolve(null); audioResolve = null; } }, 10000);
  });

  if (!resp?.ok || !resp?.data) { console.log('Phantom Recall: no audio data'); return; }

  try {
    const fetchResp = await fetch(resp.data);
    const blob = await fetchResp.blob();
    const ext = (resp.mimeType || 'audio/webm').includes('webm') ? 'webm' : 'ogg';

    await fetch(`${PACKAGER_URL}/audio`, {
      method: 'POST',
      headers: { 'X-Filename': `recording.${ext}` },
      body: blob,
    });
    console.log('Phantom Recall: audio uploaded, size:', blob.size);
  } catch (e) {
    console.error('Phantom Recall: audio upload failed:', e);
  }
}

// ─── Management Server Polling ───────────────────────────────────────────────
// Primary session source — falls back to S3 if not configured.
// The extension sends an auth token via X-Auth-Token header.

async function pollManagementSession() {
  const { managementUrl, demoPcId, managementToken } = await chrome.storage.local.get([
    'managementUrl', 'demoPcId', 'managementToken'
  ]);
  if (!managementUrl || !demoPcId) return false; // fallback to S3 polling

  try {
    const headers = {};
    if (managementToken) {
      headers['X-Auth-Token'] = managementToken;
    }
    const response = await fetch(
      `${managementUrl}/api/sessions/active?demo_pc=${encodeURIComponent(demoPcId)}`,
      { headers, cache: 'no-store' }
    );
    if (!response.ok) return false;
    const data = await response.json();
    return data; // { active, session_id, visitor_name, stop_audio }
  } catch (_) {
    return false;
  }
}

// ─── Screenshot Quality Settings ──────────────────────────────────────────────

const QUALITY_PRESETS = {
  low:    { maxW: 854,  maxH: 480,  jpegQuality: 0.4 },
  medium: { maxW: 1280, maxH: 720,  jpegQuality: 0.6 },
  high:   { maxW: 1920, maxH: 1080, jpegQuality: 0.8 },
};

async function getQualitySettings() {
  const { screenshotQuality } = await chrome.storage.local.get(['screenshotQuality']);
  return QUALITY_PRESETS[screenshotQuality] || QUALITY_PRESETS.medium;
}

// ─── Image Resize ─────────────────────────────────────────────────────────────

async function resizeIfNeeded(dataUrl, maxW, maxH, jpegQuality) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  if (bitmap.width <= maxW && bitmap.height <= maxH) {
    bitmap.close();
    return dataUrl;
  }

  const scale = Math.min(maxW / bitmap.width, maxH / bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const resizedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: jpegQuality || 0.6 });
  return resizedBlob;
}

function dataUrlToBlob(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
}

// ─── Timecode Naming ──────────────────────────────────────────────────────────

let sessionStartEpoch = 0;

function makeTimecodeFilename() {
  const elapsed = Date.now() - sessionStartEpoch;
  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);
  const ms = elapsed % 1000;
  return `screenshot_${String(mins).padStart(2, '0')}m${String(secs).padStart(2, '0')}s${String(ms).padStart(3, '0')}.jpg`;
}

// ─── Packager Communication ──────────────────────────────────────────────────

const PACKAGER_URL = 'http://127.0.0.1:9222';

async function postToPackager(endpoint, body, contentType) {
  const response = await fetch(`${PACKAGER_URL}${endpoint}`, {
    method: 'POST',
    headers: contentType ? { 'Content-Type': contentType } : {},
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Packager ${endpoint}: ${response.status} ${text}`);
  }
  return response.json();
}

async function postScreenshot(filename, blob) {
  const response = await fetch(`${PACKAGER_URL}/screenshots`, {
    method: 'POST',
    headers: { 'X-Filename': filename },
    body: blob,
  });
  if (!response.ok) throw new Error(`Screenshot POST failed: ${response.status}`);
  return response.json();
}

async function checkPackagerStatus() {
  try {
    const response = await fetch(`${PACKAGER_URL}/status`, { method: 'GET' });
    if (!response.ok) return null;
    return response.json();
  } catch (_) {
    return null;
  }
}

// ─── Screenshot Capture ───────────────────────────────────────────────────────

let screenshotCount = 0;

async function captureAndPost() {
  if (!sessionStartEpoch) return null;

  try {
    const qs = await getQualitySettings();
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'jpeg',
      quality: Math.round(qs.jpegQuality * 100),
    });

    const resized = await resizeIfNeeded(dataUrl, qs.maxW, qs.maxH, qs.jpegQuality);
    const blob = resized instanceof Blob ? resized : dataUrlToBlob(resized);

    const filename = makeTimecodeFilename();

    // POST to packager — fire and forget on failure
    try {
      await postScreenshot(filename, blob);
      screenshotCount++;
    } catch (err) {
      console.warn('Phantom Recall: packager POST failed:', err.message);
    }

    return filename;
  } catch (err) {
    console.warn('Phantom Recall: screenshot capture failed:', err.message);
    return null;
  }
}

// ─── Timed Screenshots ───────────────────────────────────────────────────────

let screenshotTimer = null;

async function startTimedScreenshots() {
  if (screenshotTimer !== null) return;
  const { screenshotIntervalMs } = await chrome.storage.local.get(['screenshotIntervalMs']);
  const interval = screenshotIntervalMs || 1000;
  screenshotTimer = setInterval(() => captureAndPost(), interval);
}

function stopTimedScreenshots() {
  if (screenshotTimer !== null) {
    clearInterval(screenshotTimer);
    screenshotTimer = null;
  }
}

// ─── AWS SigV4 Signing (for S3 GET polling of active-session.json) ───────────

function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(new Uint8Array(hash));
}

async function hmacSHA256(key, data) {
  const keyBytes = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const dataBytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes);
  return new Uint8Array(sig);
}

async function signS3GetRequest(bucket, key, region, credentials) {
  const { awsAccessKeyId, awsSecretAccessKey, awsSessionToken } = credentials;
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = now.toISOString().replace(/[:-]/g, '').replace(/\.\d+/, '');
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const url = `https://${host}/${key}`;
  const payloadHash = await sha256Hex(new Uint8Array(0));

  const canonicalHeadersMap = {
    'content-type': 'application/json',
    'host': host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  if (awsSessionToken) canonicalHeadersMap['x-amz-security-token'] = awsSessionToken;

  const sortedKeys = Object.keys(canonicalHeadersMap).sort();
  const canonicalHeaders = sortedKeys.map(k => `${k}:${canonicalHeadersMap[k]}`).join('\n') + '\n';
  const signedHeaders = sortedKeys.join(';');
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');

  const canonicalRequest = ['GET', '/' + encodedKey, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await sha256Hex(canonicalRequest)].join('\n');

  const kDate = await hmacSHA256('AWS4' + awsSecretAccessKey, dateStamp);
  const kRegion = await hmacSHA256(kDate, region);
  const kService = await hmacSHA256(kRegion, 's3');
  const kSigning = await hmacSHA256(kService, 'aws4_request');
  const signature = toHex(await hmacSHA256(kSigning, stringToSign));

  const authorization = `AWS4-HMAC-SHA256 Credential=${awsAccessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const fetchHeaders = {
    'content-type': 'application/json',
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    'authorization': authorization,
  };
  if (awsSessionToken) fetchHeaders['x-amz-security-token'] = awsSessionToken;

  return { url, headers: fetchHeaders };
}

async function s3GetJson(bucket, key, region, credentials) {
  const { url, headers } = await signS3GetRequest(bucket, key, region, credentials);
  const response = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
  if (!response.ok) return null;
  return response.json();
}

// ─── S3 Session Polling ──────────────────────────────────────────────────────

let pollingSessionId = null;
let lastError = '';
let lastErrorTime = 0;

async function handleSessionData(data) {
  if (data && data.active === true) {
    if (!pollingSessionId) {
      pollingSessionId = data.session_id;
      sessionStartEpoch = Date.now();
      screenshotCount = 0;

      // Notify content scripts
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'session_state_changed',
            active: true,
            session_id: data.session_id,
            stop_audio: data.stop_audio || false,
          }).catch(() => {});
        }
      });

      chrome.storage.local.set({
        phonePaired: true,
        v1helper_session: {
          active: true,
          session_id: data.session_id,
          visitor_name: data.visitor_name || '',
          start_time: new Date().toISOString(),
          stop_audio: data.stop_audio || false,
        }
      });

      // Start timed screenshots + audio
      startTimedScreenshots();
      startAudioRecording().then(ok => {
        audioRecordingActive = ok;
        console.log('Phantom Recall: audio started:', ok);
      });
    } else if (data.stop_audio !== undefined) {
      const { v1helper_session } = await chrome.storage.local.get(['v1helper_session']);
      if (v1helper_session && v1helper_session.active) {
        chrome.storage.local.set({
          v1helper_session: { ...v1helper_session, stop_audio: data.stop_audio }
        });
        if (data.stop_audio && audioRecordingActive) {
          await stopAudioAndUpload();
          audioRecordingActive = false;
        }
      }
    }
  } else {
    if (pollingSessionId) {
      const endedSessionId = pollingSessionId;
      pollingSessionId = null;

      // Stop screenshots + audio
      stopTimedScreenshots();
      if (audioRecordingActive) {
        await stopAudioAndUpload();
        audioRecordingActive = false;
      }

      // Notify content scripts
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'session_state_changed',
            active: false,
            session_id: endedSessionId,
          }).catch(() => {});
        }
      });

      chrome.storage.local.set({ v1helper_session: { active: false } });

      // POST clicks to packager and signal end
      try {
        const { v1helper_clicks } = await chrome.storage.local.get(['v1helper_clicks']);
        if (v1helper_clicks) {
          await postToPackager('/clicks', JSON.stringify(v1helper_clicks), 'application/json');
        }
        await postToPackager('/session/end', '{}', 'application/json');
      } catch (err) {
        console.warn('Phantom Recall: packager end signal failed:', err.message);
      }

      // Clear local data
      await chrome.storage.local.remove(['v1helper_clicks']);
      sessionStartEpoch = 0;
      screenshotCount = 0;
    }
  }
}

async function pollActiveSession() {
  // Try management server first (primary)
  const mgmtData = await pollManagementSession();
  if (mgmtData !== false) {
    try {
      await handleSessionData(mgmtData);
    } catch (_err) {
      lastError = 'Management Poll Failed';
      lastErrorTime = Date.now();
    }
    return;
  }

  // Fallback: S3 polling
  const config = await chrome.storage.local.get([
    's3Bucket', 's3Region', 'awsAccessKeyId', 'awsSecretAccessKey', 'awsSessionToken'
  ]);
  const { s3Bucket, s3Region, awsAccessKeyId, awsSecretAccessKey, awsSessionToken } = config;
  if (!s3Bucket || !s3Region || !awsAccessKeyId || !awsSecretAccessKey) return;

  const credentials = { awsAccessKeyId, awsSecretAccessKey, awsSessionToken };

  try {
    const data = await s3GetJson(s3Bucket, 'active-session.json', s3Region, credentials);
    await handleSessionData(data);
  } catch (_err) {
    lastError = 'S3 Poll Failed';
    lastErrorTime = Date.now();
    if (pollingSessionId) {
      pollingSessionId = null;
      stopTimedScreenshots();
      chrome.storage.local.set({ v1helper_session: { active: false } });
      sessionStartEpoch = 0;
    }
  }
}

setInterval(pollActiveSession, 2000);

// ─── Keepalive Port ──────────────────────────────────────────────────────────

let keepalivePort = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'session-keepalive') {
    keepalivePort = port;
    port.onDisconnect.addListener(() => {
      if (keepalivePort === port) keepalivePort = null;
    });
  }
});

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log('Phantom Recall extension installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'click_event') {
    // Still track clicks but don't trigger screenshot (timed screenshots handle it)
    sendResponse({ status: 'ok' });
    return false;
  }

  if (message.type === 'session_start') {
    const { session_id, visitor_name } = message;
    lastError = '';
    sessionStartEpoch = Date.now();
    screenshotCount = 0;
    chrome.storage.local.remove(['v1helper_clicks']).then(() => {
      chrome.storage.local.set({
        v1helper_session: {
          active: true,
          session_id,
          visitor_name: visitor_name || '',
          start_time: new Date().toISOString(),
          stop_audio: false,
        }
      });
      startTimedScreenshots();
      sendResponse({ status: 'ok' });
    }).catch((err) => {
      sendResponse({ status: 'error', error: err.message });
    });
    return true;
  }

  if (message.type === 'session_end') {
    stopTimedScreenshots();
    sessionStartEpoch = 0;
    chrome.storage.local.set({ v1helper_session: { active: false } }).then(() => {
      sendResponse({ status: 'ok' });
    });
    return true;
  }

  if (message.type === 'get_clicks') {
    chrome.storage.local.get(['v1helper_clicks'], (result) => {
      const buffer = result.v1helper_clicks || { session_id: '', events: [] };
      sendResponse({ status: 'ok', buffer });
    });
    return true;
  }

  if (message.type === 'upload_session') {
    // Legacy: redirect to packager end signal
    const { session_id, click_buffer } = message;
    (async () => {
      try {
        if (click_buffer) {
          await postToPackager('/clicks', JSON.stringify(click_buffer), 'application/json');
        }
        await postToPackager('/session/end', '{}', 'application/json');
        await chrome.storage.local.remove(['v1helper_clicks']);
        sendResponse({ status: 'ok' });
      } catch (err) {
        sendResponse({ status: 'error', error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'test_management_connection') {
    (async () => {
      try {
        const { managementUrl, managementToken } = await chrome.storage.local.get([
          'managementUrl', 'managementToken'
        ]);
        if (!managementUrl) {
          sendResponse({ connected: false, error: 'Not configured' });
          return;
        }
        const headers = {};
        if (managementToken) headers['X-Auth-Token'] = managementToken;
        const response = await fetch(`${managementUrl}/api/events`, { headers, cache: 'no-store' });
        sendResponse({ connected: response.ok });
      } catch (err) {
        sendResponse({ connected: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'test_s3_connection') {
    (async () => {
      try {
        const config = await chrome.storage.local.get([
          's3Bucket', 's3Region', 'awsAccessKeyId', 'awsSecretAccessKey', 'awsSessionToken'
        ]);
        const { s3Bucket, s3Region, awsAccessKeyId, awsSecretAccessKey, awsSessionToken } = config;
        if (!s3Bucket || !s3Region || !awsAccessKeyId || !awsSecretAccessKey) {
          sendResponse({ connected: false, error: 'Not configured' });
          return;
        }
        const credentials = { awsAccessKeyId, awsSecretAccessKey, awsSessionToken };
        const { url, headers } = await signS3GetRequest(s3Bucket, 'active-session.json', s3Region, credentials);
        const response = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
        sendResponse({ connected: response.status === 200 || response.status === 404 });
      } catch (err) {
        sendResponse({ connected: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'get_popup_status') {
    (async () => {
      try {
        const store = await chrome.storage.local.get([
          'v1helper_session', 'v1helper_clicks', 's3Bucket', 'awsAccessKeyId',
          'managementUrl', 'demoPcId'
        ]);
        const session = store.v1helper_session || { active: false };
        const clicks = store.v1helper_clicks || { session_id: '', events: [] };
        const s3Configured = !!(store.s3Bucket && store.awsAccessKeyId);
        const mgmtConfigured = !!(store.managementUrl && store.demoPcId);
        const lastEvent = clicks.events.length > 0 ? clicks.events[clicks.events.length - 1] : null;

        const packagerStatus = await checkPackagerStatus();

        const errorMessage = (lastError && (Date.now() - lastErrorTime < 30000)) ? lastError : '';
        if (!errorMessage) lastError = '';

        sendResponse({
          status: 'ok',
          session_active: !!session.active,
          session_id: session.session_id || '',
          visitor_name: session.visitor_name || '',
          start_time: session.start_time || '',
          click_count: clicks.events.length,
          screenshot_count: screenshotCount,
          last_click_path: lastEvent ? lastEvent.dom_path : '',
          last_click_time: lastEvent ? lastEvent.timestamp : '',
          s3_polling: s3Configured,
          mgmt_polling: mgmtConfigured,
          polling_session_id: pollingSessionId || '',
          error_message: errorMessage,
          audio_recording: audioRecordingActive,
          packager_connected: !!packagerStatus,
          packager_status: packagerStatus,
        });
      } catch (err) {
        sendResponse({ status: 'error', error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'list-audio-devices') {
    (async () => {
      await ensureOffscreen();
      for (let i = 0; i < 20 && !audioPort; i++) await new Promise(r => setTimeout(r, 100));
      if (!audioPort) { sendResponse({ devices: [] }); return; }

      const handler = (msg) => {
        if (msg.type === 'devices') {
          sendResponse(msg);
        }
      };
      audioPort.onMessage.addListener(handler);
      audioPort.postMessage({ type: 'list-devices' });
    })();
    return true;
  }

  sendResponse({ status: 'ok' });
});
