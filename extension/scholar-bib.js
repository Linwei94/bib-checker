const bib = document.body.innerText.trim();
if (!bib.startsWith('@')) return;

// Style the page
document.body.style.cssText = 'margin:0;padding:0;background:#f0f9ff;font-family:-apple-system,sans-serif;';
document.body.innerHTML = `
<div style="max-width:680px;margin:32px auto;padding:0 16px">
  <div style="background:#1e3a8a;color:white;border-radius:10px 10px 0 0;padding:14px 18px;display:flex;align-items:center;gap:10px">
    <span style="font-size:16px;font-weight:700">📋 BibTeX 已就绪</span>
    <span style="flex:1"></span>
    <button id="copy-btn" style="background:#3b82f6;color:white;border:none;border-radius:6px;padding:7px 18px;font-size:13px;font-weight:700;cursor:pointer">
      复制 BibTeX
    </button>
  </div>
  <pre id="bib-content" style="margin:0;background:white;border:1px solid #bfdbfe;border-top:none;border-radius:0 0 10px 10px;padding:16px;font-size:12.5px;line-height:1.7;white-space:pre-wrap;word-break:break-all;color:#1e293b">${bib.replace(/</g,'&lt;')}</pre>
  <p style="margin-top:14px;color:#6b7280;font-size:12px;text-align:center">
    复制后切回 BibTeX Checker，在文本框内按 <kbd style="background:#e5e7eb;padding:2px 7px;border-radius:4px;font-family:monospace">Ctrl+V</kbd> 粘贴即可自动填入并显示差异
  </p>
</div>
`;

const btn = document.getElementById('copy-btn');
btn.onclick = () => {
  navigator.clipboard.writeText(bib).then(() => {
    btn.textContent = '✅ 已复制！';
    btn.style.background = '#059669';
    setTimeout(() => {
      btn.textContent = '复制 BibTeX';
      btn.style.background = '#3b82f6';
    }, 2000);
  }).catch(() => {
    // Fallback: select the text
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('bib-content'));
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    btn.textContent = '已选中，请按 Ctrl+C';
  });
};

// Also try postMessage to opener in case tool is still open
if (window.opener) {
  try { window.opener.postMessage({ type: 'bib-checker-bib', bib }, '*'); } catch(e) {}
}
