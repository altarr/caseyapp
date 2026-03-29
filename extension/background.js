// V1-Helper background service worker
// Handles screenshot capture on every click and periodic fallback screenshots.

// ─── IndexedDB ────────────────────────────────────────────────────────────────

const DB_NAME = 'v1helper_screenshots';
const DB_VERSION = 1;
const STORE_NAME = 'screenshots';

function openScreenshotDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('click_index', 'click_index', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function saveScreenshot(record) {
  const db = await openScreenshotDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(record);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

// ─── Image Resize ─────────────────────────────────────────────────────────────
// Resize dataURL to fit within maxW x maxH using OffscreenCanvas.
// Returns original dataURL unchanged if already within bounds.

async function resizeIfNeeded(dataUrl, maxW, maxH) {
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

  const resizedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(resizedBlob);
  });
}

// ─── Screenshot Capture ───────────────────────────────────────────────────────

async function captureAndStore({ clickIndex = null, timestamp = null, type = 'click' } = {}) {
  const ts = timestamp || new Date().toISOString();
  const safeTs = ts.replace(/[:.]/g, '-');
  const label = clickIndex != null ? `click${clickIndex}` : 'periodic';
  const filename = `screenshot_${label}_${safeTs}.jpg`;

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 60 });
    const resized = await resizeIfNeeded(dataUrl, 1920, 1080);

    await saveScreenshot({
      click_index: clickIndex,
      timestamp: ts,
      type,
      filename,
      data_url: resized,
    });

    return filename;
  } catch (err) {
    // Tab may not be capturable (e.g. chrome:// pages) — fail silently
    console.warn('V1-Helper screenshot failed:', err.message);
    return null;
  }
}

// ─── Periodic Screenshot (10-second fallback) ─────────────────────────────────
// setInterval keeps firing while the service worker is alive. The worker wakes
// on each click message, so coverage is continuous during active sessions.

let periodicTimer = null;

function startPeriodicScreenshots() {
  if (periodicTimer !== null) return;
  periodicTimer = setInterval(() => {
    captureAndStore({ type: 'periodic' });
  }, 10_000);
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log('V1-Helper installed');
  startPeriodicScreenshots();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'click_event') {
    const { index, timestamp } = message.event;

    captureAndStore({ clickIndex: index, timestamp }).then((filename) => {
      sendResponse({ status: 'ok', filename });
    });

    // Ensure periodic timer is running now that the worker is awake
    startPeriodicScreenshots();

    return true; // keep channel open for async sendResponse
  }

  // Default pass-through
  sendResponse({ status: 'ok' });
});
