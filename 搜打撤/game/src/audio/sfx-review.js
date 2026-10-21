import { SAMPLE_CUES } from './sound.samples.catalog.js';
import { CUE_LABELS, GROUP_LABELS } from './sfx-review.labels.js';
import { SOURCE_INFO } from './sfx-review.sources.js';
import { assetUrl } from '../core/asset-url.js';

/** @typedef {{'playing': HTMLElement, 'selected-count': HTMLElement, 'export': HTMLButtonElement, 'search': HTMLInputElement, 'only-marked': HTMLInputElement, 'categories': HTMLElement, 'by-sound': HTMLElement, 'by-cue': HTMLElement, 'list-title': HTMLElement, 'list-count': HTMLElement, 'view-note': HTMLElement, 'list': HTMLElement, 'volume': HTMLInputElement, 'volume-value': HTMLElement, 'stop': HTMLElement, 'export-text': HTMLTextAreaElement, 'copy-status': HTMLElement, 'export-dialog': HTMLDialogElement, 'dialog-close': HTMLElement, 'copy': HTMLElement, 'totals': HTMLElement}} PageElements */
/** @template {keyof PageElements} K @param {K} id @returns {PageElements[K]} */
const $ = id => /** @type {PageElements[K]} */ (document.getElementById(id)), storageKey = 'sdt-sfx-review-v1';
const label = id => CUE_LABELS[id] || id, pad = (n, width = 2) => String(n).padStart(width, '0');
const cues = Object.entries(SAMPLE_CUES).map(([id, cue], i) => ({ ...cue, id, number:`E${pad(i + 1, 3)}` }));
const grouped = new Map();
for (const cue of cues) {
  const key = JSON.stringify(cue.files);
  if (!grouped.has(key)) grouped.set(key, {number:`S${pad(grouped.size + 1)}`, cues:[], files:cue.files});
  grouped.get(key).cues.push(cue);
}
const sounds = [...grouped.values()], fileCount = new Set(cues.flatMap(cue => cue.files)).size;
let marks = {}, mode = 'sound', category = 'all', ctx, bus, voice, generation = 0;
const buffers = new Map();
try { const saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); if (saved && typeof saved === 'object' && !Array.isArray(saved)) marks = saved; } catch { /* 浏览器不允许存储时仍可试听和复制。 */ }
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(marks)); } catch { $('playing').textContent = '浏览器未允许保存标记，请在离开前复制清单。'; }
  updateSummary();
}
function selected() { return cues.filter(cue => marks[cue.id]?.replace === true); }
function updateSummary() {
  const count = selected().length;
  $('selected-count').textContent = count ? `已标记 ${count} 个触发场景要更换` : '尚未标记要更换的音效';
  $('export').disabled = !count;
}
function sourceInfo(file) { return file ? SOURCE_INFO[file] || {provider:'当前配置音源', title:file.split('/').at(-1)} : {provider:'不播放', title:'已取消音效'}; }
function entries() { return mode === 'sound' ? sounds : cues.map(cue => ({number:cue.number, cues:[cue], files:cue.files})); }
function visibleEntries() {
  const query = $('search').value.trim().toLowerCase();
  return entries().filter(entry => (category === 'all' || entry.cues.some(cue => cue.group === category))
    && (!$('only-marked').checked || entry.cues.some(cue => marks[cue.id]?.replace))
    && (!query || `${entry.number} ${entry.cues.map(cue => `${label(cue.id)} ${cue.id} ${GROUP_LABELS[cue.group]}`).join(' ')} ${entry.files.map(file => `${file} ${sourceInfo(file).title}`).join(' ')}`.toLowerCase().includes(query)));
}
function renderCategories() {
  $('categories').replaceChildren();
  for (const [id, title] of [['all','全部'], ...Object.entries(GROUP_LABELS)]) {
    const button = element('button', title);
    button.setAttribute('aria-pressed', String(category === id));
    button.onclick = () => { category = id; renderCategories(); render(); };
    $('categories').append(button);
  }
}
function makeCard(entry) {
  const silent = entry.files.length === 0;
  const card = element('article', null, 'sound-card');
  card.dataset.cues = entry.cues.map(cue => cue.id).join(' ');
  const top = element('div', null, 'card-top'), title = element('div', null, 'card-title');
  title.append(element('span', entry.number, 'number'), element('h3', label(entry.cues[0].id)));
  const mark = element('label', null, 'mark'), check = element('input');
  check.type = 'checkbox'; check.setAttribute('aria-label', `${entry.number} ${label(entry.cues[0].id)}要更换`);
  const markedCount = entry.cues.filter(cue => marks[cue.id]?.replace).length;
  check.checked = markedCount === entry.cues.length; check.indeterminate = markedCount > 0 && !check.checked;
  card.classList.toggle('is-marked', markedCount > 0); mark.append(check, '要更换'); top.append(title, mark);
  const meta = element('div', null, 'meta');
  meta.append(element('span', sourceInfo(entry.files[0]).provider), element('span', silent ? '已取消音效' : `${entry.files.length} 个版本`), element('span', mode === 'sound' ? `${entry.cues.length} 个场景共用` : entry.cues[0].id));
  const names = entry.cues.map(cue => label(cue.id));
  const summary = element('p', names.slice(0, 4).join(' / ') + (names.length > 4 ? ` 等 ${names.length} 项` : ''), 'cue-list');
  const controls = element('div', null, 'card-controls'), play = element('button', '▶ 试听', 'play-button');
  play.disabled = silent; if (silent) play.textContent = '已取消音效';
  const cueSelect = element('select', null, 'cue-select'); cueSelect.setAttribute('aria-label', `${entry.number}试听场景`);
  cueSelect.disabled = silent;
  for (const cue of entry.cues) { const option = element('option', `${label(cue.id)} · ${cue.gain}倍`); option.value = cue.id; cueSelect.append(option); }
  const variant = element('select', null, 'variant-select'); variant.setAttribute('aria-label', `${entry.number}音源版本`);
  entry.files.forEach((file, index) => { const option = element('option', `版本 ${index + 1}`); option.value = index; variant.append(option); });
  variant.hidden = entry.files.length < 2;
  play.onclick = () => playCue(entry.cues.find(cue => cue.id === cueSelect.value), Number(variant.value), entry.number, card);
  controls.append(play, cueSelect, variant);
  const note = element('textarea', null, 'note'); note.rows = 2; note.placeholder = '哪里不好听？希望换成什么感觉？';
  note.setAttribute('aria-label', `${entry.number}更换备注`); note.hidden = markedCount === 0;
  note.value = entry.cues.map(cue => marks[cue.id]?.note).find(Boolean) || '';
  check.onchange = () => {
    for (const cue of entry.cues) marks[cue.id] = {...marks[cue.id], replace:check.checked, note:note.value};
    check.indeterminate = false; card.classList.toggle('is-marked', check.checked); note.hidden = !check.checked; save();
    if ($('only-marked').checked) render();
  };
  note.oninput = () => { for (const cue of entry.cues) if (marks[cue.id]?.replace) marks[cue.id].note = note.value; save(); };
  const detail = element('details', null, 'card-detail'); detail.append(element('summary', '查看全部场景与来源'));
  const list = element('ul');
  for (const cue of entry.cues) list.append(element('li', `${cue.number} · ${label(cue.id)} · ${cue.id}${cue.maxDuration ? ` · 截断 ${cue.maxDuration}秒` : ''}`));
  detail.append(list);
  for (const file of entry.files) {
    const info = sourceInfo(file), row = element('p', null, 'source-entry');
    row.append(element('span', info.title), element('br'), element('code', file));
    if (info.page) { const link = element('a', ' 来源'); link.href = info.page; link.target = '_blank'; link.rel = 'noopener'; row.append(link); }
    detail.append(row);
  }
  card.append(top, meta, summary, controls, note, detail);
  return card;
}
function render() {
  const list = visibleEntries();
  $('by-sound').setAttribute('aria-pressed', String(mode === 'sound')); $('by-cue').setAttribute('aria-pressed', String(mode === 'cue'));
  $('list-title').textContent = category === 'all' ? '当前使用的声音' : GROUP_LABELS[category];
  $('list-count').textContent = `${list.length} ${mode === 'sound' ? '组声音' : '个触发场景'}`;
  $('view-note').textContent = mode === 'sound' ? '同一音源合并展示；下拉选择场景可听到对应音量。勾选整组会标记全部关联场景。' : '按当前音效映射逐项展示；同一声音可能在多个场景复用，可分别标记。';
  $('list').replaceChildren(...(list.length ? list.map(makeCard) : [element('p', '没有符合筛选条件的音效。', 'empty')]));
  updateSummary();
}
function stopPlayback() {
  generation++;
  if (voice) { voice.source.onended = null; try { voice.source.stop(); } catch { /* 已自然结束。 */ } voice.nodes.forEach(node => node.disconnect()); voice = null; }
  document.querySelectorAll('.is-playing').forEach(card => card.classList.remove('is-playing'));
}
async function ensureAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    bus = ctx.createGain(); const shelf = ctx.createBiquadFilter(), compressor = ctx.createDynamicsCompressor();
    shelf.type = 'highshelf'; shelf.frequency.value = 4500; shelf.gain.value = -4;
    compressor.threshold.value = -6; compressor.knee.value = 8; compressor.ratio.value = 12; compressor.attack.value = .003; compressor.release.value = .18;
    bus.connect(shelf); shelf.connect(compressor); compressor.connect(ctx.destination);
  }
  await ctx.resume(); updateVolume();
}
function updateVolume() {
  const value = Number($('volume').value); $('volume-value').textContent = `${value}%`;
  if (bus) bus.gain.value = value <= 0 ? 0 : 1.5 * Math.pow(10, ((value / 100 - 1) * 30) / 20);
}
async function playCue(cue, variant, number, card) {
  if (!cue.files.length) { stopPlayback(); $('playing').textContent = `${label(cue.id)}已取消音效。`; return; }
  stopPlayback(); const token = generation, file = cue.files[variant];
  $('playing').textContent = `正在准备 ${number} · ${label(cue.id)}…`;
  try {
    await ensureAudio();
    if (!buffers.has(file)) buffers.set(file, fetch(assetUrl(file)).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.arrayBuffer();
    }).then(data => ctx.decodeAudioData(data)).catch(error => { buffers.delete(file); throw error; }));
    const buffer = await buffers.get(file); if (token !== generation) return;
    const source = ctx.createBufferSource(), gain = ctx.createGain(), nodes = [source, gain];
    source.buffer = buffer; source.playbackRate.value = cue.rate || 1; gain.gain.value = cue.gain;
    if (cue.lowpass) { const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = cue.lowpass; source.connect(filter); filter.connect(gain); nodes.push(filter); } else source.connect(gain);
    gain.connect(bus); const current = {source, nodes}; voice = current; card.classList.add('is-playing');
    source.onended = () => { nodes.forEach(node => node.disconnect()); if (voice === current) { voice = null; card.classList.remove('is-playing'); $('playing').textContent = `已播完 ${number} · ${label(cue.id)}`; } };
    const duration = Math.min(cue.maxDuration || buffer.duration, buffer.duration);
    if (cue.maxDuration) { gain.gain.setValueAtTime(cue.gain, ctx.currentTime); gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration / source.playbackRate.value); }
    source.start(0, 0, duration);
    $('playing').textContent = `正在试听 ${number} · ${label(cue.id)} · 版本 ${variant + 1} · ${(duration / source.playbackRate.value).toFixed(2)}秒`;
  } catch { if (token === generation) $('playing').textContent = `无法播放 ${number}：${file}。可先标记，稍后一起处理。`; }
}
function exportText() {
  const lines = ['代号柒当前音效更换清单', `共 ${selected().length} 个触发场景`, ''];
  for (const cue of selected()) {
    const sound = grouped.get(JSON.stringify(cue.files));
    lines.push(`${cue.number} / ${sound.number} ${label(cue.id)} (${cue.id})`, `  当前音源：${cue.files.length ? cue.files.join('、') : '无（已取消音效）'}`, `  意见：${marks[cue.id]?.note?.trim() || '需要更换'}`, '');
  }
  return lines.join('\n');
}
$('by-sound').onclick = () => { mode = 'sound'; render(); }; $('by-cue').onclick = () => { mode = 'cue'; render(); };
$('search').oninput = render; $('only-marked').onchange = render; $('volume').oninput = updateVolume;
$('stop').onclick = () => { stopPlayback(); $('playing').textContent = '已停止播放。'; };
$('export').onclick = () => { $('export-text').value = exportText(); $('copy-status').textContent = ''; $('export-dialog').showModal(); };
$('dialog-close').onclick = () => $('export-dialog').close();
$('copy').onclick = async () => { try { await navigator.clipboard.writeText($('export-text').value); $('copy-status').textContent = '已复制，可以直接发给 Friday。'; } catch { $('export-text').focus(); $('export-text').select(); $('copy-status').textContent = '请按 Ctrl+C 复制已选中的清单。'; } };
window.addEventListener('pagehide', () => { stopPlayback(); ctx?.close().catch(() => {}); });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlayback(); });
$('totals').textContent = `${cues.length} 个触发场景 / ${sounds.length} 组配置 / ${fileCount} 个音源文件 / ${cues.filter(cue => !cue.files.length).length} 项静音`;
renderCategories(); render();
