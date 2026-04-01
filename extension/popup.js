// ─── Version ─────────────────────────────────────────────────────────────────

(function setVersion() {
  var manifest = chrome.runtime.getManifest();
  var el = document.getElementById('footerVer');
  if (el && manifest.version) el.textContent = 'v' + manifest.version;
})();

// ─── State ───────────────────────────────────────────────────────────────────

var currentSessionActive = false;
var sessionStartIso = null;
var durationTimer = null;
var s3Configured = false;
var lastSessionWasActive = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(isoString) {
  if (!isoString) return '--';
  try {
    var d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (_) {
    return isoString;
  }
}

function formatDuration(startIso) {
  if (!startIso) return '--:--';
  var ms = Date.now() - new Date(startIso).getTime();
  if (ms < 0) return '--:--';
  var totalSec = Math.floor(ms / 1000);
  var h = Math.floor(totalSec / 3600);
  var min = Math.floor((totalSec % 3600) / 60);
  var sec = totalSec % 60;
  if (h > 0) {
    return h + ':' + (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec;
  }
  return (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec;
}

function truncateId(id) {
  if (!id) return '--';
  return id.length > 20 ? id.slice(0, 20) + '...' : id;
}

// ─── Duration Timer ──────────────────────────────────────────────────────────

function updateDuration() {
  document.getElementById('ringTimer').textContent = formatDuration(sessionStartIso);
}

// ─── UI State Machine ────────────────────────────────────────────────────────

function setRingState(state) {
  var ring = document.getElementById('statusRing');
  var timerEl = document.getElementById('ringTimer');
  var labelEl = document.getElementById('ringLabel');

  ring.classList.remove('recording', 'uploading', 'complete', 'error');

  if (state === 'recording') {
    ring.classList.add('recording');
    labelEl.textContent = 'REC';
  } else if (state === 'uploading') {
    ring.classList.add('uploading');
    labelEl.textContent = 'UPLOADING';
  } else if (state === 'complete') {
    ring.classList.add('complete');
  } else if (state === 'error') {
    ring.classList.add('error');
    timerEl.textContent = '!!';
    labelEl.textContent = 'ERROR';
  } else {
    timerEl.textContent = '--:--';
    labelEl.textContent = 'IDLE';
  }
}

// ─── Button Visibility ──────────────────────────────────────────────────────

var mgmtConfigured = false;

function updateButtonVisibility() {
  var wrap = document.getElementById('btnWrap');
  if (s3Configured || mgmtConfigured) {
    wrap.classList.remove('hidden');
  } else {
    wrap.classList.add('hidden');
  }
}

// ─── Status Polling ──────────────────────────────────────────────────────────

function refreshStatus() {
  chrome.runtime.sendMessage({ type: 'get_popup_status' }, function(response) {
    if (chrome.runtime.lastError || !response || response.status !== 'ok') return;

    // Management connection indicator
    var mgmtDot = document.getElementById('mgmtPollDot');
    var mgmtText = document.getElementById('mgmtPollText');
    mgmtConfigured = !!response.mgmt_polling;
    if (mgmtConfigured) {
      mgmtDot.classList.add('active');
      mgmtText.classList.add('active');
    } else {
      mgmtDot.classList.remove('active');
      mgmtText.classList.remove('active');
    }

    // S3 connection indicator
    var s3Dot = document.getElementById('s3PollDot');
    var s3Text = document.getElementById('s3PollText');
    s3Configured = !!response.s3_polling;
    if (s3Configured) {
      s3Dot.classList.add('active');
      s3Text.textContent = 'S3';
      s3Text.classList.add('active');
    } else {
      s3Dot.classList.remove('active');
      s3Text.textContent = 'S3';
      s3Text.classList.remove('active');
    }

    // Mic recording indicator
    var micDot = document.getElementById('micDot');
    var micText = document.getElementById('micText');
    if (micDot) {
      if (response.audio_recording) {
        micDot.classList.add('active');
        micText.classList.add('active');
      } else {
        micDot.classList.remove('active');
        micText.classList.remove('active');
      }
    }

    // Phone paired indicator — check if phone has scanned this QR
    var phoneDot = document.getElementById('phoneDot');
    var phoneText = document.getElementById('phoneText');
    if (phoneDot) {
      chrome.storage.local.get(['phonePaired'], function(data) {
        if (data.phonePaired) {
          phoneDot.classList.add('active');
          phoneText.classList.add('active');
        } else {
          phoneDot.classList.remove('active');
          phoneText.classList.remove('active');
        }
      });
    }

    updateButtonVisibility();

    var heroVisitor = document.getElementById('heroVisitor');
    var heroError = document.getElementById('heroError');

    currentSessionActive = response.session_active;

    // Reset transient UI
    heroError.classList.remove('visible');

    if (response.error_message) {
      setRingState('error');
      heroError.textContent = response.error_message;
      heroError.classList.add('visible');
      heroVisitor.classList.remove('visible');
    } else if (response.uploading) {
      setRingState('uploading');
      heroVisitor.classList.remove('visible');
    } else if (response.session_active) {
      setRingState('recording');
      lastSessionWasActive = true;

      sessionStartIso = response.start_time || null;
      if (!durationTimer && sessionStartIso) {
        durationTimer = setInterval(updateDuration, 1000);
        updateDuration();
      }

      if (response.visitor_name) {
        heroVisitor.textContent = response.visitor_name;
        heroVisitor.classList.add('visible');
      } else {
        heroVisitor.classList.remove('visible');
      }
    } else {
      // Session not active -- show complete if we just ended one
      if (lastSessionWasActive && !response.uploading) {
        setRingState('complete');
        lastSessionWasActive = false;
        // Auto-clear complete state after 5 seconds
        setTimeout(function() {
          if (!currentSessionActive) {
            setRingState('idle');
          }
        }, 5000);
      } else if (!lastSessionWasActive) {
        setRingState('idle');
      }
      heroVisitor.classList.remove('visible');

      if (durationTimer) {
        clearInterval(durationTimer);
        durationTimer = null;
      }
      sessionStartIso = null;
    }

    // Session button
    updateSessionButton(response.session_active);

    // Stats
    document.getElementById('statClicks').textContent = response.click_count || '0';
    document.getElementById('statScreenshots').textContent = response.screenshot_count || '0';

    // Session info rows
    var sidEl = document.getElementById('infoSessionId');
    sidEl.textContent = truncateId(response.session_id);
    sidEl.classList.toggle('muted', !response.session_id);

    var visEl = document.getElementById('infoVisitor');
    visEl.textContent = response.visitor_name || '--';
    visEl.classList.toggle('muted', !response.visitor_name);

    var startEl = document.getElementById('infoStartTime');
    startEl.textContent = formatTime(response.start_time);
    startEl.classList.toggle('muted', !response.start_time);
  });
}

// Poll every 1s
refreshStatus();
setInterval(refreshStatus, 1000);

// ─── Session Start/Stop Button ───────────────────────────────────────────────

function updateSessionButton(isActive) {
  var btn = document.getElementById('sessionBtn');
  if (isActive) {
    btn.textContent = 'End Demo';
    btn.classList.remove('start');
    btn.classList.add('stop');
  } else {
    btn.textContent = 'Start Demo';
    btn.classList.remove('stop');
    btn.classList.add('start');
  }
}

document.getElementById('sessionBtn').addEventListener('click', function() {
  if (currentSessionActive) {
    chrome.runtime.sendMessage({ type: 'session_end' }, function() {
      refreshStatus();
    });
  } else {
    var sessionId = 'manual-' + Date.now().toString(36);
    chrome.runtime.sendMessage({ type: 'session_start', session_id: sessionId }, function() {
      refreshStatus();
    });
  }
});

// ─── Gear Toggle ─────────────────────────────────────────────────────────────

document.getElementById('gearBtn').addEventListener('click', function() {
  var mgmtSection = document.getElementById('mgmtSection');
  var s3Section = document.getElementById('s3Section');
  var gear = document.getElementById('gearBtn');
  var isOpen = mgmtSection.classList.toggle('open');
  s3Section.classList.toggle('open', isOpen);
  gear.classList.toggle('open', isOpen);
});

// ─── Management Config ───────────────────────────────────────────────────────

var MGMT_KEYS = ['managementUrl', 'managementToken', 'eventId', 'demoPcId', 'demoPcDbId', 'demoPcName'];

var DEFAULT_MGMT_URL = 'https://caseyapp.trendcyberrange.com';

// Load saved management values
chrome.storage.local.get(MGMT_KEYS, function(config) {
  document.getElementById('managementUrl').value = config.managementUrl || DEFAULT_MGMT_URL;
  if (config.managementToken) document.getElementById('managementToken').value = config.managementToken;
  if (config.demoPcName) document.getElementById('demoPcName').value = config.demoPcName;
  // If management URL is configured, try to load events
  var url = config.managementUrl || DEFAULT_MGMT_URL;
  fetchEvents(url, config.managementToken, config.eventId);
});

function fetchEvents(mgmtUrl, token, selectedEventId) {
  var headers = {};
  if (token) headers['X-Auth-Token'] = token;
  fetch(mgmtUrl + '/api/events', { headers: headers, cache: 'no-store' })
    .then(function(r) { return r.ok ? r.json() : Promise.reject('Failed'); })
    .then(function(events) {
      var select = document.getElementById('mgmtEvent');
      select.innerHTML = '';
      if (!events || events.length === 0) {
        var opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '-- no events found --';
        select.appendChild(opt);
        return;
      }
      events.forEach(function(evt) {
        var opt = document.createElement('option');
        opt.value = evt.id;
        opt.textContent = evt.name;
        if (selectedEventId && String(evt.id) === String(selectedEventId)) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
    })
    .catch(function() {
      var select = document.getElementById('mgmtEvent');
      select.innerHTML = '<option value="">-- failed to load --</option>';
    });
}

// Connect button
document.getElementById('mgmtConnectBtn').addEventListener('click', function() {
  var mgmtUrl = document.getElementById('managementUrl').value.trim().replace(/\/+$/, '');
  var token = document.getElementById('managementToken').value.trim();
  var eventSelect = document.getElementById('mgmtEvent');
  var eventId = eventSelect.value;
  var demoPcName = document.getElementById('demoPcName').value.trim();
  var btn = document.getElementById('mgmtConnectBtn');
  var statusDot = document.getElementById('mgmtStatusDot');
  var statusText = document.getElementById('mgmtStatusText');

  if (!mgmtUrl) {
    statusDot.classList.remove('active');
    statusText.textContent = 'Enter a management URL';
    return;
  }

  statusText.textContent = 'Connecting...';

  // Test connection by fetching events
  var headers = {};
  if (token) headers['X-Auth-Token'] = token;
  fetch(mgmtUrl + '/api/events', { headers: headers, cache: 'no-store' })
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      // Populate events dropdown
      var events = data.events || data || [];
      var select = document.getElementById('mgmtEvent');
      select.innerHTML = '';
      events.forEach(function(evt) {
        var opt = document.createElement('option');
        opt.value = evt.id;
        opt.textContent = evt.name;
        select.appendChild(opt);
      });

      // Select first event if none selected
      if (!eventId && events.length > 0) {
        eventId = String(events[0].id);
        select.value = eventId;
      }

      // Save management config
      var config = {
        managementUrl: mgmtUrl,
        managementToken: token,
        demoPcName: demoPcName,
      };

      if (eventId) config.eventId = eventId;
      if (demoPcName) config.demoPcId = demoPcName;

      // Register demo PC if name is provided
      if (demoPcName && eventId) {
        var regHeaders = { 'Content-Type': 'application/json' };
        if (token) regHeaders['X-Auth-Token'] = token;
        fetch(mgmtUrl + '/api/demo-pcs/register', {
          method: 'POST',
          headers: regHeaders,
          body: JSON.stringify({ event_id: parseInt(eventId, 10), demo_pc_name: demoPcName }),
        })
          .then(function(r) { return r.ok ? r.json() : Promise.reject('Register failed'); })
          .then(function(data) {
            if (data && data.demo_pc && data.demo_pc.id) {
              config.demoPcDbId = data.demo_pc.id;
            }
            // Save S3 credentials from management server
            if (data && data.s3_config) {
              config.s3Bucket = data.s3_config.bucket || '';
              config.s3Region = data.s3_config.region || '';
              if (data.s3_config.access_key_id) config.awsAccessKeyId = data.s3_config.access_key_id;
              if (data.s3_config.secret_access_key) config.awsSecretAccessKey = data.s3_config.secret_access_key;
              if (data.s3_config.session_token) config.awsSessionToken = data.s3_config.session_token;
            }
            chrome.storage.local.set(config, function() {
              statusDot.classList.add('active');
              statusText.textContent = 'Connected & registered';
              btn.textContent = 'Connected!';
              btn.style.background = 'linear-gradient(135deg,#66bb6a 0%,#43a047 100%)';
              setTimeout(function() {
                btn.textContent = 'Connect';
                btn.style.background = '';
              }, 2000);
              refreshStatus();
            });
          })
          .catch(function() {
            // Save config even if registration fails
            chrome.storage.local.set(config, function() {
              statusDot.classList.add('active');
              statusText.textContent = 'Connected (registration failed)';
              refreshStatus();
            });
          });
      } else {
        chrome.storage.local.set(config, function() {
          statusDot.classList.add('active');
          statusText.textContent = 'Connected';
          btn.textContent = 'Connected!';
          btn.style.background = 'linear-gradient(135deg,#66bb6a 0%,#43a047 100%)';
          setTimeout(function() {
            btn.textContent = 'Connect';
            btn.style.background = '';
          }, 2000);
          refreshStatus();
        });
      }
    })
    .catch(function(err) {
      statusDot.classList.remove('active');
      statusText.textContent = 'Connection failed';
      btn.textContent = 'Retry';
      setTimeout(function() { btn.textContent = 'Connect'; }, 2000);
    });
});

// Reload events when event dropdown is changed
document.getElementById('mgmtEvent').addEventListener('change', function() {
  var eventId = this.value;
  if (eventId) {
    chrome.storage.local.set({ eventId: eventId });
  }
});

// ─── S3 Config ────────────────────────────────────────────────────────────────

var S3_KEYS = ['s3Bucket', 's3Region', 'presignEndpoint', 'awsAccessKeyId', 'awsSecretAccessKey', 'awsSessionToken'];

// Load saved values
chrome.storage.local.get(S3_KEYS, function(config) {
  if (config.s3Bucket)            document.getElementById('s3Bucket').value = config.s3Bucket;
  if (config.s3Region)            document.getElementById('s3Region').value = config.s3Region;
  if (config.presignEndpoint)     document.getElementById('presignEndpoint').value = config.presignEndpoint;
  if (config.awsAccessKeyId)      document.getElementById('awsAccessKeyId').value = config.awsAccessKeyId;
  if (config.awsSecretAccessKey)  document.getElementById('awsSecretAccessKey').value = config.awsSecretAccessKey;
  if (config.awsSessionToken)     document.getElementById('awsSessionToken').value = config.awsSessionToken;
});

// ─── Screenshot Quality ──────────────────────────────────────────────────────

// Load saved quality
chrome.storage.local.get(['screenshotQuality'], function(result) {
  var quality = result.screenshotQuality || 'medium';
  var btns = document.querySelectorAll('#qualityGroup .quality-btn');
  btns.forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-quality') === quality);
  });
});

// Quality button clicks
document.getElementById('qualityGroup').addEventListener('click', function(e) {
  var btn = e.target.closest('.quality-btn');
  if (!btn) return;
  var quality = btn.getAttribute('data-quality');
  chrome.storage.local.set({ screenshotQuality: quality });
  var btns = document.querySelectorAll('#qualityGroup .quality-btn');
  btns.forEach(function(b) { b.classList.toggle('active', b === btn); });
});

// Save
document.getElementById('s3SaveBtn').addEventListener('click', function() {
  var config = {
    s3Bucket:           document.getElementById('s3Bucket').value.trim(),
    s3Region:           document.getElementById('s3Region').value.trim(),
    presignEndpoint:    document.getElementById('presignEndpoint').value.trim(),
    awsAccessKeyId:     document.getElementById('awsAccessKeyId').value.trim(),
    awsSecretAccessKey: document.getElementById('awsSecretAccessKey').value.trim(),
    awsSessionToken:    document.getElementById('awsSessionToken').value.trim(),
  };
  chrome.storage.local.set(config, function() {
    var btn = document.getElementById('s3SaveBtn');
    var orig = btn.textContent;
    btn.textContent = 'Saved!';
    btn.classList.add('saved');
    setTimeout(function() {
      btn.textContent = orig;
      btn.classList.remove('saved');
    }, 1500);
    // Refresh to pick up new S3 status
    refreshStatus();
  });
});

// Pre-fill Demo
document.getElementById('s3DemoBtn').addEventListener('click', function() {
  document.getElementById('s3Bucket').value = 'boothapp-sessions-752266476357';
  document.getElementById('s3Region').value = 'us-east-1';
  document.getElementById('presignEndpoint').focus();
  document.getElementById('presignEndpoint').setAttribute('placeholder', 'Paste Lambda Function URL here');
});

// ─── QR Code Pairing ─────────────────────────────────────────────────────────

document.getElementById('pairBtn').addEventListener('click', function() {
  chrome.storage.local.get(S3_KEYS.concat(MGMT_KEYS), function(config) {
    // If management URL is configured, fetch QR payload from management server
    if (config.managementUrl && config.demoPcId) {
      var headers = {};
      if (config.managementToken) headers['X-Auth-Token'] = config.managementToken;
      fetch(config.managementUrl + '/api/demo-pcs/' + encodeURIComponent(config.demoPcId) + '/qr-payload', {
        headers: headers,
        cache: 'no-store',
      })
        .then(function(r) { return r.ok ? r.json() : Promise.reject('Failed'); })
        .then(function(payload) {
          renderQrPayload(payload);
        })
        .catch(function() {
          // Fallback: build v2 payload locally from stored config
          var payload = {
            type: 'phantomrecall-pair',
            v: 2,
            managementUrl: config.managementUrl,
            eventId: config.eventId ? parseInt(config.eventId, 10) : null,
            demoPcId: config.demoPcId || '',
            badgeFields: ['name', 'company', 'title'],
            eventName: '',
          };
          renderQrPayload(payload);
        });
    } else {
      // Fallback: v1 payload with S3 config
      var payload = {
        type: 'boothapp-pair',
        v: 1,
        s3Bucket: config.s3Bucket || '',
        s3Region: config.s3Region || '',
        presignEndpoint: config.presignEndpoint || '',
        awsAccessKeyId: config.awsAccessKeyId || '',
        awsSecretAccessKey: config.awsSecretAccessKey || '',
        awsSessionToken: config.awsSessionToken || '',
      };
      renderQrPayload(payload);
    }
  });
});

function renderQrPayload(payload) {
  var json = JSON.stringify(payload);

  // Generate QR code using qrcode-generator (Kazuhiko Arase, MIT)
  // typeNumber 0 = auto-detect version, 'M' = medium error correction
  var qr = qrcode(0, 'M');
  qr.addData(json);
  qr.make();

  // Render as SVG (no canvas dependency)
  var svgTag = qr.createSvgTag(4, 0);
  var container = document.getElementById('qrImage');
  container.innerHTML = svgTag;
  document.getElementById('qrOverlay').classList.add('visible');
}

document.getElementById('qrCloseBtn').addEventListener('click', function() {
  document.getElementById('qrOverlay').classList.remove('visible');
});

// Hide QR overlay when clicking outside the container
document.getElementById('qrOverlay').addEventListener('click', function(e) {
  if (e.target === this) {
    this.classList.remove('visible');
  }
});

// ─── Audio Device Selection ──────────────────────────────────────────────────

(function() {
  var select = document.getElementById('audioDevice');
  if (!select) return;

  // Load saved device
  chrome.storage.local.get(['audioDeviceId'], function(data) {
    if (data.audioDeviceId) select.value = data.audioDeviceId;
  });

  // Ask background to list devices via offscreen port
  chrome.runtime.sendMessage({ type: 'list-audio-devices' }, function(resp) {
    if (chrome.runtime.lastError) return;
    if (resp && resp.devices) {
      populateDevices(resp.devices);
    }
  });

  function populateDevices(devices) {
    select.innerHTML = '<option value="">Default microphone</option>';
    devices.forEach(function(d) {
      var opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label;
      select.appendChild(opt);
    });
    // Restore saved selection
    chrome.storage.local.get(['audioDeviceId'], function(data) {
      if (data.audioDeviceId) select.value = data.audioDeviceId;
    });
  }

  select.addEventListener('change', function() {
    chrome.storage.local.set({ audioDeviceId: select.value });
  });
})();
