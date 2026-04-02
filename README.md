# BibTeX Checker

A Chrome extension that catches AI-hallucinated references in your BibTeX. LLMs (ChatGPT, Claude, Gemini) frequently fabricate paper titles, authors, venues, and years that look plausible but don't exist on Google Scholar. Top venues including ICML, ICLR, and NeurIPS now run automated reference checks.

**BibTeX Checker** batch-fetches your entire `.bib` file against Google Scholar, then shows a field-by-field diff with word-level highlights so you can fix fake citations before submission — in minutes instead of hours.

🌐 **[Website](https://linwei94.github.io/bib-checker/)** &nbsp;·&nbsp; 🇨🇳 **[中文说明](README_zh.md)**

---

## Installation

> No Chrome Web Store required. Load directly from source.

1. **Clone or download** this repo — `git clone https://github.com/Linwei94/bib-checker` or use the **Code → Download ZIP** button on GitHub
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the `extension/` folder
5. The 📚 icon appears in your toolbar — done

## Usage

### Phase 1 — Batch Fetch

1. Click the 📚 icon to open BibTeX Checker
2. Paste your `.bib` file content into the left panel and click **Parse**
3. Click **▶ Start Batch Fetch** — the extension automatically opens a Google Scholar tab for each entry, clicks Cite → BibTeX, fetches the result, and closes the tab
4. Watch the entry list fill up: ⏳ pending → 🔍 has diff / `=` no diff / ❌ error

### Phase 2 — Review & Fix

5. Click any fetched entry to see the side-by-side diff
   - Changed words highlighted in **amber** (original) and **green** (Scholar)
   - Case-only differences are ignored
6. For each entry, choose:
   - **✅ Replace** — apply Scholar's BibTeX (keeps your original key by default)
   - **👍 Keep** — mark as reviewed, keep your version
   - **⚡ Replace All (N)** — apply all pending Scholar results at once
7. Click **⬇ Download .bib** to save your updated file

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `R` | Replace current entry |
| `K` | Keep current entry |
| `←` / `→` | Previous / next fetched entry |
| `Ctrl+Z` | Undo |

## How It Works

```
extension/
├── manifest.json        Chrome extension config (MV3)
├── background.js        Service worker — message relay between tabs
├── scholar-search.js    Content script injected into scholar.google.com
│                        Clicks Cite → BibTeX, fetches raw BibTeX, relays back
├── index.html           Extension UI (opened when clicking the toolbar icon)
└── index.js             All UI logic — parse, batch fetch, diff, replace
```

- **Background service worker** tracks which tab is the checker and relays messages between it and Scholar tabs
- **Scholar content script** runs at `document_end`, shows a blue progress banner, auto-clicks Cite and BibTeX links with configurable delay, sends the result back via `chrome.runtime.sendMessage`
- **Diff algorithm** uses LCS on word tokens (case-normalised) to highlight exactly which words changed

## Notes

- Google Scholar may show a CAPTCHA after many requests. If the extension times out (60s), the entry is marked ❌ — just retry it manually
- The configurable delay (1–10s) between fetches helps avoid rate limiting
- All `.bib` content stays local in `localStorage` — nothing is sent to any external server except Google Scholar

## License

MIT
