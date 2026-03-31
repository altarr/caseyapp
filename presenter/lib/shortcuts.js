/**
 * BoothApp Keyboard Shortcuts & Accessibility
 *
 * Include this script in all presenter HTML pages.
 * Shortcuts:
 *   ESC -> Home page
 *   S   -> Sessions list
 *   A   -> Admin panel (analytics)
 *   D   -> Demo mode
 *   F   -> Fullscreen toggle
 *   N   -> Next session (when on session page)
 *   P   -> Previous session (when on session page)
 *   ?   -> Show/hide shortcuts help overlay
 */
(function () {
  'use strict';

  // ── Shortcut definitions ──────────────────────────────────────────────────
  var SHORTCUTS = [
    { key: 'Escape', label: 'ESC', desc: 'Go to home page', action: function () { nav('index.html'); } },
    { key: 's', label: 'S', desc: 'Sessions list', action: function () { nav('sessions.html'); } },
    { key: 'a', label: 'A', desc: 'Admin / Analytics', action: function () { nav('admin.html'); } },
    { key: 'd', label: 'D', desc: 'Demo mode', action: function () { nav('demo-mode.html'); } },
    { key: 'f', label: 'F', desc: 'Toggle fullscreen', action: toggleFullscreen },
    { key: 'n', label: 'N', desc: 'Next session', action: function () { cycleSession(1); } },
    { key: 'p', label: 'P', desc: 'Previous session', action: function () { cycleSession(-1); } },
    { key: '?', label: '?', desc: 'Show this help', action: toggleHelp }
  ];

  // ── Navigation helper ─────────────────────────────────────────────────────
  function nav(page) {
    var base = window.location.pathname.replace(/[^/]*$/, '');
    window.location.href = base + page;
  }

  // ── Fullscreen toggle ─────────────────────────────────────────────────────
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function () {});
    } else {
      document.exitFullscreen();
    }
  }

  // ── Session cycling (N/P) ─────────────────────────────────────────────────
  function cycleSession(direction) {
    // Works on pages with ?session= param that have a session list in localStorage
    var params = new URLSearchParams(window.location.search);
    var currentId = params.get('session');
    if (!currentId) return;

    var apiUrl = (localStorage.getItem('boothapp_api_url') || '').replace(/\/+$/, '');
    if (!apiUrl) return;

    fetch(apiUrl + '/sessions')
      .then(function (res) { return res.ok ? res.json() : Promise.reject(); })
      .then(function (data) {
        if (!Array.isArray(data) || data.length === 0) return;
        var ids = data.map(function (s) { return s.session_id; });
        var idx = ids.indexOf(currentId);
        if (idx === -1) return;
        var next = idx + direction;
        if (next < 0) next = ids.length - 1;
        if (next >= ids.length) next = 0;
        params.set('session', ids[next]);
        window.location.search = params.toString();
      })
      .catch(function () {});
  }

  // ── Help overlay ──────────────────────────────────────────────────────────
  var overlay = null;

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'ba-shortcuts-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Keyboard shortcuts');
    overlay.setAttribute('aria-modal', 'true');

    var styles = [
      'position:fixed', 'inset:0', 'z-index:99999',
      'background:rgba(0,0,0,0.82)', 'display:flex',
      'align-items:center', 'justify-content:center',
      'backdrop-filter:blur(4px)', 'opacity:0',
      'transition:opacity 0.15s ease'
    ];
    overlay.style.cssText = styles.join(';');

    var card = document.createElement('div');
    card.style.cssText = [
      'background:#161b22', 'border:1px solid #30363d',
      'border-radius:12px', 'padding:2rem 2.5rem',
      'max-width:420px', 'width:90%', 'color:#e6edf3',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif'
    ].join(';');

    var title = document.createElement('h2');
    title.textContent = 'Keyboard Shortcuts';
    title.style.cssText = 'font-size:1.3rem;margin-bottom:1.2rem;color:#58a6ff;font-weight:600';
    card.appendChild(title);

    var table = document.createElement('table');
    table.setAttribute('role', 'presentation');
    table.style.cssText = 'width:100%;border-collapse:collapse';

    for (var i = 0; i < SHORTCUTS.length; i++) {
      var s = SHORTCUTS[i];
      var tr = document.createElement('tr');
      tr.style.cssText = 'border-bottom:1px solid #21262d';

      var tdKey = document.createElement('td');
      tdKey.style.cssText = 'padding:0.5rem 1rem 0.5rem 0;width:60px';
      var kbd = document.createElement('kbd');
      kbd.textContent = s.label;
      kbd.style.cssText = [
        'display:inline-block', 'min-width:32px', 'text-align:center',
        'padding:0.2rem 0.5rem', 'background:#0d1117',
        'border:1px solid #30363d', 'border-radius:6px',
        'font-family:"SF Mono","Cascadia Code",monospace',
        'font-size:0.85rem', 'color:#e6edf3'
      ].join(';');
      tdKey.appendChild(kbd);

      var tdDesc = document.createElement('td');
      tdDesc.textContent = s.desc;
      tdDesc.style.cssText = 'padding:0.5rem 0;color:#8b949e;font-size:0.9rem';

      tr.appendChild(tdKey);
      tr.appendChild(tdDesc);
      table.appendChild(tr);
    }
    card.appendChild(table);

    var hint = document.createElement('div');
    hint.textContent = 'Press ? or ESC to close';
    hint.style.cssText = 'margin-top:1rem;font-size:0.75rem;color:#484f58;text-align:center';
    card.appendChild(hint);

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Click outside to close
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) hideHelp();
    });

    // Force reflow then fade in
    overlay.offsetHeight;
    overlay.style.opacity = '1';
  }

  function showHelp() {
    if (!overlay) createOverlay();
    overlay.style.display = 'flex';
    overlay.offsetHeight;
    overlay.style.opacity = '1';
    // Trap focus
    overlay.focus();
  }

  function hideHelp() {
    if (!overlay) return;
    overlay.style.opacity = '0';
    setTimeout(function () { overlay.style.display = 'none'; }, 150);
  }

  function toggleHelp() {
    if (overlay && overlay.style.display !== 'none') {
      hideHelp();
    } else {
      showHelp();
    }
  }

  // ── Page-level exclusions ─────────────────────────────────────────────────
  // Pages can set <html data-shortcuts-exclude="f,ArrowRight,ArrowLeft"> to
  // prevent shortcuts.js from handling keys the page already manages.
  var excludeKeys = {};
  var excludeAttr = document.documentElement.getAttribute('data-shortcuts-exclude');
  if (excludeAttr) {
    excludeAttr.split(',').forEach(function (k) { excludeKeys[k.trim().toLowerCase()] = true; });
  }

  // ── Keyboard listener ─────────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    // Don't intercept when typing in inputs, textareas, or contentEditable
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
      return;
    }
    // Don't intercept if modifier keys are held (except Shift for ?)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Skip keys the page handles itself
    if (excludeKeys[e.key.toLowerCase()]) return;

    // If help overlay is open, ESC and ? close it
    if (overlay && overlay.style.display !== 'none') {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        hideHelp();
        return;
      }
    }

    var key = e.key;
    for (var i = 0; i < SHORTCUTS.length; i++) {
      var s = SHORTCUTS[i];
      if (key === s.key || key.toLowerCase() === s.key.toLowerCase()) {
        e.preventDefault();
        s.action();
        return;
      }
    }
  });

  // ── ARIA: add skip-nav link if not present ────────────────────────────────
  if (!document.getElementById('ba-skip-nav')) {
    var main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (main && !main.id) main.id = 'ba-main-content';

    var skip = document.createElement('a');
    skip.id = 'ba-skip-nav';
    skip.href = '#' + (main ? main.id : '');
    skip.textContent = 'Skip to main content';
    skip.setAttribute('aria-label', 'Skip to main content');
    skip.style.cssText = [
      'position:fixed', 'top:-100px', 'left:1rem', 'z-index:100000',
      'background:#58a6ff', 'color:#0d1117', 'padding:0.5rem 1rem',
      'border-radius:0 0 8px 8px', 'font-weight:600', 'font-size:0.9rem',
      'text-decoration:none', 'transition:top 0.2s'
    ].join(';');
    skip.addEventListener('focus', function () { skip.style.top = '0'; });
    skip.addEventListener('blur', function () { skip.style.top = '-100px'; });
    document.body.insertBefore(skip, document.body.firstChild);
  }

  // ── ARIA: enhance interactive elements ────────────────────────────────────
  function enhanceAccessibility() {
    // Add aria-labels to links missing accessible text
    var links = document.querySelectorAll('a:not([aria-label])');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var text = (link.textContent || '').trim();
      if (!text && !link.getAttribute('aria-label')) {
        var title = link.getAttribute('title') || link.getAttribute('href') || '';
        if (title) link.setAttribute('aria-label', title);
      }
    }

    // Add aria-labels to buttons missing accessible text
    var buttons = document.querySelectorAll('button:not([aria-label])');
    for (var j = 0; j < buttons.length; j++) {
      var btn = buttons[j];
      var btnText = (btn.textContent || '').trim();
      if (!btnText && !btn.getAttribute('aria-label')) {
        var btnTitle = btn.getAttribute('title') || '';
        if (btnTitle) btn.setAttribute('aria-label', btnTitle);
      }
    }

    // Ensure tables have captions or aria-label
    var tables = document.querySelectorAll('table:not([aria-label])');
    for (var k = 0; k < tables.length; k++) {
      var tbl = tables[k];
      if (!tbl.querySelector('caption') && !tbl.getAttribute('aria-label')) {
        tbl.setAttribute('aria-label', 'Data table');
      }
    }

    // Add role="navigation" to nav-like containers
    var navLinks = document.querySelectorAll('.actions, .nav-links, .header-right');
    for (var n = 0; n < navLinks.length; n++) {
      if (!navLinks[n].getAttribute('role')) {
        navLinks[n].setAttribute('role', 'navigation');
        navLinks[n].setAttribute('aria-label', 'Page navigation');
      }
    }

    // Status indicators: add aria-live for dynamic content
    var statusChips = document.querySelectorAll('.status-chip, .status-bar, [id*="cnt-"]');
    for (var m = 0; m < statusChips.length; m++) {
      if (!statusChips[m].getAttribute('aria-live')) {
        statusChips[m].setAttribute('aria-live', 'polite');
      }
    }

    // Score bars: add aria descriptions
    var scoreBars = document.querySelectorAll('.score-bar');
    for (var p = 0; p < scoreBars.length; p++) {
      var label = scoreBars[p].querySelector('.score-label');
      if (label) {
        scoreBars[p].setAttribute('role', 'meter');
        scoreBars[p].setAttribute('aria-valuenow', label.textContent);
        scoreBars[p].setAttribute('aria-valuemin', '0');
        scoreBars[p].setAttribute('aria-valuemax', '100');
        scoreBars[p].setAttribute('aria-label', 'Engagement score: ' + label.textContent);
      }
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceAccessibility);
  } else {
    enhanceAccessibility();
  }

  // Re-run after dynamic content loads (MutationObserver)
  var observer = new MutationObserver(function () { enhanceAccessibility(); });
  observer.observe(document.body, { childList: true, subtree: true });

  // ── Expose API for other scripts ──────────────────────────────────────────
  window.BoothShortcuts = {
    show: showHelp,
    hide: hideHelp,
    toggle: toggleHelp
  };
})();
