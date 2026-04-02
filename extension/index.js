window.onerror = (msg, src, line) => {
  console.error('Page error:', msg, 'line', line);
  const el = document.getElementById('toast');
  if (el) { el.textContent = `JS错误 L${line}: ${msg}`; el.classList.add('show'); }
};

// ── State ──────────────────────────────────────────────────────
let entries    = [];
let currentIdx = -1;
let undoHistory = [];

// ── Step management ────────────────────────────────────────────
function setStep(n, state) {
  const el  = document.getElementById('step-' + n);
  const dot = document.getElementById('dot-' + n);
  if (!el || !dot) return;
  el.className = 'step ' + state;
  if (state === 'active') {
    dot.innerHTML = '<div class="step-spinner"></div>';
  } else if (state === 'done') {
    dot.innerHTML = '✓';
  } else {
    dot.innerHTML = n;
  }
}

function resetSteps() {
  for (let i = 1; i <= 5; i++) setStep(i, 'idle');
}

// ── BibTeX parser ──────────────────────────────────────────────
function parseBib(text) {
  const results = [];
  let i = 0;
  while (i < text.length) {
    const at = text.indexOf('@', i);
    if (at === -1) break;
    let j = at + 1;
    while (j < text.length && /\w/.test(text[j])) j++;
    const type = text.slice(at + 1, j).trim().toLowerCase();
    if (!type || type === 'string' || type === 'preamble' || type === 'comment') {
      const ob = text.indexOf('{', j);
      if (ob === -1) break;
      let d = 0, k = ob;
      for (; k < text.length; k++) {
        if (text[k] === '{') d++;
        else if (text[k] === '}') { d--; if (d === 0) { k++; break; } }
      }
      i = k; continue;
    }
    const ob = text.indexOf('{', j);
    if (ob === -1) break;
    let depth = 0, k = ob, inQuote = false;
    for (; k < text.length; k++) {
      const ch = text[k];
      if (ch === '"' && depth === 1) inQuote = !inQuote;
      if (!inQuote) {
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) { k++; break; } }
      }
    }
    const raw = text.slice(at, k);
    const comma = raw.indexOf(',');
    if (comma === -1) { i = k; continue; }
    const key = raw.slice(raw.indexOf('{') + 1, comma).trim();
    if (!key || /\s/.test(key)) { i = k; continue; }
    const f = extractFields(raw);
    results.push({
      key, type, raw, start: at, end: k,
      title:   cleanStr(f.title   || '(no title)'),
      authors: cleanStr(f.author  || ''),
      year:    (f.year || '').replace(/[{}]/g, '').trim(),
      venue:   cleanStr(f.journal || f.booktitle || f.howpublished || ''),
      status: 'pending',
    });
    i = k;
  }
  return results;
}

function extractFields(raw) {
  const fields = {};
  const re = /\b([a-zA-Z]\w*)\s*=\s*/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const name = m[1].toLowerCase();
    const pos = m.index + m[0].length;
    const ch = raw[pos];
    let val = '';
    if (ch === '{') {
      let d = 0, jj = pos;
      for (; jj < raw.length; jj++) {
        if (raw[jj] === '{') d++;
        else if (raw[jj] === '}') { d--; if (d === 0) { jj++; break; } }
      }
      val = raw.slice(pos + 1, jj - 1);
    } else if (ch === '"') {
      const end = raw.indexOf('"', pos + 1);
      val = end === -1 ? '' : raw.slice(pos + 1, end);
    } else {
      const end = raw.slice(pos).search(/[,}\s]/);
      val = end === -1 ? raw.slice(pos) : raw.slice(pos, pos + end);
    }
    fields[name] = val;
  }
  return fields;
}

function cleanStr(s) {
  if (!s) return '';
  return s.replace(/\{\\['"` ^~cduHkrtvb]\s*\{?([a-zA-Z])\}?\}/g, '$1')
          .replace(/\\[a-zA-Z]+\s*/g, '')
          .replace(/[{}\\"]/g, '')
          .replace(/\s+/g, ' ').trim();
}

// ── Parse & render ─────────────────────────────────────────────
function reparsePreservingStatus() {
  const sm = {};
  entries.forEach(e => { sm[e.key] = e.status; });
  entries = parseBib(document.getElementById('bib-textarea').value);
  entries.forEach(e => { if (sm[e.key]) e.status = sm[e.key]; });
}

function parseAndRender() {
  const text = document.getElementById('bib-textarea').value;
  if (!text.trim()) { showToast('请先粘贴 .bib 内容'); return; }
  entries = parseBib(text);
  if (entries.length === 0) { showToast('未找到条目，请检查 BibTeX 格式'); return; }
  undoHistory = [];
  updateUndoBtn();
  renderEntryList();
  selectEntry(0);
  showToast(`已解析 ${entries.length} 条参考文献`);
}

function renderEntryList() {
  const wrap  = document.getElementById('entry-list-wrap');
  const empty = document.getElementById('list-empty');
  wrap.querySelectorAll('.entry-row').forEach(r => r.remove());
  if (entries.length === 0) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  entries.forEach((e, i) => {
    const div = document.createElement('div');
    div.className = 'entry-row' + (i === currentIdx ? ' active' : '');
    div.onclick = () => selectEntry(i);
    const badge = e.status === 'ok' ? '✅' : e.status === 'replaced' ? '🔄' : '⏳';
    div.innerHTML =
      `<span class="entry-badge" onclick="toggleStatus(${i},event)" title="点击切换状态">${badge}</span>` +
      `<span class="entry-key" title="${e.key}">${e.key}</span>` +
      `<span class="entry-ttl" title="${e.title}">${e.title}</span>`;
    wrap.appendChild(div);
  });
  updateStats();
}

// ── Toggle status ──────────────────────────────────────────────
function toggleStatus(idx, event) {
  event.stopPropagation();
  pushHistory();
  const e = entries[idx];
  if (e.status === 'pending') e.status = 'ok';
  else if (e.status === 'ok') e.status = 'pending';
  renderEntryList();
  updateStats();
}

// ── Select entry ───────────────────────────────────────────────
function selectEntry(idx) {
  if (idx < 0 || idx >= entries.length) return;
  currentIdx = idx;
  const e = entries[idx];

  document.querySelectorAll('.entry-row').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
    if (i === idx) el.scrollIntoView({ block: 'nearest' });
  });

  highlightInBib(e);

  document.getElementById('no-entry-msg').style.display = 'none';
  document.getElementById('active-workflow').style.display = 'flex';

  const authShort = e.authors.length > 90 ? e.authors.slice(0, 90) + '…' : e.authors;
  document.getElementById('entry-card').innerHTML =
    `<div class="ec-title">${e.title}</div>` +
    `<div class="ec-meta">` +
    (e.authors ? `<b>作者：</b>${authShort}<br>` : '') +
    (e.year    ? `<b>年份：</b>${e.year}` : '') +
    (e.year && e.venue ? ' · ' : '') +
    (e.venue   ? `<b>来源：</b>${e.venue.slice(0, 80)}` : '') +
    `<br><b>类型：</b>@${e.type} &nbsp; <b>Key：</b><code>${e.key}</code>` +
    `</div>`;

  document.getElementById('key-display').textContent = e.key;
  document.getElementById('new-bib').value = '';
  document.getElementById('progress-text').textContent = `${idx + 1} / ${entries.length}`;
  setFetchStatus('', '');
  resetSteps();
  updateStats();
}

function highlightInBib(entry) {
  const ta = document.getElementById('bib-textarea');
  const text = ta.value;
  const re = new RegExp('@\\w+\\s*\\{\\s*' + escapeRe(entry.key) + '\\s*,', 'i');
  const m = re.exec(text);
  if (!m) return;
  let depth = 0, ii = m.index;
  for (; ii < text.length; ii++) {
    if (text[ii] === '{') depth++;
    else if (text[ii] === '}') { depth--; if (depth === 0) { ii++; break; } }
  }
  ta.focus();
  ta.setSelectionRange(m.index, ii);
  const lines = text.slice(0, m.index).split('\n').length;
  const lineH = parseFloat(getComputedStyle(ta).lineHeight) || 17;
  ta.scrollTop = Math.max(0, (lines - 3) * lineH);
}

// ── Undo ───────────────────────────────────────────────────────
function pushHistory() {
  undoHistory.push({
    text: document.getElementById('bib-textarea').value,
    statuses: entries.map(e => ({ key: e.key, status: e.status })),
    idx: currentIdx,
  });
  if (undoHistory.length > 30) undoHistory.shift();
  updateUndoBtn();
}

function undoState() {
  if (!undoHistory.length) { showToast('没有可撤销的操作'); return; }
  const s = undoHistory.pop();
  document.getElementById('bib-textarea').value = s.text;
  reparsePreservingStatus();
  s.statuses.forEach(({ key, status }) => {
    const e = entries.find(x => x.key === key);
    if (e) e.status = status;
  });
  renderEntryList();
  selectEntry(s.idx >= 0 && s.idx < entries.length ? s.idx : currentIdx);
  updateUndoBtn();
  showToast('↩ 已撤销');
}

function updateUndoBtn() {
  const btn = document.getElementById('undo-btn');
  if (!btn) return;
  btn.disabled = undoHistory.length === 0;
  btn.textContent = undoHistory.length > 0 ? `↩ 撤销 (${undoHistory.length})` : '↩ 撤销';
}

// ── Delay setting ──────────────────────────────────────────────
let fetchDelay = parseInt(localStorage.getItem('bib-fetch-delay') || '3');
function setFetchDelay(val) {
  fetchDelay = parseInt(val);
  localStorage.setItem('bib-fetch-delay', fetchDelay);
}

// ── Status line ────────────────────────────────────────────────
function setFetchStatus(cls, html) {
  const el = document.getElementById('fetch-status');
  el.className = 'status-line' + (cls ? ' ' + cls : '');
  el.innerHTML = html;
}

// ── Auto-fetch ─────────────────────────────────────────────────
function autoFetchBib() {
  if (currentIdx < 0) return;
  resetSteps();
  setStep(1, 'active');
  setFetchStatus('', '<span class="spinner"></span> 正在打开 Google Scholar…');
  const url = `https://scholar.google.com/scholar?q=${encodeURIComponent(entries[currentIdx].title)}&bib-checker=1&bib-delay=${fetchDelay}`;
  try {
    chrome.runtime.sendMessage({ type: 'bib-ext-open-scholar', url }, () => {
      if (chrome.runtime.lastError) {
        setFetchStatus('error', '❌ 扩展通信失败，请重新加载扩展页面');
        return;
      }
      setStep(1, 'done');
      setStep(2, 'active');
      setFetchStatus('', '<span class="spinner"></span> 等待扩展点击 Cite…');
    });
  } catch(e) {
    setFetchStatus('error', '❌ 无法连接扩展后台，请在扩展页面中使用');
  }
}

// ── Actions ────────────────────────────────────────────────────
function replaceEntry() {
  if (currentIdx < 0) return;
  let newBib = document.getElementById('new-bib').value.trim();
  if (!newBib) { showToast('没有新的 BibTeX 内容'); return; }
  const e = entries[currentIdx];
  if (document.getElementById('keep-key').checked) {
    newBib = newBib.replace(/^(@\w+\s*\{\s*)[\w:._\-]+/, `$1${e.key}`);
  }
  const ta = document.getElementById('bib-textarea');
  const text = ta.value;
  const re = new RegExp('@\\w+\\s*\\{\\s*' + escapeRe(e.key) + '\\s*,', 'i');
  const m = re.exec(text);
  if (!m) { showToast(`找不到 @${e.key}`); return; }
  pushHistory();
  let depth = 0, ii = m.index;
  for (; ii < text.length; ii++) {
    if (text[ii] === '{') depth++;
    else if (text[ii] === '}') { depth--; if (depth === 0) { ii++; break; } }
  }
  ta.value = text.slice(0, m.index) + newBib + text.slice(ii);
  reparsePreservingStatus();
  const newIdx = entries.findIndex(x => x.key === e.key);
  if (newIdx !== -1) { entries[newIdx].status = 'replaced'; currentIdx = newIdx; }
  renderEntryList();
  showToast('✅ 条目已替换');
  setTimeout(() => {
    const ni = findNextPending(newIdx !== -1 ? newIdx : currentIdx);
    selectEntry(ni !== -1 ? ni : currentIdx);
  }, 300);
}

function keepOriginal() {
  if (currentIdx < 0) return;
  pushHistory();
  entries[currentIdx].status = 'ok';
  renderEntryList();
  const next = findNextPending(currentIdx);
  selectEntry(next !== -1 ? next : currentIdx);
}

function findNextPending(from) {
  for (let i = from + 1; i < entries.length; i++) {
    if (entries[i].status === 'pending') return i;
  }
  for (let i = 0; i <= from; i++) {
    if (entries[i].status === 'pending') return i;
  }
  return -1;
}

function navigate(dir) {
  const next = currentIdx + dir;
  if (next >= 0 && next < entries.length) selectEntry(next);
}

function updateStats() {
  if (entries.length === 0) { document.getElementById('stats').innerHTML = ''; return; }
  const pending  = entries.filter(e => e.status === 'pending').length;
  const ok       = entries.filter(e => e.status === 'ok').length;
  const replaced = entries.filter(e => e.status === 'replaced').length;
  document.getElementById('stats').innerHTML =
    `<span class="stat-chip pending">⏳ ${pending}</span>` +
    `<span class="stat-chip ok">✅ ${ok}</span>` +
    `<span class="stat-chip replaced">🔄 ${replaced}</span>`;
}

function downloadBib() {
  const text = document.getElementById('bib-textarea').value;
  if (!text.trim()) { showToast('没有内容可下载'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  a.download = 'main.bib';
  a.click();
  showToast('正在下载 main.bib');
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── Extension messages ─────────────────────────────────────────
try { chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'scholar-progress') {
    for (let i = 1; i < msg.step; i++) setStep(i, 'done');
    setStep(msg.step, 'active');
    const labels = ['', '打开 Scholar', '点击 Cite', '点击 BibTeX', '获取内容', '替换条目'];
    setFetchStatus('', `<span class="spinner"></span> 正在执行：${labels[msg.step]}…`);
    return;
  }
  if (msg.type === 'bib-checker-bib') {
    const bib = msg.bib;
    if (!bib || currentIdx < 0) return;
    for (let i = 1; i <= 4; i++) setStep(i, 'done');
    setStep(5, 'active');
    setFetchStatus('', '<span class="spinner"></span> BibTeX 已获取，正在替换…');
    document.getElementById('new-bib').value = bib;
    setTimeout(() => {
      replaceEntry();
      setStep(5, 'done');
      const next = findNextPending(currentIdx);
      if (next !== -1) {
        setFetchStatus('ok', `✅ 已替换，${fetchDelay} 秒后获取下一条…`);
        setTimeout(() => autoFetchBib(), fetchDelay * 1000);
      } else {
        setFetchStatus('ok', '🎉 所有条目已处理完毕');
      }
    }, 400);
  }
}); } catch(e) { console.warn('chrome.runtime not available:', e); }

// ── Keyboard shortcuts ─────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); navigate(1); }
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); navigate(-1); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoState(); }
});

// ── Persist ────────────────────────────────────────────────────
let _saveTimer;
function saveBib() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    localStorage.setItem('bib-checker-content', document.getElementById('bib-textarea').value);
  }, 600);
}

// ── Event wiring & Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('parse-btn').addEventListener('click', parseAndRender);
  document.getElementById('download-btn').addEventListener('click', downloadBib);
  document.getElementById('undo-btn').addEventListener('click', undoState);
  document.getElementById('autofetch-btn').addEventListener('click', autoFetchBib);
  document.getElementById('replace-btn').addEventListener('click', replaceEntry);
  document.getElementById('keep-btn').addEventListener('click', keepOriginal);
  document.getElementById('prev-btn').addEventListener('click', () => navigate(-1));
  document.getElementById('next-btn').addEventListener('click', () => navigate(1));
  document.getElementById('delay-select').addEventListener('change', function() { setFetchDelay(this.value); });
  document.getElementById('bib-textarea').addEventListener('paste', () => setTimeout(parseAndRender, 30));
  document.getElementById('bib-textarea').addEventListener('input', saveBib);

  // Init
  document.getElementById('delay-select').value = fetchDelay;
  const _saved = localStorage.getItem('bib-checker-content');
  if (_saved) {
    document.getElementById('bib-textarea').value = _saved;
    parseAndRender();
  }
});
