// Background service worker — fetches BibTeX URLs bypassing CORS
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'fetch-bib') return;
  fetch(msg.url, { credentials: 'include' })
    .then(r => r.text())
    .then(text => sendResponse({ ok: true, text: text.trim() }))
    .catch(e  => sendResponse({ ok: false, error: e.message }));
  return true; // keep channel open for async response
});
