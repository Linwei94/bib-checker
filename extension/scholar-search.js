// ── Banner UI ─────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  #bib-banner {
    position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
    background: #1e3a8a; color: white;
    font-family: -apple-system, sans-serif; font-size: 13px;
    padding: 10px 16px; display: flex; align-items: center; gap: 12px;
    box-shadow: 0 3px 10px rgba(0,0,0,.35);
  }
  #bib-banner-msg { flex: 1; font-weight: 600; }
  #bib-banner-msg .step { color: #93c5fd; font-size: 11px; margin-right: 6px; }
  .bib-btn {
    background: #3b82f6; color: white; border: none; border-radius: 6px;
    padding: 6px 14px; font-size: 12px; font-weight: 700;
    cursor: pointer; white-space: nowrap;
  }
  .bib-btn:hover { background: #2563eb; }
  .bib-btn.green { background: #059669; }
  .bib-btn.green:hover { background: #047857; }
  .bib-btn.gray  { background: #6b7280; }
  .bib-btn.gray:hover  { background: #4b5563; }
  .bib-highlight {
    outline: 3px solid #facc15 !important;
    outline-offset: 3px !important;
    box-shadow: 0 0 0 6px rgba(250,204,21,.3) !important;
    border-radius: 4px;
    transition: outline .2s;
  }
`;
document.head.appendChild(style);

const banner = document.createElement('div');
banner.id = 'bib-banner';
document.body.appendChild(banner);
// Push page content down
document.body.style.marginTop = '48px';

function setStep(stepNum, msg, btnLabel, btnClass, onBtn, extra) {
  banner.innerHTML = `
    <span id="bib-banner-msg"><span class="step">Step ${stepNum}/2</span>${msg}</span>
    ${extra || ''}
    <button class="bib-btn ${btnClass || ''}" id="bib-next-btn">${btnLabel} <span style="opacity:.7;font-size:11px">[Enter]</span></button>
    <button class="bib-btn gray" id="bib-cancel-btn">✕ <span style="opacity:.7;font-size:11px">[Esc]</span></button>
  `;
  document.getElementById('bib-next-btn').onclick = onBtn;
  document.getElementById('bib-cancel-btn').onclick = closeBanner;
}

function setInfo(msg) {
  banner.innerHTML = `<span id="bib-banner-msg">${msg}</span>
    <button class="bib-btn gray" id="bib-cancel-btn">✕ 关闭</button>`;
  document.getElementById('bib-cancel-btn').onclick = closeBanner;
}

function closeBanner() {
  banner.remove();
  document.body.style.marginTop = '';
  document.querySelectorAll('.bib-highlight').forEach(el => el.classList.remove('bib-highlight'));
}

// ── Step 1: Find Cite button ──────────────────────────────────────
let citeEl = null, bibEl = null;

function findCite() {
  citeEl =
    document.querySelector('.gs_or_cit') ||
    [...document.querySelectorAll('a')].find(a => /^Cite$/i.test(a.textContent?.trim()));
  return citeEl;
}

function step1() {
  if (!findCite()) {
    setInfo('⚠️ 未找到 Cite 按钮，请等待页面加载完成后重试');
    setTimeout(() => { if (findCite()) step1(); }, 1000);
    return;
  }
  citeEl.classList.add('bib-highlight');
  citeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setStep(1, '已找到 <b>Cite</b> 按钮（黄色高亮）', '▶ 点击 Cite', 'green', doStep1);
}

function doStep1() {
  citeEl.classList.remove('bib-highlight');
  citeEl.click();
  setInfo('⏳ 等待引用弹窗出现…');
  waitForBibtexLink();
}

// ── Step 2: Find BibTeX link in popup ────────────────────────────
function waitForBibtexLink(attempts) {
  attempts = attempts || 0;
  bibEl =
    document.querySelector('a[href*="scisf=4"]') ||
    document.querySelector('a[href*="scholar.bib"]') ||
    [...document.querySelectorAll('a')].find(a => /^bibtex$/i.test(a.textContent?.trim()));

  if (!bibEl) {
    if (attempts < 25) { setTimeout(() => waitForBibtexLink(attempts + 1), 400); return; }
    setInfo('⚠️ 未找到 BibTeX 链接，请手动在弹窗中点击 BibTeX');
    return;
  }

  bibEl.classList.add('bib-highlight');
  setStep(2, '已找到 <b>BibTeX</b> 链接（黄色高亮）', '▶ 点击 BibTeX', 'green', doStep2);
}

function doStep2() {
  bibEl.classList.remove('bib-highlight');
  closeBanner();
  bibEl.click();
  // BibTeX page will open — scholar-bib.js handles it
}

// ── Keyboard shortcut: Enter = next step, Esc = cancel ───────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const btn = document.getElementById('bib-next-btn');
    if (btn) { e.preventDefault(); btn.click(); }
  }
  if (e.key === 'Escape') {
    const btn = document.getElementById('bib-cancel-btn');
    if (btn) btn.click();
  }
}, true);

// ── Start ─────────────────────────────────────────────────────────
setTimeout(step1, 800);
