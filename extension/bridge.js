// Bridge: forwards bib-ext-* messages from the bib-checker page to the background service worker
window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  if (!e.data?.type?.startsWith('bib-ext-')) return;
  chrome.runtime.sendMessage(e.data, (response) => {
    if (chrome.runtime.lastError) return; // ignore "no receiver" errors
    if (response) window.postMessage(response, '*');
  });
});
