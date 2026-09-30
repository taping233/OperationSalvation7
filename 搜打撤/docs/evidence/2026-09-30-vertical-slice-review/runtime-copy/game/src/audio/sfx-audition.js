const $ = id => document.getElementById(id);
const audio = $('audio');
const favorites = new Set(['click', 'card', 'hit', 'eventEnter', 'bossReveal']);
let cues = [], groups = {}, category = 'featured', active = null, generation = 0, sequence = false;
const versions = new Map();
audio.volume = .7;
const time = seconds => `${Math.floor((seconds || 0) / 60)}:${Math.floor((seconds || 0) % 60).toString().padStart(2, '0')}`;

function filtered() {
  const query = $('search').value.trim().toLowerCase();
  return cues.filter(cue => (category === 'all' || category === 'featured' && favorites.has(cue.id) || cue.group === category)
    && `${cue.label} ${cue.id} ${groups[cue.group]}`.toLowerCase().includes(query));
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function renderCategories() {
  $('categories').replaceChildren();
  for (const [id, label] of [['featured', '已认可的五个'], ['all', '全部音效'], ...Object.entries(groups)]) {
    const count = id === 'featured' ? 5 : id === 'all' ? cues.length : cues.filter(cue => cue.group === id).length;
    const button = element('button', null, `category${category === id ? ' active' : ''}`);
    button.append(element('strong', label), element('span', count));
    button.setAttribute('aria-pressed', String(category === id));
    button.addEventListener('click', () => { category = id; renderCategories(); renderGrid(); });
    $('categories').append(button);
  }
}

function renderGrid() {
  const list = filtered();
  $('section-title').textContent = category === 'featured' ? '先听这五个，再按场景挑' : category === 'all' ? '全部音效' : groups[category];
  $('count').textContent = `${list.length} 种声音`;
  $('grid').replaceChildren();
  if (!list.length) { $('grid').append(element('p', '没找到这个声音，换个关键词试试。', 'empty')); return; }
  for (const cue of list) {
    const index = versions.get(cue.id) || 0;
    const card = element('article', null, `sound-card${active?.id === cue.id ? ' active' : ''}`);
    card.dataset.cue = cue.id;
    const heading = element('div', null, 'card-heading');
    heading.append(element('h3', cue.label));
    if (favorites.has(cue.id)) heading.append(element('span', '已认可', 'approved'));
    const meta = element('div', null, 'card-meta');
    meta.append(element('span', groups[cue.group]), element('span', `${cue.variants[index].seconds.toFixed(2)} 秒`));
    if (cue.loop) meta.append(element('span', '可循环'));
    const actions = element('div', null, 'card-actions');
    const play = element('button', '▶ 试听', 'card-play');
    play.setAttribute('aria-label', `试听${cue.label}`);
    play.addEventListener('click', () => { setSequence(false); playCue(cue); });
    const select = element('select', null, 'version-select');
    select.setAttribute('aria-label', `${cue.label}的版本`);
    cue.variants.forEach((_, i) => { const option = element('option', `版本 ${i + 1}`); option.value = String(i); select.append(option); });
    select.value = String(index); select.disabled = cue.variants.length === 1;
    select.addEventListener('change', () => { versions.set(cue.id, Number(select.value)); playCue(cue); });
    actions.append(play, select); card.append(heading, meta, actions); $('grid').append(card);
  }
}

function updatePlayer() {
  const playing = !!active && !audio.paused && !audio.ended;
  $('toggle').textContent = playing ? '暂停' : '播放';
  $('signal').classList.toggle('running', playing);
  $('elapsed').textContent = time(audio.currentTime);
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  $('duration').textContent = time(duration);
  $('progress').disabled = !duration;
  $('progress').value = String(duration ? Math.round(audio.currentTime / duration * 1000) : 0);
  $('variant').disabled = !active || active.variants.length < 2;
}

function setSequence(value) {
  sequence = value;
  $('sequence').setAttribute('aria-pressed', String(value));
  $('sequence').textContent = value ? '停止连续试听' : '连续试听';
  if (value) { $('loop').checked = false; audio.loop = false; }
}

async function playCue(cue) {
  const token = ++generation;
  audio.pause(); active = cue;
  const index = versions.get(cue.id) || 0;
  const variant = cue.variants[index];
  $('now-title').textContent = cue.label;
  $('now-detail').textContent = `${groups[cue.group]} · 版本 ${index + 1} / ${cue.variants.length}${cue.loop ? ' · 环境循环' : ''}`;
  $('status').textContent = '正在加载…';
  audio.src = new URL(variant.src, document.baseURI).href;
  audio.loop = $('loop').checked && !sequence;
  audio.load(); renderGrid(); updatePlayer();
  try {
    await audio.play();
    if (token !== generation) return;
    $('status').textContent = sequence ? '按当前列表顺序播放；随时可以暂停或停止。' : '';
    updatePlayer();
  } catch {
    if (token !== generation) return;
    $('status').textContent = '未能播放，请再点一次试听。';
    updatePlayer();
  }
}

function step(offset, wrap = true) {
  const list = filtered(); if (!list.length) return;
  const index = list.findIndex(cue => cue.id === active?.id);
  const next = index < 0 ? 0 : index + offset;
  if (!wrap && next >= list.length) { setSequence(false); $('status').textContent = '这一组听完了。'; return; }
  playCue(list[(next + list.length) % list.length]);
}

async function toggle() {
  if (!active) { if (filtered()[0]) playCue(filtered()[0]); return; }
  if (!audio.paused) audio.pause();
  else {
    try { await audio.play(); $('status').textContent = ''; }
    catch { $('status').textContent = '未能播放，请点卡片重新试听。'; }
  }
  updatePlayer();
}

function nextVersion() {
  if (!active || active.variants.length < 2) return;
  versions.set(active.id, ((versions.get(active.id) || 0) + 1) % active.variants.length);
  playCue(active);
}

$('search').addEventListener('input', renderGrid);
$('toggle').addEventListener('click', toggle);
$('previous').addEventListener('click', () => step(-1));
$('next').addEventListener('click', () => step(1));
$('variant').addEventListener('click', nextVersion);
$('sequence').addEventListener('click', () => { setSequence(!sequence); if (sequence) { const list = filtered(); if (list.length) playCue(list[0]); } });
$('stop').addEventListener('click', () => { generation++; setSequence(false); audio.pause(); audio.currentTime = 0; $('status').textContent = ''; updatePlayer(); });
$('volume').addEventListener('input', () => { audio.volume = Number($('volume').value) / 100; $('volume-value').textContent = `${$('volume').value}%`; });
$('loop').addEventListener('change', () => { if ($('loop').checked) setSequence(false); audio.loop = $('loop').checked; });
$('progress').addEventListener('input', () => { if (Number.isFinite(audio.duration)) audio.currentTime = Number($('progress').value) / 1000 * audio.duration; });
for (const event of ['timeupdate', 'loadedmetadata', 'play', 'pause', 'ended']) audio.addEventListener(event, updatePlayer);
audio.addEventListener('ended', () => { if (sequence) step(1, false); });
audio.addEventListener('error', () => { $('status').textContent = '这条音效加载失败，可以重新试听或换个版本。'; setSequence(false); });
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLElement && /INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName)) return;
  if (event.key === ' ') { event.preventDefault(); toggle(); }
  if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
  if (event.key.toLowerCase() === 'v') nextVersion();
  if (event.key === '/') { event.preventDefault(); $('search').focus(); }
});

try {
  const response = await fetch('./assets/sfx/winter-v5/library.json');
  if (!response.ok) throw new Error('library unavailable');
  const library = await response.json(); cues = library.cues; groups = library.groups;
  $('total').textContent = `${cues.length} 种音效 / ${cues.reduce((n, cue) => n + cue.variants.length, 0)} 个版本`;
  renderCategories(); renderGrid(); updatePlayer();
} catch {
  $('grid').replaceChildren(element('p', '音效列表载入失败，请刷新页面重试。', 'empty'));
  $('total').textContent = '载入失败';
}
