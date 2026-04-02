window.onerror = (msg, src, line) => {
  console.error('Page error:', msg, 'line', line);
  const el = document.getElementById('toast');
  if (el) { el.textContent = `JS错误 L${line}: ${msg}`; el.classList.add('show'); }
};

// ── State ──────────────────────────────────────────────────────
let entries    = [];   // { key, type, raw, start, end, title, authors, year, venue,
                       //   fetchStatus: 'pending'|'fetching'|'done'|'error',
                       //   fetchResult: string|null,  fetchError: string|null,
                       //   hasDiff: bool,
                       //   reviewStatus: 'pending'|'replaced'|'kept' }
let currentIdx = -1;
let undoHistory = [];

// Batch fetch queue
let batchRunning  = false;
let batchQueue    = [];   // indices to fetch
let batchPos      = 0;

let fetchDelay = parseInt(localStorage.getItem('bib-fetch-delay') || '3');

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
      fetchStatus:  'pending',
      fetchResult:  null,
      fetchError:   null,
      hasDiff:      false,
      reviewStatus: 'pending',
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
function reparsePreservingState() {
  const saved = {};
  entries.forEach(e => {
    saved[e.key] = {
      fetchStatus: e.fetchStatus, fetchResult: e.fetchResult,
      fetchError: e.fetchError, hasDiff: e.hasDiff, reviewStatus: e.reviewStatus,
    };
  });
  entries = parseBib(document.getElementById('bib-textarea').value);
  entries.forEach(e => {
    if (saved[e.key]) Object.assign(e, saved[e.key]);
  });
}

function parseAndRender() {
  const text = document.getElementById('bib-textarea').value;
  if (!text.trim()) { showToast('请先粘贴 .bib 内容'); return; }
  entries = parseBib(text);
  if (entries.length === 0) { showToast('未找到条目，请检查 BibTeX 格式'); return; }
  undoHistory = [];
  updateUndoBtn();
  currentIdx = -1;
  renderEntryList();
  showReviewArea('no-sel');
  document.getElementById('fetch-bar').style.display = 'flex';
  updateBatchProgress();
  updateStats();
  showToast(`已解析 ${entries.length} 条参考文献`);
}

// ── Entry list ─────────────────────────────────────────────────
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
    div.dataset.idx = i;
    div.onclick = () => selectEntry(i);

    const statusEl = document.createElement('span');
    statusEl.className = 'entry-status';
    statusEl.innerHTML = entryStatusIcon(e);

    const keyEl = document.createElement('span');
    keyEl.className = 'entry-key';
    keyEl.title = e.key;
    keyEl.textContent = e.key;

    const ttlEl = document.createElement('span');
    ttlEl.className = 'entry-ttl';
    ttlEl.title = e.title;
    ttlEl.textContent = e.title;

    div.appendChild(statusEl);
    div.appendChild(keyEl);
    div.appendChild(ttlEl);
    wrap.appendChild(div);
  });
  updateStats();
}

function entryStatusIcon(e) {
  if (e.reviewStatus === 'replaced') return '✅';
  if (e.reviewStatus === 'kept')     return '👍';
  if (e.fetchStatus === 'fetching')  return '<span class="entry-spin"></span>';
  if (e.fetchStatus === 'error')     return '❌';
  if (e.fetchStatus === 'done') {
    return e.hasDiff ? '🔍' : '<span style="color:#10b981;font-weight:700">=</span>';
  }
  return '⏳';
}

function updateEntryRow(idx) {
  const row = document.querySelector(`.entry-row[data-idx="${idx}"]`);
  if (!row) return;
  const statusEl = row.querySelector('.entry-status');
  if (statusEl) statusEl.innerHTML = entryStatusIcon(entries[idx]);
  updateStats();
}

// ── Select / show entry ────────────────────────────────────────
function selectEntry(idx) {
  if (idx < 0 || idx >= entries.length) return;
  currentIdx = idx;
  const e = entries[idx];

  document.querySelectorAll('.entry-row').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
    if (i === idx) el.scrollIntoView({ block: 'nearest' });
  });

  highlightInBib(e);
  document.getElementById('key-display').textContent = e.key;

  if (e.fetchStatus === 'done') {
    renderDiff(idx);
    showReviewArea('diff');
  } else {
    renderEntryInfo(idx);
    showReviewArea('info');
  }
}

function showReviewArea(mode) {
  document.getElementById('no-sel-msg').style.display   = mode === 'no-sel' ? 'flex' : 'none';
  document.getElementById('entry-info').style.display   = mode === 'info'   ? 'flex' : 'none';
  document.getElementById('diff-panel').style.display   = mode === 'diff'   ? 'flex' : 'none';
}

function renderEntryInfo(idx) {
  const e = entries[idx];
  const authShort = e.authors.length > 90 ? e.authors.slice(0, 90) + '…' : e.authors;
  document.getElementById('einfo-card').innerHTML =
    `<div class="einfo-title">${escapeHtml(e.title)}</div>` +
    `<div class="einfo-meta">` +
    (e.authors ? `<b>作者：</b>${escapeHtml(authShort)}<br>` : '') +
    (e.year    ? `<b>年份：</b>${e.year}` : '') +
    (e.year && e.venue ? ' · ' : '') +
    (e.venue   ? `<b>来源：</b>${escapeHtml(e.venue.slice(0, 80))}` : '') +
    `<br><b>类型：</b>@${e.type} &nbsp; <b>Key：</b><code>${escapeHtml(e.key)}</code>` +
    `</div>`;

  const stateEl = document.getElementById('fetch-state-msg');
  if (e.fetchStatus === 'pending') {
    stateEl.className = 'fetch-state-msg';
    stateEl.innerHTML = '⏳ 等待批量获取…';
  } else if (e.fetchStatus === 'fetching') {
    stateEl.className = 'fetch-state-msg';
    stateEl.innerHTML = '<span class="inline-spin"></span> 正在从 Google Scholar 获取…';
  } else if (e.fetchStatus === 'error') {
    stateEl.className = 'fetch-state-msg error';
    stateEl.textContent = '❌ 获取失败：' + (e.fetchError || '未知错误');
  }
}

// ── Diff rendering ─────────────────────────────────────────────
const IMPORTANT_FIELDS = ['title','author','year','journal','booktitle','volume','number','pages','doi','url','publisher','address','edition','month','note','howpublished','school','institution','organization'];

function computeHasDiff(origRaw, scholarRaw) {
  const of = extractFields(origRaw);
  const sf = extractFields(scholarRaw);
  const allKeys = new Set([...Object.keys(of), ...Object.keys(sf)]);
  for (const k of allKeys) {
    if (k === 'key') continue;
    const ov = cleanStr(of[k] || '');
    const sv = cleanStr(sf[k] || '');
    if (ov !== sv) return true;
  }
  return false;
}

function renderDiff(idx) {
  const e = entries[idx];
  const scholarRaw = e.fetchResult || '';

  // Update topbar
  document.getElementById('diff-key-label').textContent = e.key;
  document.getElementById('diff-type-label').textContent = '@' + e.type;

  const of = extractFields(e.raw);
  const sf = extractFields(scholarRaw);

  // Build ordered field list: important ones first, then rest
  const ofKeys = Object.keys(of).filter(k => k !== 'key');
  const sfKeys = Object.keys(sf).filter(k => k !== 'key');
  const allKeys = [...new Set([...IMPORTANT_FIELDS.filter(k => ofKeys.includes(k) || sfKeys.includes(k)), ...ofKeys, ...sfKeys])];

  let changedCount = 0;
  const rows = allKeys.map(k => {
    const ov = of[k] !== undefined ? of[k] : null;
    const sv = sf[k] !== undefined ? sf[k] : null;
    const ovClean = cleanStr(ov || '');
    const svClean = cleanStr(sv || '');
    let rowClass;
    if (ov === null) {
      rowClass = 'row-added'; changedCount++;
    } else if (sv === null) {
      rowClass = 'row-missing';
    } else if (ovClean === svClean) {
      rowClass = 'row-same';
    } else {
      rowClass = 'row-changed'; changedCount++;
    }
    return { k, ov, sv, rowClass };
  });

  const indicator = document.getElementById('diff-change-indicator');
  if (changedCount > 0) {
    indicator.className = 'diff-change-indicator has-changes';
    indicator.textContent = `${changedCount} 处差异`;
  } else {
    indicator.className = 'diff-change-indicator no-changes';
    indicator.textContent = '内容相同';
  }

  // Render table
  const tbody = document.getElementById('diff-tbody');
  tbody.innerHTML = '';
  rows.forEach(({ k, ov, sv, rowClass }) => {
    const tr = document.createElement('tr');
    tr.className = rowClass;
    const missingTxt = '<span style="color:#cbd5e1;font-style:italic">—</span>';
    tr.innerHTML =
      `<td class="td-field">${escapeHtml(k)}</td>` +
      `<td class="td-old">${ov !== null ? escapeHtml(ov) : missingTxt}</td>` +
      `<td class="td-new">${sv !== null ? escapeHtml(sv) : missingTxt}</td>`;
    tbody.appendChild(tr);
  });

  // Update review status in action buttons
  const replaceBtn = document.getElementById('replace-btn');
  const keepBtn = document.getElementById('keep-btn');
  if (e.reviewStatus === 'replaced') {
    replaceBtn.textContent = '✅ 已替换';
    replaceBtn.disabled = true;
    keepBtn.disabled = false;
  } else if (e.reviewStatus === 'kept') {
    keepBtn.textContent = '👍 已保留';
    keepBtn.disabled = true;
    replaceBtn.disabled = false;
  } else {
    replaceBtn.textContent = '✅ 替换';
    replaceBtn.disabled = false;
    keepBtn.textContent = '👍 保持原样';
    keepBtn.disabled = false;
  }

  // Diff navigation counter
  updateDiffNavCounter();
}

function updateDiffNavCounter() {
  const diffEntries = entries.filter(e => e.fetchStatus === 'done');
  const total = diffEntries.length;
  const pos = diffEntries.findIndex(e => e === entries[currentIdx]);
  document.getElementById('diff-nav-cnt').textContent = total > 0 ? `${pos + 1} / ${total}` : '';

  const hasDiffEntries = entries.filter(e => e.fetchStatus === 'done' && e.hasDiff && e.reviewStatus === 'pending');
  document.getElementById('diff-prev-btn').disabled = false;
  document.getElementById('diff-next-btn').disabled = hasDiffEntries.length === 0;
}

// ── Batch fetch ────────────────────────────────────────────────
function startBatchFetch() {
  if (batchRunning) return;
  batchQueue = entries.map((e, i) => i).filter(i => entries[i].fetchStatus === 'pending');
  if (batchQueue.length === 0) { showToast('没有待获取的条目'); return; }
  batchPos = 0;
  batchRunning = true;
  document.getElementById('batch-start-btn').style.display = 'none';
  document.getElementById('batch-stop-btn').style.display = '';
  document.getElementById('batch-steps').style.display = 'flex';
  setBatchSteps(0);
  fetchNext();
}

function stopBatchFetch() {
  batchRunning = false;
  document.getElementById('batch-start-btn').style.display = '';
  document.getElementById('batch-stop-btn').style.display = 'none';
  document.getElementById('batch-steps').style.display = 'none';
  setBatchSteps(0);
  // Reset any "fetching" entry back to pending
  entries.forEach(e => { if (e.fetchStatus === 'fetching') e.fetchStatus = 'pending'; });
  renderEntryList();
  updateBatchProgress();
}

function fetchNext() {
  if (!batchRunning) return;
  if (batchPos >= batchQueue.length) {
    // Done
    batchRunning = false;
    document.getElementById('batch-start-btn').style.display = '';
    document.getElementById('batch-stop-btn').style.display = 'none';
    document.getElementById('batch-steps').style.display = 'none';
    setBatchSteps(0);
    updateBatchProgress();
    const remaining = entries.filter(e => e.fetchStatus === 'pending').length;
    showToast(remaining === 0 ? '🎉 所有条目获取完毕！' : `批量获取完成，${remaining} 条跳过/失败`);
    return;
  }
  const idx = batchQueue[batchPos];
  const e = entries[idx];
  if (e.fetchStatus !== 'pending') {
    batchPos++;
    fetchNext();
    return;
  }
  e.fetchStatus = 'fetching';
  updateEntryRow(idx);
  // Auto-select current fetching entry if nothing is showing
  if (currentIdx === -1 || entries[currentIdx].fetchStatus !== 'fetching') {
    // Don't auto-switch if user is reviewing a diff panel
    if (currentIdx === -1 || entries[currentIdx].fetchStatus === 'pending') {
      selectEntry(idx);
    }
  }
  updateBatchProgress();
  setBatchSteps(1);

  const url = `https://scholar.google.com/scholar?q=${encodeURIComponent(e.title)}&bib-checker=1&bib-delay=${fetchDelay}`;
  try {
    chrome.runtime.sendMessage({ type: 'bib-ext-open-scholar', url }, () => {
      if (chrome.runtime.lastError) {
        markFetchError(idx, '扩展通信失败');
        return;
      }
      setBatchSteps(2);
    });
  } catch (err) {
    markFetchError(idx, '无法连接扩展后台');
  }
}

function markFetchError(idx, msg) {
  const e = entries[idx];
  e.fetchStatus = 'error';
  e.fetchError = msg;
  updateEntryRow(idx);
  updateBatchProgress();
  if (currentIdx === idx) renderEntryInfo(idx);
  batchPos++;
  if (batchRunning) setTimeout(fetchNext, 500);
}

function storeFetchResult(bib) {
  if (!batchRunning && batchQueue.length === 0) return;
  const idx = batchQueue[batchPos];
  if (idx === undefined) return;
  const e = entries[idx];

  e.fetchResult = bib;
  e.fetchStatus = 'done';
  e.hasDiff = computeHasDiff(e.raw, bib);
  updateEntryRow(idx);
  updateBatchProgress();

  // If this entry is currently viewed, switch to diff panel
  if (currentIdx === idx) {
    renderDiff(idx);
    showReviewArea('diff');
  }

  batchPos++;
  if (batchRunning) {
    setTimeout(fetchNext, fetchDelay * 1000);
  }
}

function setBatchSteps(active) {
  // active = 0 (none), 1 (scholar), 2 (cite), 3 (bibtex), 4 (fetch)
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById('bs' + i);
    if (!dot) continue;
    if (i < active) dot.className = 'bs-dot done';
    else if (i === active) dot.className = 'bs-dot active';
    else dot.className = 'bs-dot';
  }
}

function updateBatchProgress() {
  const done    = entries.filter(e => e.fetchStatus === 'done').length;
  const error   = entries.filter(e => e.fetchStatus === 'error').length;
  const fetching = entries.filter(e => e.fetchStatus === 'fetching').length;
  const total   = entries.length;
  const el = document.getElementById('batch-progress');
  if (!el) return;
  if (total === 0) { el.textContent = ''; return; }
  let txt = `${done} / ${total} 已获取`;
  if (error > 0) txt += `，${error} 失败`;
  if (fetching > 0) txt += `，正在获取…`;
  el.textContent = txt;
}

// ── Message from Scholar content script ───────────────────────
try { chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'scholar-progress') {
    setBatchSteps(msg.step);
    return;
  }
  if (msg.type === 'bib-checker-bib') {
    if (!msg.bib) return;
    setBatchSteps(4);
    setTimeout(() => storeFetchResult(msg.bib), 100);
  }
}); } catch (e) { console.warn('chrome.runtime not available:', e); }

// ── Actions: replace / keep ────────────────────────────────────
function replaceEntry() {
  if (currentIdx < 0) return;
  const e = entries[currentIdx];
  if (!e.fetchResult) { showToast('没有获取到 Scholar 结果'); return; }

  let newBib = e.fetchResult.trim();
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
  saveBib();

  // Reparse and restore state
  reparsePreservingState();
  const newIdx = entries.findIndex(x => x.key === e.key);
  if (newIdx !== -1) {
    entries[newIdx].reviewStatus = 'replaced';
    currentIdx = newIdx;
  }
  renderEntryList();
  if (currentIdx >= 0 && entries[currentIdx].fetchStatus === 'done') {
    renderDiff(currentIdx);
  }
  showToast('✅ 条目已替换');
}

function keepEntry() {
  if (currentIdx < 0) return;
  pushHistory();
  entries[currentIdx].reviewStatus = 'kept';
  updateEntryRow(currentIdx);
  renderDiff(currentIdx);  // refresh button states
  showToast('👍 已标记为保留原样');
}

// ── Diff navigation ────────────────────────────────────────────
function goNextDiff() {
  const candidates = [];
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].fetchStatus === 'done') candidates.push(i);
  }
  if (candidates.length === 0) return;
  // Find next after currentIdx (or wrap)
  const after = candidates.filter(i => i > currentIdx);
  const target = after.length > 0 ? after[0] : candidates[0];
  selectEntry(target);
}

function goPrevDiff() {
  const candidates = [];
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].fetchStatus === 'done') candidates.push(i);
  }
  if (candidates.length === 0) return;
  const before = candidates.filter(i => i < currentIdx);
  const target = before.length > 0 ? before[before.length - 1] : candidates[candidates.length - 1];
  selectEntry(target);
}

// ── Highlight in BibTeX editor ─────────────────────────────────
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
    state: entries.map(e => ({
      key: e.key,
      fetchStatus: e.fetchStatus, fetchResult: e.fetchResult,
      fetchError: e.fetchError, hasDiff: e.hasDiff, reviewStatus: e.reviewStatus,
    })),
    idx: currentIdx,
  });
  if (undoHistory.length > 30) undoHistory.shift();
  updateUndoBtn();
}

function undoState() {
  if (!undoHistory.length) { showToast('没有可撤销的操作'); return; }
  const s = undoHistory.pop();
  document.getElementById('bib-textarea').value = s.text;
  reparsePreservingState();
  s.state.forEach(saved => {
    const e = entries.find(x => x.key === saved.key);
    if (e) Object.assign(e, {
      fetchStatus: saved.fetchStatus, fetchResult: saved.fetchResult,
      fetchError: saved.fetchError, hasDiff: saved.hasDiff, reviewStatus: saved.reviewStatus,
    });
  });
  renderEntryList();
  const restoreIdx = s.idx >= 0 && s.idx < entries.length ? s.idx : -1;
  if (restoreIdx >= 0) selectEntry(restoreIdx);
  else showReviewArea('no-sel');
  updateUndoBtn();
  showToast('↩ 已撤销');
}

function updateUndoBtn() {
  const btn = document.getElementById('undo-btn');
  if (!btn) return;
  btn.disabled = undoHistory.length === 0;
  btn.textContent = undoHistory.length > 0 ? `↩ 撤销 (${undoHistory.length})` : '↩ 撤销';
}

// ── Stats ──────────────────────────────────────────────────────
function updateStats() {
  if (entries.length === 0) { document.getElementById('stats').innerHTML = ''; return; }
  const pending = entries.filter(e => e.fetchStatus === 'pending').length;
  const diff    = entries.filter(e => e.fetchStatus === 'done' && e.hasDiff).length;
  const done    = entries.filter(e => e.reviewStatus === 'replaced' || e.reviewStatus === 'kept' || (e.fetchStatus === 'done' && !e.hasDiff)).length;
  document.getElementById('stats').innerHTML =
    `<span class="stat-chip s-pending">⏳ ${pending}</span>` +
    `<span class="stat-chip s-diff">🔍 ${diff}</span>` +
    `<span class="stat-chip s-done">✅ ${done}</span>`;
}

// ── Download ───────────────────────────────────────────────────
function downloadBib() {
  const text = document.getElementById('bib-textarea').value;
  if (!text.trim()) { showToast('没有内容可下载'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  a.download = 'main.bib';
  a.click();
  showToast('正在下载 main.bib');
}

// ── Utils ──────────────────────────────────────────────────────
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── Persist ────────────────────────────────────────────────────
let _saveTimer;
function saveBib() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    localStorage.setItem('bib-checker-content', document.getElementById('bib-textarea').value);
  }, 600);
}

function setFetchDelay(val) {
  fetchDelay = parseInt(val);
  localStorage.setItem('bib-fetch-delay', fetchDelay);
}

// ── Keyboard shortcuts ─────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goNextDiff(); }
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); goPrevDiff(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoState(); }
  if (e.key === 'r' && !e.ctrlKey && !e.metaKey) replaceEntry();
  if (e.key === 'k' && !e.ctrlKey && !e.metaKey) keepEntry();
});

// ── Event wiring & Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('parse-btn').addEventListener('click', parseAndRender);
  document.getElementById('download-btn').addEventListener('click', downloadBib);
  document.getElementById('undo-btn').addEventListener('click', undoState);
  document.getElementById('batch-start-btn').addEventListener('click', startBatchFetch);
  document.getElementById('batch-stop-btn').addEventListener('click', stopBatchFetch);
  document.getElementById('replace-btn').addEventListener('click', replaceEntry);
  document.getElementById('keep-btn').addEventListener('click', keepEntry);
  document.getElementById('diff-prev-btn').addEventListener('click', goPrevDiff);
  document.getElementById('diff-next-btn').addEventListener('click', goNextDiff);
  document.getElementById('delay-select').addEventListener('change', function() { setFetchDelay(this.value); });
  document.getElementById('bib-textarea').addEventListener('paste', () => setTimeout(parseAndRender, 30));
  document.getElementById('bib-textarea').addEventListener('input', saveBib);

  // Init
  document.getElementById('delay-select').value = fetchDelay;
  const saved = localStorage.getItem('bib-checker-content');
  if (saved) {
    document.getElementById('bib-textarea').value = saved;
    parseAndRender();
  }
});
