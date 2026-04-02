// Background service worker — fetches BibTeX URLs bypassing CORS, and manages tabs
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'fetch-bib') {
    fetch(msg.url, { credentials: 'include' })
      .then(r => r.text())
      .then(text => sendResponse({ ok: true, text: text.trim() }))
      .catch(e  => sendResponse({ ok: false, error: e.message }));
    return true; // keep channel open for async response
  }

  if (msg.type === 'bib-ext-open-scholar') {
    chrome.tabs.create({ url: msg.url }, (tab) => {
      sendResponse({ type: 'bib-ext-scholar-opened', tabId: tab.id });
    });
    return true;
  }

  if (msg.type === 'close-current-tab') {
    if (sender.tab?.id) chrome.tabs.remove(sender.tab.id);
  }
});
