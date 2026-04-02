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
  .bib-countdown {
    background: rgba(255,255,255,.15); border-radius: 20px;
    padding: 3px 10px; font-size: 12px; font-weight: 700; min-width: 32px; text-align: center;
  }
  .bib-btn-cancel {
    background: rgba(255,255,255,.15); color: white; border: 1px solid rgba(255,255,255,.3);
    border-radius: 6px; padding: 5px 12px; font-size: 12px; font-weight: 700;
    cursor: pointer; white-space: nowrap;
  }
  .bib-btn-cancel:hover { background: rgba(255,255,255,.25); }
  .bib-highlight {
    outline: 3px solid #facc15 !important;
    outline-offset: 3px !important;
    box-shadow: 0 0 0 6px rgba(250,204,21,.3) !important;
    border-radius: 4px;
  }
`;
document.head.appendChild(style);

const banner = document.createElement('div');
banner.id = 'bib-banner';
document.body.style.marginTop = '46px';
document.body.appendChild(banner);

let cancelled = false;

function setMsg(msg, showCountdown) {
  banner.innerHTML = `
    <span id="bib-banner-msg">${msg}</span>
    ${showCountdown ? `<span class="bib-countdown" id="bib-cd">${_bibDelay}</span>` : ''}
    <button class="bib-btn-cancel" id="bib-cancel">✕ 取消</button>
  `;
  document.getElementById('bib-cancel').onclick = () => {
    cancelled = true;
    banner.remove();
    document.body.style.marginTop = '';
    document.querySelectorAll('.bib-highlight').forEach(el => el.classList.remove('bib-highlight'));
  };
}

function countdown(sec) {
  return new Promise(resolve => {
    let n = sec;
    const el = document.getElementById('bib-cd');
    if (el) el.textContent = n;
    const iv = setInterval(() => {
      if (cancelled) { clearInterval(iv); resolve(); return; }
      n--;
      const el = document.getElementById('bib-cd');
      if (el) el.textContent = n;
      if (n <= 0) { clearInterval(iv); resolve(); }
    }, 1000);
  });
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Main flow ─────────────────────────────────────────────────────
async function run() {
  // Step 1: find Cite button
  setMsg('⏳ 等待页面加载…', false);
  let cite = null;
  for (let i = 0; i < 30; i++) {
    cite = document.querySelector('.gs_or_cit') ||
           [...document.querySelectorAll('a')].find(a => /^Cite$/i.test(a.textContent?.trim()));
    if (cite) break;
    await wait(500);
  }
  if (cancelled) return;
  if (!cite) {
    setMsg('❌ 未找到 Cite 按钮');
    chrome.runtime.sendMessage({ type: 'bib-error', error: '未找到 Cite 按钮（可能需要人机验证）' });
    return;
  }

  cite.classList.add('bib-highlight');
  cite.scrollIntoView({ behavior: 'smooth', block: 'center' });
  chrome.runtime.sendMessage({ type: 'scholar-progress', step: 2 });
  setMsg('Step 1 / 2 &nbsp;—&nbsp; 即将点击 <b>Cite</b> 按钮', true);
  await countdown(_bibDelay);
  if (cancelled) return;

  cite.classList.remove('bib-highlight');
  cite.click();

  // Step 2: find BibTeX link in popup
  setMsg('⏳ 等待弹窗…', false);
  let bib = null;
  for (let i = 0; i < 25; i++) {
    bib = document.querySelector('a[href*="scisf=4"]') ||
          document.querySelector('a[href*="scholar.bib"]') ||
          [...document.querySelectorAll('a')].find(a => /^bibtex$/i.test(a.textContent?.trim()));
    if (bib) break;
    await wait(400);
  }
  if (cancelled) return;
  if (!bib) {
    setMsg('❌ 未找到 BibTeX 链接');
    chrome.runtime.sendMessage({ type: 'bib-error', error: '未找到 BibTeX 链接' });
    return;
  }

  bib.classList.add('bib-highlight');
  chrome.runtime.sendMessage({ type: 'scholar-progress', step: 3 });
  setMsg('Step 2 / 2 &nbsp;—&nbsp; 即将点击 <b>BibTeX</b> 链接', true);
  await countdown(_bibDelay);
  if (cancelled) return;

  bib.classList.remove('bib-highlight');
  chrome.runtime.sendMessage({ type: 'scholar-progress', step: 4 });
  setMsg('⏳ 正在获取 BibTeX…', false);

  // Step 3: fetch via background worker, then auto-copy
  chrome.runtime.sendMessage({ type: 'fetch-bib', url: bib.href }, (res) => {
    if (cancelled) return;
    if (res && res.ok && res.text.startsWith('@')) {
      const bibText = res.text;
      // Auto-copy to clipboard
      navigator.clipboard.writeText(bibText).catch(() => {});
      // Relay BibTeX to checker tab via background (background also closes this tab after 1.5s)
      chrome.runtime.sendMessage({ type: 'bib-result', bib: bibText });
      showResult(bibText);
    } else {
      setMsg('❌ 获取失败：' + (res?.error || '未知错误'));
    }
  });
}

// ── Result overlay ────────────────────────────────────────────────
function showResult(bib) {
  banner.remove();
  document.body.style.marginTop = '';

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,.55);
    display:flex; align-items:center; justify-content:center; padding:24px;
  `;
  overlay.innerHTML = `
    <div style="background:white;border-radius:12px;width:100%;max-width:640px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)">
      <div style="background:#065f46;color:white;padding:14px 18px;display:flex;align-items:center;gap:10px;flex-shrink:0">
        <span style="font-size:15px;font-weight:700;flex:1">✅ BibTeX 已自动复制到剪贴板</span>
        <span style="opacity:.65;font-size:12px">[Esc] 关闭</span>
      </div>
      <pre style="flex:1;overflow-y:auto;margin:0;padding:16px;font-size:12.5px;line-height:1.7;white-space:pre-wrap;word-break:break-all;color:#1e293b;background:#f8fafc">${bib.replace(/</g,'&lt;')}</pre>
      <div style="padding:12px 16px;background:#f0f9ff;border-top:1px solid #bfdbfe;display:flex;gap:10px;align-items:center;flex-shrink:0">
        <span style="flex:1;font-size:12px;color:#6b7280">切回 BibTeX Checker，按 Ctrl+V 粘贴即可</span>
        <button id="bib-copy-btn" style="background:#059669;color:white;border:none;border-radius:6px;padding:8px 20px;font-size:13px;font-weight:700;cursor:pointer">再次复制</button>
        <button id="bib-close-btn" style="background:#e5e7eb;color:#374151;border:none;border-radius:6px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer">关闭</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  function doCopy() {
    navigator.clipboard.writeText(bib).then(() => {
      const btn = document.getElementById('bib-copy-btn');
      if (btn) { btn.textContent = '✅ 已复制！'; btn.style.background = '#047857'; }
      setTimeout(() => {
        const btn = document.getElementById('bib-copy-btn');
        if (btn) { btn.textContent = '复制 BibTeX'; btn.style.background = '#059669'; }
      }, 2000);
    });
  }

  document.getElementById('bib-copy-btn').onclick = doCopy;
  document.getElementById('bib-close-btn').onclick = () => overlay.remove();

  document.addEventListener('keydown', function h(e) {
    if (e.key === 'Enter') { e.preventDefault(); doCopy(); }
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', h, true); }
  }, true);
}

// ── Start ─────────────────────────────────────────────────────────
const _bibDelay = parseInt(new URLSearchParams(location.search).get('bib-delay') || '3');
setTimeout(run, 500);
