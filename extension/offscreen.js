// Phantom Recall offscreen document — records microphone audio via MediaRecorder.
// Listens for start/stop commands from background service worker.

let mediaRecorder = null;
let audioChunks = [];
let recording = false;

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[offscreen] received:', message.type);

  if (message.target !== 'offscreen') return false;

  if (message.type === 'start-recording') {
    startRecording()
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'stop-recording') {
    stopRecording()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'recording-status') {
    sendResponse({ recording, chunks: audioChunks.length });
    return false;
  }

  return false;
});

async function startRecording() {
  if (recording) return;

  console.log('[offscreen] requesting microphone...');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: 44100,
      echoCancellation: true,
      noiseSuppression: true,
    },
    video: false,
  });

  audioChunks = [];

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '';

  mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) audioChunks.push(event.data);
  };

  mediaRecorder.start(5000);
  recording = true;
  console.log('[offscreen] recording started, mime:', mediaRecorder.mimeType);
}

async function stopRecording() {
  if (!mediaRecorder || !recording) {
    return { ok: true, data: null, size: 0 };
  }

  return new Promise((resolve) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      console.log('[offscreen] recording stopped, size:', blob.size);

      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      mediaRecorder = null;
      recording = false;

      // Convert to base64 data URL
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({ ok: true, data: reader.result, size: blob.size, type: blob.type });
      };
      reader.readAsDataURL(blob);

      audioChunks = [];
    };
    mediaRecorder.stop();
  });
}
