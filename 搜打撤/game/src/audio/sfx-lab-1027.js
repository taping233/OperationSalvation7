// 新音效 A/B 试听页：现行映射 vs 原创候选（original-full-1027）。
// 勾选保存在 localStorage「sdt-sfx-lab-1027」，不改游戏设置与运行映射。
import { SAMPLE_CUES } from './sound.samples.catalog.js';
import { CUE_LABELS, GROUP_LABELS } from './sfx-review.labels.js';
import { CANDIDATES } from './sfx-lab-1027.candidates.js';

const STORE_KEY = 'sdt-sfx-lab-1027';
const list = document.getElementById('list');
const search = /** @type {HTMLInputElement} */ (document.getElementById('search'));
const volume = /** @type {HTMLInputElement} */ (document.getElementById('volume'));
const volumeValue = document.getElementById('volume-value');
const onlyMarked = /** @type {HTMLInputElement} */ (document.getElementById('only-marked'));
const playing = document.getElementById('playing');
const selectedCount = document.getElementById('selected-count');
const totals = document.getElementById('totals');
const exportBtn = document.getElementById('export');
const dialog = /** @type {HTMLDialogElement} */ (document.getElementById('export-dialog'));
const exportText = /** @type {HTMLTextAreaElement} */ (document.getElementById('export-text'));
const copyStatus = document.getElementById('copy-status');

let adopted = new Set();
try {
  adopted = new Set(JSON.parse(localStorage.getItem(STORE_KEY) || '[]'));
} catch { adopted = new Set(); }

const events = Object.keys(SAMPLE_CUES).map((name) => ({
  name,
  label: CUE_LABELS[name] || name,
  cue: SAMPLE_CUES[name],
  candidate: CANDIDATES[name] || null,
}));
const groups = ['ui', 'reward', 'combat', 'transition'];

let audio = null;
function stopAll() {
  if (audio) { audio.pause(); audio = null; }
  playing.textContent = '已停止。';
}
document.getElementById('stop').addEventListener('click', stopAll);

function play(file, cue, tag, label) {
  stopAll();
  audio = new Audio('./' + file);
  const gain = Math.min(1, (cue.gain ?? 1) * (Number(volume.value) / 100) * 1.4);
  audio.volume = Math.max(0, gain);
  if (cue.rate) audio.playbackRate = cue.rate;
  playing.textContent = `正在播放 ${tag}：${label}`;
  audio.play().catch(() => { playing.textContent = `播放失败：${file}`; });
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify([...adopted]));
  const n = adopted.size;
  selectedCount.textContent = n ? `已采用 ${n} 项新音效` : '尚未采用';
}

function row(ev) {
  const { name, label, cue, candidate } = ev;
  const silent = !cue.files.length || candidate?.silent;
  const el = document.createElement('article');
  el.className = 'sound-row';
  el.dataset.search = `${name} ${label}`.toLowerCase();
  el.dataset.name = name;

  const head = document.createElement('div');
  head.className = 'sound-head';
  head.innerHTML = `<strong>${label}</strong><code>${name}</code>${silent ? '<em class="muted-tag">已取消音效</em>' : ''}`;
  el.appendChild(head);

  const actions = document.createElement('div');
  actions.className = 'sound-actions';

  const cur = document.createElement('button');
  cur.textContent = '现行';
  cur.className = 'plain';
  if (silent || !cue.files.length) {
    cur.disabled = true;
  } else {
    cur.title = cue.files.join(', ');
    cur.addEventListener('click', () => play(cue.files[0], cue, '现行', label));
  }
  actions.appendChild(cur);

  if (!silent && candidate?.file) {
    const next = document.createElement('button');
    next.textContent = '新候选';
    next.className = 'cand';
    next.title = candidate.file;
    next.addEventListener('click', () => play(candidate.file, cue, '新候选', label));
    actions.appendChild(next);

    const chk = document.createElement('label');
    chk.className = 'adopt';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = adopted.has(name);
    box.addEventListener('change', () => {
      box.checked ? adopted.add(name) : adopted.delete(name);
      save();
    });
    chk.appendChild(box);
    chk.appendChild(document.createTextNode('采用新音效'));
    actions.appendChild(chk);
  }
  el.appendChild(actions);
  return el;
}

// Candidate rows and their listeners are stable; filtering only selects existing nodes.
const groupViews = groups.map(group => {
  const heading = document.createElement('h2');
  heading.className = 'group-title';
  return { group, heading, rows:events.filter(event => event.cue.group === group).map(row) };
});
const empty = document.createElement('p');
empty.textContent = '没有符合筛选的场景。';
function render() {
  const q = search.value.trim().toLowerCase();
  const content = document.createDocumentFragment();
  for (const { group, heading, rows } of groupViews) {
    const visible = rows.filter(element => (!q || element.dataset.search.includes(q))
      && (!onlyMarked.checked || adopted.has(element.dataset.name)));
    if (!visible.length) continue;
    heading.textContent = `${GROUP_LABELS[group] || group}（${visible.length}）`;
    content.append(heading, ...visible);
  }
  if (!content.childNodes.length) content.append(empty);
  list.replaceChildren(content);
}

volume.addEventListener('input', () => { volumeValue.textContent = volume.value + '%'; });
search.addEventListener('input', render);
onlyMarked.addEventListener('change', render);

exportBtn.addEventListener('click', () => {
  const lines = events.filter((ev) => adopted.has(ev.name))
    .map((ev) => `${ev.label}（${ev.name}）→ ${ev.candidate.file}`);
  exportText.value = lines.length
    ? `采用新音效 ${lines.length} 项：\n` + lines.join('\n')
    : '尚未采用任何新音效。';
  copyStatus.textContent = '';
  dialog.showModal();
});
document.getElementById('dialog-close').addEventListener('click', () => dialog.close());
document.getElementById('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(exportText.value);
    copyStatus.textContent = '已复制。';
  } catch {
    exportText.select();
    copyStatus.textContent = '复制失败，请手动全选复制。';
  }
});

const audible = events.filter((ev) => ev.candidate?.file).length;
const silentCount = events.filter((ev) => ev.candidate?.silent || !ev.cue.files.length).length;
totals.innerHTML = `<strong>${events.length}</strong> 个触发场景<br>${audible} 个新候选 · ${silentCount} 项已取消音效`;
save();
render();
