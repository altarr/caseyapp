// V1-Helper content script
// Handles click interception, DOM path capture, and local storage buffering.

console.log('V1-Helper content script loaded on:', window.location.hostname);

// ─── DOM Path Builder ────────────────────────────────────────────────────────

/**
 * Build a CSS selector path from a DOM element up to the root.
 * Produces a unique, readable path like: div.app-content > nav > a.endpoint-security
 */
function buildDomPath(el) {
  const parts = [];
  let node = el;
  while (node && node.nodeType === Node.ELEMENT_NODE) {
    let selector = node.tagName.toLowerCase();
    if (node.id) {
      selector += '#' + node.id;
      parts.unshift(selector);
      break; // ID is unique enough — stop here
    }
    const classes = Array.from(node.classList)
      .filter(c => c.length > 0)
      .slice(0, 3) // cap at 3 classes to keep path readable
      .join('.');
    if (classes) {
      selector += '.' + classes;
    }
    parts.unshift(selector);
    node = node.parentElement;
    // Stop after 6 levels to keep paths concise
    if (parts.length >= 6) break;
  }
  return parts.join(' > ');
}

// ─── Element Info Extractor ──────────────────────────────────────────────────

function extractElementInfo(el) {
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || '',
    class: el.className || '',
    text: (el.innerText || el.textContent || '').trim().slice(0, 100),
    href: el.href || el.getAttribute('href') || '',
  };
}

// ─── Storage Helpers ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'v1helper_clicks';

/**
 * Load the current click buffer from chrome.storage.local.
 * Returns { session_id, events } or null if nothing stored yet.
 */
function loadClickBuffer(callback) {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    callback(result[STORAGE_KEY] || null);
  });
}

/**
 * Persist the click buffer back to chrome.storage.local.
 */
function saveClickBuffer(buffer) {
  chrome.storage.local.set({ [STORAGE_KEY]: buffer });
}

// ─── Click Handler ────────────────────────────────────────────────────────────

let eventIndex = 0;

function handleClick(event) {
  const el = event.target;
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return;

  const timestamp = new Date().toISOString();
  const domPath = buildDomPath(el);
  const element = extractElementInfo(el);

  // Resolve page URL/title — inside iframes these differ from the top frame
  let pageUrl, pageTitle;
  try {
    pageUrl = window.location.href;
    pageTitle = window.document.title;
  } catch (_) {
    // Cross-origin iframe: fall back to what we can access
    pageUrl = document.referrer || window.location.href;
    pageTitle = '';
  }

  const clickEvent = {
    index: null, // assigned after loading buffer
    timestamp,
    type: 'click',
    dom_path: domPath,
    element,
    coordinates: { x: event.clientX, y: event.clientY },
    page_url: pageUrl,
    page_title: pageTitle,
    screenshot_file: null, // populated by screenshot workstream
  };

  loadClickBuffer((buffer) => {
    if (!buffer) {
      // First click of a session — initialise buffer; session_id assigned later
      // by the background script when a session starts. Use empty string for now.
      buffer = { session_id: '', events: [] };
    }
    clickEvent.index = buffer.events.length + 1;
    buffer.events.push(clickEvent);
    saveClickBuffer(buffer);

    // Notify background service worker so it can forward to the relay / S3
    chrome.runtime.sendMessage({
      type: 'click_event',
      event: clickEvent,
    }).catch(() => {
      // Background may not be listening yet — silently ignore
    });
  });
}

// ─── Attach Listener ──────────────────────────────────────────────────────────
// Use capture phase (true) so we intercept clicks on all elements including
// those with stopPropagation, and so this works inside iframes.

document.addEventListener('click', handleClick, true);

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'get_clicks') {
    loadClickBuffer((buffer) => {
      sendResponse({ status: 'ok', buffer: buffer || { session_id: '', events: [] } });
    });
    return true; // keep channel open for async sendResponse
  }

  if (message.type === 'set_session_id') {
    loadClickBuffer((buffer) => {
      if (!buffer) buffer = { session_id: '', events: [] };
      buffer.session_id = message.session_id;
      saveClickBuffer(buffer);
      sendResponse({ status: 'ok' });
    });
    return true;
  }

  if (message.type === 'clear_clicks') {
    chrome.storage.local.remove([STORAGE_KEY], () => {
      sendResponse({ status: 'ok' });
    });
    return true;
  }

  // Default: pass-through for other message types
  console.log('V1-Helper content received message:', message);
  sendResponse({ status: 'ok', url: window.location.href });
});
