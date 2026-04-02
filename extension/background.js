// Background service worker
let bibCheckerTabId = null; // tab that requested Scholar; receives BibTeX results

// ── Open / focus the BibTeX Checker tab when the extension icon is clicked ──
chrome.action.onClicked.addListener(() => {
  const url = chrome.runtime.getURL('index.html');
  chrome.tabs.query({ url }, (tabs) => {
    if (tabs.length > 0) {
      bibCheckerTabId = tabs[0].id;
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url }, (tab) => { bibCheckerTabId = tab.id; });
    }
  });
});

// ── Message handling ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // Fetch BibTeX URL bypassing CORS (called by scholar-search.js)
  if (msg.type === 'fetch-bib') {
    fetch(msg.url, { credentials: 'include' })
      .then(r => r.text())
      .then(text => sendResponse({ ok: true, text: text.trim() }))
      .catch(e  => sendResponse({ ok: false, error: e.message }));
    return true; // keep channel open
  }

  // Open a Scholar tab (called by index.html); remember caller so we can return results
  if (msg.type === 'bib-ext-open-scholar') {
    bibCheckerTabId = sender.tab?.id ?? bibCheckerTabId;
    chrome.tabs.create({ url: msg.url });
    return false;
  }

  // Scholar content script reports step progress — relay to checker tab
  if (msg.type === 'scholar-progress') {
    if (bibCheckerTabId != null) chrome.tabs.sendMessage(bibCheckerTabId, msg);
    return false;
  }

  // Scholar content script has the BibTeX — relay to checker tab, then close Scholar tab
  if (msg.type === 'bib-result') {
    if (bibCheckerTabId != null) {
      chrome.tabs.sendMessage(bibCheckerTabId, { type: 'bib-checker-bib', bib: msg.bib });
    }
    if (sender.tab?.id) setTimeout(() => chrome.tabs.remove(sender.tab.id), 1500);
    return false;
  }
});
