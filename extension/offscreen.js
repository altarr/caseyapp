// CaseyApp offscreen document — records microphone audio via MediaRecorder.
// Communicates with background.js via chrome.runtime messages.

let mediaRecorder = null;
let audioChunks = [];
let recording = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'audio-start') {
    startRecording().then(ok => sendResponse({ ok })).catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'audio-stop') {
    stopRecording().then(blob => {
      // Convert blob to base64 and send back
      const reader = new FileReader();
      reader.onloadend = () => {
        sendResponse({ ok: true, data: reader.result, size: blob.size, type: blob.type });
      };
      reader.readAsDataURL(blob);
    }).catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'audio-status') {
    sendResponse({ recording, chunks: audioChunks.length });
    return false;
  }
});

async function startRecording() {
  if (recording) return true;

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

  // Prefer webm/opus, fall back to whatever is available
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '';

  mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.start(5000); // Collect data every 5 seconds
  recording = true;
  console.log('[CaseyApp Audio] Recording started, mime:', mediaRecorder.mimeType);
  return true;
}

async function stopRecording() {
  if (!mediaRecorder || !recording) {
    return new Blob(audioChunks, { type: 'audio/webm' });
  }

  return new Promise((resolve) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      console.log('[CaseyApp Audio] Recording stopped, size:', blob.size);

      // Stop all tracks
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      mediaRecorder = null;
      recording = false;
      audioChunks = [];

      resolve(blob);
    };
    mediaRecorder.stop();
  });
}
