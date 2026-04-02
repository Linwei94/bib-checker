// This page (scholar.googleusercontent.com/scholar.bib?...) is plain-text BibTeX.
const bib = document.body.innerText.trim();
if (!bib.startsWith('@')) return;

// Send back to the opener (BibTeX Checker tool)
if (window.opener) {
  try {
    window.opener.postMessage({ type: 'bib-checker-bib', bib }, '*');
    setTimeout(() => window.close(), 300);
    return;
  } catch(e) {}
}

// Fallback: copy to clipboard and show a styled message
navigator.clipboard.writeText(bib).catch(() => {});
document.body.style.cssText = `
  font-family: -apple-system, sans-serif;
  background: #f0fdf4; padding: 24px; margin: 0;
`;
document.body.innerHTML = `
  <div style="max-width:600px;margin:0 auto">
    <div style="color:#059669;font-size:18px;font-weight:700;margin-bottom:12px">
      ✅ BibTeX copied to clipboard
    </div>
    <p style="color:#374151;margin-bottom:16px">
      Switch back to the BibTeX Checker tab and press <kbd style="background:#e5e7eb;padding:2px 7px;border-radius:4px;font-family:monospace">Ctrl+V</kbd> to paste.
    </p>
    <pre style="background:white;padding:14px;border-radius:8px;border:1px solid #d1fae5;font-size:12px;white-space:pre-wrap;word-break:break-all">${bib.replace(/</g,'&lt;')}</pre>
  </div>
`;
