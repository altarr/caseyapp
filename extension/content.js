// V1-Helper content script
// Stub: page interaction and DOM injection will be implemented in Part 2

console.log('V1-Helper content script loaded on:', window.location.hostname);

// Listen for messages from background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Stub: handle tool invocations targeting page content
  console.log('V1-Helper content received message:', message);
  sendResponse({ status: 'ok', url: window.location.href });
});
