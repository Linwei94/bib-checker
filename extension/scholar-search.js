if (!new URLSearchParams(location.search).get('bib-checker')) return;

// ── Show status banner ────────────────────────────────────────────
const banner = document.createElement('div');
banner.id = 'bib-checker-banner';
banner.style.cssText = `
  position:fixed; top:0; left:0; right:0; z-index:99999;
  background:#1e40af; color:white; font-family:sans-serif;
  font-size:13px; font-weight:600; padding:8px 16px;
  display:flex; align-items:center; gap:10px;
  box-shadow:0 2px 8px rgba(0,0,0,.3);
`;
banner.innerHTML = `<span id="bib-banner-spinner" style="display:inline-block;width:13px;height:13px;border:2px solid white;border-top-color:transparent;border-radius:50%;animation:bib-spin .7s linear infinite"></span>
<span id="bib-banner-msg">BibTeX Checker: 正在查找引用按钮…</span>`;
const style = document.createElement('style');
style.textContent = `@keyframes bib-spin{to{transform:rotate(360deg)}}`;
document.head.appendChild(style);
document.body.appendChild(banner);

function setStatus(msg, ok) {
  document.getElementById('bib-banner-msg').textContent = 'BibTeX Checker: ' + msg;
  if (ok !== undefined) {
    document.getElementById('bib-banner-spinner').style.background = ok ? '#4ade80' : '#f87171';
    document.getElementById('bib-banner-spinner').style.border = 'none';
    document.getElementById('bib-banner-spinner').style.animation = 'none';
    document.getElementById('bib-banner-spinner').style.borderRadius = '50%';
  }
  if (ok !== undefined) setTimeout(() => banner.remove(), 3000);
}

// ── Find and click Cite button ────────────────────────────────────
let attempts = 0;

function clickCite() {
  // Multiple selector fallbacks for Scholar's cite button
  const cite =
    document.querySelector('.gs_or_cit') ||
    document.querySelector('[data-clk-atid] a[aria-label*="ite"]') ||
    document.querySelector('a[href*="cites"]') ||
    [...document.querySelectorAll('a')].find(a => /^Cite$/i.test(a.textContent?.trim()));

  if (!cite) {
    if (++attempts < 30) { setTimeout(clickCite, 500); return; }
    setStatus('未找到引用按钮，请手动点击 Cite', false);
    return;
  }

  setStatus('找到引用按钮，正在点击…');
  cite.click();

  let popupAttempts = 0;
  function clickBibtex() {
    // BibTeX link: href contains scisf=4 or output=citation, or text = BibTeX
    const bib =
      document.querySelector('a[href*="scisf=4"]') ||
      document.querySelector('a[href*="scholar.bib"]') ||
      [...document.querySelectorAll('a')].find(a => /^bibtex$/i.test(a.textContent?.trim()));

    if (!bib) {
      if (++popupAttempts < 20) { setTimeout(clickBibtex, 400); return; }
      setStatus('未找到 BibTeX 链接，请手动点击', false);
      return;
    }

    setStatus('正在打开 BibTeX…');
    bib.click();
    setTimeout(() => banner.remove(), 1500);
  }
  setTimeout(clickBibtex, 800);
}

setTimeout(clickCite, 1200);
