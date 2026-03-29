// V1-Helper background service worker
// Stub: MCP relay connection and tool registration will be implemented in Part 2

chrome.runtime.onInstalled.addListener(() => {
  console.log('V1-Helper installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Stub: handle messages from popup and content scripts
  console.log('V1-Helper background received message:', message);
  sendResponse({ status: 'ok' });
});
