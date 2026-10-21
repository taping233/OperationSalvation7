export {};
/** @typedef {{'audio': HTMLAudioElement, 'search': HTMLInputElement, 'pack-panel': HTMLElement, 'pack-buttons': HTMLElement, 'pack-note': HTMLElement, 'status': HTMLElement, 'variant': HTMLButtonElement, 'total': HTMLElement, 'now-title': HTMLElement, 'now-detail': HTMLElement, 'grid': HTMLElement, 'categories': HTMLElement, 'section-title': HTMLElement, 'count': HTMLElement, 'toggle': HTMLButtonElement, 'signal': HTMLElement, 'elapsed': HTMLElement, 'duration': HTMLElement, 'progress': HTMLInputElement, 'sequence': HTMLElement, 'loop': HTMLInputElement, 'volume': HTMLInputElement, 'previous': HTMLButtonElement, 'next': HTMLButtonElement, 'stop': HTMLElement, 'volume-value': HTMLElement, 'variant-key-tip': HTMLElement}} PageElements */
/** @template {keyof PageElements} K @param {K} id @returns {PageElements[K]} */
const $ = id => /** @type {PageElements[K]} */ (document.getElementById(id));
const audio = $('audio');
let favorites = new Set(['click', 'card', 'hit', 'eventEnter', 'bossReveal']);
let featuredLabel = '旧版五样', featuredTitle = '旧版声音，仅供对照';
let cues = [], groups = {}, category = 'featured', active = null, generation = 0, sequence = false;
let libraryGeneration = 0, currentPack = 'arknights-expansion';
const params = new URLSearchParams(location.search);
const requestedSet = params.get('set') || 'alternatives';
const compareMode = requestedSet === 'alternatives';
document.body.classList.toggle('comparison-mode', compareMode);
const packs = [
  { id: 'arknights-runtime', label: 'A4 · 全部实装音效', note: '认可的40个保留，补齐交互、战斗与环境音效' },
  { id: 'arknights-expansion', label: 'A3 · 新增三十个', note: '新增30个 · 沿用A2微改标准，已认可10个原样保留' },
  { id: 'arknights-expansion-base', label: 'A3 · 原质对照', note: '同一批次源素材 · 裁切与配平对照', url: './assets/sfx/alternatives/arknights-expansion/library-base.json' },
  { id: 'arknights-adjusted', label: 'A2 · 方舟微改', note: '保留方舟主体质感 · 轻调音色、节奏与尾音' },
  { id: 'arknights', label: 'A · 上版对照', note: '上一版方舟素材 · 剪辑与配平' },
  { id: 'cc0-ui', label: 'B · 冷感界面', note: '现成开放许可声音 · 界面与反馈' },
  { id: 'cc0-action', label: 'C · 动作材质', note: '现成开放许可声音 · 材料与动作' },
];
const roleNames = {click:'按钮点击',confirm:'操作确认',card:'出牌',attackSlash:'斩击命中',
  parry:'格挡',shieldBreak:'护盾崩裂',heal:'治疗恢复',eventEnter:'进入事件',chestBurst:'宝箱开启',bossReveal:'首脑登场'};
const descriptions = {
  'arknights-adjusted': {click:'音色略沉，点击更紧凑',confirm:'确认候选，音高略升、收束更短',card:'纸牌滑动略快，尾音稍短',
    attackSlash:'挥击更紧，音色略沉',parry:'格挡候选，降低音高与尾音亮度',shieldBreak:'碎裂略快，减少尖亮',
    heal:'治疗提示略升，展开稍缓',eventEnter:'保留吸入与展开，节奏更紧',chestBurst:'奖励反馈略快，收尾更短',bossReveal:'警报预告略沉、稍缓'},
  arknights: {click:'原作界面点击',confirm:'另一种界面反馈，确认候选',card:'纸牌滑移与摩擦',
    attackSlash:'挥击与刀刃接触',parry:'盾牌命中类声音，格挡候选',shieldBreak:'玻璃裂散，屏障破碎候选',
    heal:'原作治疗提示',eventEnter:'界面过渡的吸入与展开',chestBurst:'奖励出现的反馈',bossReveal:'警报式预告'},
  'cc0-ui': {click:'机械按键',confirm:'短确认反馈',card:'纸牌滑出与落桌',attackSlash:'刀划与轻冲击',
    parry:'短金属碰撞',shieldBreak:'裂响与玻璃撞击',heal:'能量场式恢复',eventEnter:'科幻机械门',
    chestBurst:'金属扣与金币',bossReveal:'低频爆发式登场'},
  'cc0-action': {click:'剪刀闭合短扣',confirm:'金属锁扣落定',card:'真实纸页滑动',attackSlash:'挥动与双刀切入',
    parry:'双刀硬碰',shieldBreak:'金属冲击与玻璃裂散',heal:'药瓶、药液与水滴',eventEnter:'抽屉滑动与摩擦',
    chestBurst:'开锁、箱体与金币',bossReveal:'铁门展开与锤击'},
};
const versions = new Map();
audio.volume = .7;
const time = seconds => seconds > 0 && seconds < 10 ? `${seconds.toFixed(2)}s` : `${Math.floor((seconds || 0) / 60)}:${Math.floor((seconds || 0) % 60).toString().padStart(2, '0')}`;

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

function renderPacks() {
  $('pack-panel').hidden = !compareMode;
  if (!compareMode) return;
  $('pack-buttons').replaceChildren();
  for (const pack of packs) {
    const button = element('button', pack.label, 'pack-choice');
    button.setAttribute('aria-pressed', String(currentPack === pack.id));
    button.addEventListener('click', () => loadLibrary(pack.id, true));
    $('pack-buttons').append(button);
  }
  $('pack-note').textContent = packs.find(pack => pack.id === currentPack)?.note || '';
}

async function loadLibrary(packId, preserve = false) {
  const previousId = preserve ? active?.id : null;
  const token = ++libraryGeneration;
  generation++; setSequence(false); audio.pause(); active = null;
  currentPack = packId; renderPacks();
  $('status').textContent = '正在载入方案…';
  const url = compareMode ? packs.find(pack => pack.id === packId)?.url || `./assets/sfx/alternatives/${packId}/library.json`
    : requestedSet === 'web' ? './assets/sfx/original-ui-1018/library.json'
      : requestedSet === 'v5' ? './assets/sfx/winter-v5/library.json' : './assets/sfx/winter-v6-ten/library.json';
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('library unavailable');
    const library = await response.json();
    if (token !== libraryGeneration) return;
    cues = library.cues.map(cue => ({ ...cue, label: compareMode ? roleNames[cue.id] || cue.label : cue.label,
      note: compareMode ? descriptions[packId]?.[cue.id] || cue.note : cue.note }));
    groups = library.groups; versions.clear();
    favorites = new Set(library.featuredIds || ['click','card','hit','eventEnter','bossReveal']);
    featuredLabel = library.featuredLabel || (compareMode ? `当前方案的${cues.length}个` : '旧版五样');
    featuredTitle = library.featuredTitle || (compareMode ? '按动作逐个试听' : '旧版声音，仅供对照');
    if (!groups[category] && category !== 'all') category = 'featured';
    document.querySelector('.version').textContent = library.version || 'V5';
    document.querySelector('h1').textContent = compareMode ? `音效对比 · ${packs.length} 套方案` : library.name || '旧版音效 · 对照留档';
    $('variant').hidden = cues.every(cue => cue.variants.length === 1);
    $('total').textContent = `${cues.length} 种声音 · ${compareMode ? packs.find(pack => pack.id === packId).label : '当前版本'}`;
    $('now-title').textContent = '选一个声音，开始试听';
    $('now-detail').textContent = `${cues.length} 种声音 · 点击卡片即可播放`;
    $('status').textContent = '';
    renderCategories(); renderGrid(); updatePlayer();
    if (compareMode) {
      const urlState = new URL(location.href); urlState.searchParams.set('set','alternatives'); urlState.searchParams.set('pack',packId);
      history.replaceState(null,'',urlState);
    }
    const matching = previousId && cues.find(cue => cue.id === previousId);
    if (matching) playCue(matching);
    else if (previousId) $('status').textContent = '这套没有刚才的声音，请重新选择；新增声音可用 A3 原质对照。';
  } catch {
    if (token !== libraryGeneration) return;
    $('grid').replaceChildren(element('p','这个方案尚未载入，请重试或切换另一套。','empty'));
    $('total').textContent = '方案载入失败';
    $('status').textContent = '方案载入失败，可以刷新页面重试。';
  }
}

function renderCategories() {
  $('categories').replaceChildren();
  for (const [id, label] of [['featured', featuredLabel], ['all', '全部音效'], ...Object.entries(groups)]) {
    const count = id === 'featured' ? favorites.size : id === 'all' ? cues.length : cues.filter(cue => cue.group === id).length;
    const button = element('button', null, `category${category === id ? ' active' : ''}`);
    button.append(element('strong', label), element('span', count));
    button.setAttribute('aria-pressed', String(category === id));
    button.addEventListener('click', () => { category = id; renderCategories(); renderGrid(); });
    $('categories').append(button);
  }
}

function renderGrid() {
  const list = filtered();
  $('section-title').textContent = category === 'featured' ? featuredTitle : category === 'all' ? '全部音效' : groups[category];
  $('count').textContent = `${list.length} 种声音`;
  $('grid').replaceChildren();
  if (!list.length) { $('grid').append(element('p', '没找到这个声音，换个关键词试试。', 'empty')); return; }
  for (const cue of list) {
    const index = versions.get(cue.id) || 0;
    const card = element('article', null, `sound-card${active?.id === cue.id ? ' active' : ''}`);
    card.dataset.cue = cue.id;
    const heading = element('div', null, 'card-heading');
    heading.append(element('h3', cue.label));
    if (favorites.has(cue.id) && featuredLabel === '已认可的五个') heading.append(element('span', '已认可', 'approved'));
    const meta = element('div', null, 'card-meta');
    meta.append(element('span', groups[cue.group]), element('span', cue.variants.length ? `${cue.variants[index].seconds.toFixed(2)} 秒` : '已取消音效'));
    if (cue.loop) meta.append(element('span', '可循环'));
    const actions = element('div', null, 'card-actions');
    const play = element('button', '▶ 试听', 'card-play');
    play.disabled = !cue.variants.length; if (play.disabled) play.textContent = '已取消音效';
    play.setAttribute('aria-label', `试听${cue.label}`);
    play.addEventListener('click', () => { setSequence(false); playCue(cue); });
    const select = element('select', null, 'version-select');
    select.setAttribute('aria-label', `${cue.label}的版本`);
    cue.variants.forEach((_, i) => { const option = element('option', `版本 ${i + 1}`); option.value = String(i); select.append(option); });
    select.value = String(index); select.disabled = cue.variants.length === 1;
    select.addEventListener('change', () => { versions.set(cue.id, Number(select.value)); playCue(cue); });
    actions.append(play);
    if (cue.variants.length > 1) actions.append(select);
    card.append(heading, meta);
    if (cue.note) card.append(element('p', cue.note, 'sound-note'));
    card.append(actions); $('grid').append(card);
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
  if (!cue.variants.length) {
    setSequence(false); active = null; audio.removeAttribute('src'); audio.load();
    $('now-title').textContent = cue.label; $('now-detail').textContent = '已取消音效';
    $('status').textContent = '这个场景不再播放声音。'; renderGrid(); updatePlayer(); return;
  }
  const index = versions.get(cue.id) || 0;
  const variant = cue.variants[index];
  $('now-title').textContent = cue.label;
  $('now-detail').textContent = `${compareMode ? `${packs.find(pack => pack.id === currentPack).label} · ` : ''}${groups[cue.group]}${cue.variants.length > 1 ? ` · 版本 ${index + 1} / ${cue.variants.length}` : cue.note ? ` · ${cue.note}` : ''}${cue.loop ? ' · 环境循环' : ''}`;
  $('status').textContent = '正在加载…';
  audio.src = new URL(variant.src, document.baseURI).href;
  if (requestedSet === 'web') audio.volume = Math.min(1, Number($('volume').value) / 100 * cue.gain * 1.5);
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
  const list = filtered().filter(cue => cue.variants.length); if (!list.length) return;
  const index = list.findIndex(cue => cue.id === active?.id);
  const next = index < 0 ? 0 : index + offset;
  if (!wrap && next >= list.length) { setSequence(false); $('status').textContent = '这一组听完了。'; return; }
  playCue(list[(next + list.length) % list.length]);
}

async function toggle() {
  if (!active) { const first = filtered().find(cue => cue.variants.length); if (first) playCue(first); return; }
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

$('search').addEventListener('input', () => {
  if (category === 'featured' && $('search').value.trim()) { category = 'all'; renderCategories(); }
  renderGrid();
});
$('toggle').addEventListener('click', toggle);
$('previous').addEventListener('click', () => step(-1));
$('next').addEventListener('click', () => step(1));
$('variant').addEventListener('click', nextVersion);
$('sequence').addEventListener('click', () => { setSequence(!sequence); if (sequence) { const list = filtered().filter(cue => cue.variants.length); if (list.length) playCue(list[0]); else setSequence(false); } });
$('stop').addEventListener('click', () => { generation++; setSequence(false); audio.pause(); audio.currentTime = 0; $('status').textContent = ''; updatePlayer(); });
$('volume').addEventListener('input', () => {
  audio.volume = Math.min(1, Number($('volume').value) / 100 * (requestedSet === 'web' && active ? active.gain * 1.5 : 1));
  $('volume-value').textContent = `${$('volume').value}%`;
});
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
  if (event.key.toLowerCase() === 'v') {
    if (compareMode) loadLibrary(packs[(packs.findIndex(pack => pack.id === currentPack) + 1) % packs.length].id, true);
    else nextVersion();
  }
  if (event.key === '/') { event.preventDefault(); $('search').focus(); }
});

const initialPack = packs.some(pack => pack.id === params.get('pack')) ? params.get('pack') : 'arknights-expansion';
$('variant-key-tip').textContent = compareMode ? 'V · 切换方案' : 'V · 换个版本';
await loadLibrary(initialPack);
