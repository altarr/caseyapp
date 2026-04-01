// Phantom Recall offscreen document — microphone recording via MediaRecorder.
// Communicates with background via port connection.

let mediaRecorder = null;
let audioChunks = [];
let recording = false;
let port = null;

// Connect to background on load
function connect() {
  port = chrome.runtime.connect({ name: 'audio-recorder' });
  port.onMessage.addListener(handleMessage);
  port.onDisconnect.addListener(() => {
    console.log('[offscreen] port disconnected, reconnecting...');
    setTimeout(connect, 1000);
  });
  console.log('[offscreen] connected to background');
}

function handleMessage(msg) {
  if (msg.type === 'start') {
    startRecording(msg.deviceId).then(() => {
      port.postMessage({ type: 'started', ok: true });
    }).catch(err => {
      port.postMessage({ type: 'started', ok: false, error: err.message });
    });
  }

  if (msg.type === 'stop') {
    stopRecording().then(result => {
      port.postMessage(result);
    }).catch(err => {
      port.postMessage({ type: 'stopped', ok: false, error: err.message });
    });
  }

  if (msg.type === 'status') {
    port.postMessage({ type: 'status', recording });
  }

  if (msg.type === 'list-devices') {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const audioInputs = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || 'Microphone ' + d.deviceId.slice(0, 8) }));
      port.postMessage({ type: 'devices', devices: audioInputs });
    }).catch(err => {
      port.postMessage({ type: 'devices', devices: [], error: err.message });
    });
  }
}

async function startRecording(deviceId) {
  if (recording) return;

  console.log('[offscreen] requesting microphone...', deviceId ? 'device:' + deviceId : 'default');
  const audioConstraints = {
    channelCount: 1, sampleRate: 44100,
    echoCancellation: true, noiseSuppression: true,
  };
  if (deviceId) audioConstraints.deviceId = { exact: deviceId };

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: audioConstraints,
    video: false,
  });

  audioChunks = [];

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';

  mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
  mediaRecorder.start(5000);
  recording = true;
  console.log('[offscreen] recording started, mime:', mediaRecorder.mimeType);
}

async function stopRecording() {
  if (!mediaRecorder || !recording) {
    return { type: 'stopped', ok: true, data: null, size: 0 };
  }

  return new Promise((resolve) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      console.log('[offscreen] stopped, size:', blob.size);
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      mediaRecorder = null;
      recording = false;

      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({ type: 'stopped', ok: true, data: reader.result, size: blob.size, mimeType: blob.type });
      };
      reader.readAsDataURL(blob);
      audioChunks = [];
    };
    mediaRecorder.stop();
  });
}

connect();
