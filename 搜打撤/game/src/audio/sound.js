import { sdtDefine } from '../core/sdt-facade.js';
import { Howl, Howler } from 'howler';
import { shouldPlaySfx } from './sound.policy.js';
import { WinterSoundscape } from './sound.scape.js';
import { SampleSfxBank, resolveSfx } from './sound.bank.js';
const BGM_URL = new URL('../../assets/bgm-sour-orange-earth.mp3', import.meta.url).href;
// 开屏（标题）专用曲目：《「离解复合」主界面》
const TITLE_BGM_URL = new URL('../../assets/bgm-liejie-fuhe.mp3', import.meta.url).href;
// BGM 是 3.7MB 级长音频，走 HTML5 流式播放，避免 WebAudio 整段解码阻塞并占用大块内存。
const bgm = new Howl({ src: [BGM_URL], loop: true, html5: true, preload: false, volume: 0 });
// 开屏曲目不预载（6.3MB）：自动播放策略下首次交互前必然无声，改为首次 syncBgm 时按需加载，
// 启动带宽让给首屏图与字体；Howler 对 preload:false 的实例会在 play() 时自动 load。
const titleBgm = new Howl({ src: [TITLE_BGM_URL], loop: true, html5: true, preload: false, volume: 0 });
// 战斗专用曲目：《「次生预案」战斗曲》——musicMode='battle' 时替代通用曲，行军仍走通用曲。
// html5:false（WebAudio 解码）：HTML5 audio 的 loop 在 Chromium 系有可闻重启缝，战斗曲要反复听几十遍；
// WebAudio buffer loop 无缝。代价是解码后 PCM 驻留（~90MB float32），在 syncBgm 离场时 unload 释放。
const BATTLE_BGM_URL = new URL('../../assets/bgm-cisheng-yuanan.mp3', import.meta.url).href;
const battleBgm = new Howl({ src: [BATTLE_BGM_URL], loop: true, html5: false, preload: false, volume: 0 });
  let ctx = null, master = null, masterComp = null, sfxGain = null, bank = null, scape = null;
  // 三级开关：muted 全局静音（侧边栏 [[icon:gear]]）· musicOff 只关音乐 · sfxOff 只关音效（设置页）
  let muted = false, musicOff = false, sfxOff = false;
  // 音量 0~1，随 localStorage 持久化；音乐基准 0.45，音效基准 2.5
  let musicVol = 1, sfxVol = 1, musicSource = 'scape';
  const BASE_MUSIC = 0.45, BASE_SFX = 2.5;
  // 滑条 0..1 → 增益走 dB 曲线（等比可闻：低段每格有变化，端点不变 0=静音 / 1=基准）
  const dbGain = k => Number(k) <= 0 ? 0 : Math.pow(10, ((Math.min(1, Number(k)) - 1) * 30) / 20);
  // 战斗 ducking：战斗期间 BGM 侧链压低（audio-design），结束恢复
  let ducked = false;
  let battleBoss = false, battlePressure = 0;
  try {
    muted = localStorage.getItem('sdt-muted') === '1';
    musicOff = localStorage.getItem('sdt-music-off') === '1';
    sfxOff = localStorage.getItem('sdt-sfx-off') === '1';
    const mv = parseFloat(localStorage.getItem('sdt-music-vol')); if (mv >= 0 && mv <= 1) musicVol = mv;
    const sv = parseFloat(localStorage.getItem('sdt-sfx-vol')); if (sv >= 0 && sv <= 1) sfxVol = sv;
    const source = localStorage.getItem('sdt-music-source'); if (source === 'original' || source === 'scape') musicSource = source;
  } catch { /* localStorage 不可用/写入失败（隐私模式等）：音频设置回落默认值，可安全忽略 */ }

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return true; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return false; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
    // 总线限幅给卡牌连击留出峰值余量。
    masterComp = ctx.createDynamicsCompressor();
    masterComp.threshold.value = -6; masterComp.knee.value = 8;
    masterComp.ratio.value = 12; masterComp.attack.value = 0.003; masterComp.release.value = 0.18;
    master.connect(masterComp); masterComp.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = BASE_SFX * dbGain(sfxVol); sfxGain.connect(master);
    scape = new WinterSoundscape(ctx, master);
    if (battleBoss) scape.setBoss(true);
    else if (battlePressure > 0) scape.setPressure(battlePressure);
    bank = new SampleSfxBank(ctx, sfxGain);
    bank.setEnabled(!muted && !sfxOff && !document.hidden);
    bank.prewarm();
    syncAmbient();
    return true;
  }

  const lastSfxAt = new Map();
  let nodeKey = null, nodeAmbient = null;
  const NODE_CUES = { fire: 'fireEnter', altar: 'altarEnter', door: 'doorEnter',
    shop: 'shopEnter', exit: 'extractionEnter', boss: 'bossReveal', safe: 'safeEnter',
    event: 'eventEnter', pickup: null, battle: null };
  const NODE_AMBIENCE = { fire: 'fireLoop', altar: 'altarHumLoop',
    exit: 'extractionBeaconLoop', boss: 'pollutionDroneLoop',
    event: 'ruinsAirLoop', pickup: 'wastelandWindLoop', safe: 'ruinsAirLoop' };
  const ASSET_CUES = { 'story-last-lamp': 'storyClue', 'scene-event-recode': 'recodeStart',
    'scene-event-relief': 'eventSafe', 'scene-event-danger': 'eventDanger', 'scene-event-clue': 'eventClue' };
  function syncAmbient() {
    if (!bank) return;
    bank.setEnabled(!muted && !sfxOff && !document.hidden);
    bank.ambient(nodeAmbient || (!nodeKey && musicMode === 'board' ? 'windSnowLoop' : null));
  }
  function scene(tone, asset = '') {
    const key = tone ? `${tone}:${asset}` : null;
    if (nodeKey === key) return;
    nodeKey = key;
    nodeAmbient = NODE_AMBIENCE[tone] || null;
    syncAmbient();
    const cue = ASSET_CUES[asset] || NODE_CUES[tone];
    if (cue) sfx(cue);
  }
  function sfx(name, opts) {
    if (muted || sfxOff || document.hidden) return;
    const stamp = performance.now();
    const id = resolveSfx(name, opts);
    if (!shouldPlaySfx(id, stamp, lastSfxAt)) return;
    if (ensure()) bank.play(id, opts);
  }

  /* ---------- 文件背景乐 ---------- */
  let musicMode = null;
  const fadeTokens = new WeakMap();
  // 自动播放策略：首次交互前 BGM 必然无声。此时不触发 play()——preload:false 的 Howl
  // 会在 play() 时立即 load（标题曲 3.7MB），把启动带宽让给首屏图与字体；首次交互 kick() 后再开播。
  let userGestured = false;
  function activeBgm() { return musicMode === 'title' ? titleBgm : musicMode === 'battle' ? battleBgm : bgm; }
  function syncBgm() {
    const visible = typeof document === 'undefined' || !document.hidden;
    syncAmbient();
    const on = !!(musicMode && !muted && !musicOff && userGestured && visible);
    const originalOn = on && musicSource === 'original';
    if (scape) {
      scape.setVolume(BASE_MUSIC * dbGain(musicVol) * 0.32 * (ducked ? 0.45 : 1));
      // 模式映射定版（迭代评审 09-20）：title/base→title 层、battle→battle 层，
      // 其余（含龙巢备战等 modal 界面）一律落 board 行军层——零成本，独立声景层留给未来真场景图
      scape.setMode(on && musicSource === 'scape' ? (['title', 'base'].includes(musicMode) ? 'title' : musicMode === 'battle' ? 'battle' : 'board') : null);
      // mp3 音乐源下不再整体静音声景：BOSS 紧张垫要经它透出（battle 层旁路，P2#12）
      scape.setMuted(!on);
    }
    const cur = activeBgm();
    const target = BASE_MUSIC * dbGain(musicVol) * (ducked ? 0.45 : 1);
    [bgm, titleBgm, battleBgm].forEach(track => {
      const shouldRun = originalOn && track === cur;
      const token = (fadeTokens.get(track) || 0) + 1;
      fadeTokens.set(track, token);
      if (!shouldRun && track.playing()) {
        const visibleNow = typeof document === 'undefined' || !document.hidden;
        if (musicOff || !visibleNow || muted) {
          track.mute(true); track.pause();
          if (track === battleBgm && musicMode !== 'battle' && track.state() === 'loaded') track.unload();
          return;
        }
        // 淡出期间保持未静音；先 mute() 会直接截断 Howler 音量曲线。
        track.mute(false);
        track.fade(track.volume(), 0, 280);
        setTimeout(() => {
          if (fadeTokens.get(track) !== token) return;
          const isVisibleNow = typeof document === 'undefined' || !document.hidden;
          const stillInactive = track !== activeBgm() || !musicMode || muted || musicOff || !isVisibleNow || musicSource !== 'original';
          if (stillInactive) {
            track.pause(); track.mute(true);
            // 战斗曲 WebAudio 解码 PCM 驻留大：确认切走后卸载；隐藏页面仍保留解码。
            if (track === battleBgm && musicMode !== 'battle' && track.state() === 'loaded') track.unload();
          }
        }, 300);
      } else if (!shouldRun) track.mute(true);
    });
    if (!originalOn) return;
    cur.mute(false);
    // preload:false 的 Howl 在 play() 时只挂起等待、不会自动加载，必须先显式 load()。
    // 走到这里必然已过首次交互门控（userGestured），是曲目的预期加载时机。
    if (cur.state() === 'unloaded') cur.load();
    if (!cur.playing()) {
      cur.volume(0);
      cur.play();
      cur.fade(0, target, 420);
    } else cur.volume(target);
  }
  function music(mode) {
    if (mode === musicMode) { syncBgm(); return; }
    const nextMode = mode || null;
    if (musicMode === 'battle' && nextMode !== 'battle') {
      battlePressure = 0;
      if (scape && !battleBoss) scape.setPressure(0);
    }
    musicMode = nextMode;
    syncBgm();
  }
  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem('sdt-muted', muted ? '1' : '0'); } catch { /* localStorage 不可用/写入失败（隐私模式等）：音频设置回落默认值，可安全忽略 */ }
    if (master) master.gain.value = muted ? 0 : 1;
    Howler.mute(muted);
    syncBgm();
  }
  // 只关音乐（设置页）：立即静音已排程的乐句；重开时恢复当前 BGM
  function setMusicMuted(m) {
    musicOff = !!m;
    try { localStorage.setItem('sdt-music-off', musicOff ? '1' : '0'); } catch { /* localStorage 不可用/写入失败（隐私模式等）：音频设置回落默认值，可安全忽略 */ }
    syncBgm();
  }
  function setMusicSource(source) {
    musicSource = source === 'original' ? 'original' : 'scape';
    try { localStorage.setItem('sdt-music-source', musicSource); } catch { /* localStorage 不可用/写入失败（隐私模式等）：音频设置回落默认值，可安全忽略 */ }
    syncBgm();
  }
  // 战斗 ducking 开关（battle.core 进出战斗时调用）。
  // 参数校验（迭代评审 09-20）：曾有无参调用 setDucked() 被 !!v 强转成 false，
  // 战斗中关音乐会静默解除侧链压低——非布尔直接拒绝并告警，防同类回归。
  function setDucked(v) {
    if (typeof v !== 'boolean') { console.warn('[sound] setDucked 需要布尔参数，收到：', v); return; }
    if (v === ducked) return;
    ducked = v;
    syncBgm();
  }
  // BOSS 紧张垫开关（音频 P2#12）：声景 battle 层旁路+tension 抬升，与正曲叠加出首脑战压迫感
  function setBoss(on) {
    battleBoss = !!on;
    if (scape) scape.setBoss(on);
  }
  function setBattlePressure(value) {
    battlePressure = Math.max(0, Math.min(1, Number(value) || 0));
    if (scape) scape.setPressure(value);
  }
  // 只关音效（设置页）
  function setSfxMuted(m) {
    sfxOff = !!m;
    syncAmbient();
    try { localStorage.setItem('sdt-sfx-off', sfxOff ? '1' : '0'); } catch { /* localStorage 不可用/写入失败（隐私模式等）：音频设置回落默认值，可安全忽略 */ }
  }
  // 音量（0~1，设置页滑条）：即时生效并持久化
  function setMusicVolume(v) {
    musicVol = Math.min(1, Math.max(0, +v || 0));
    try { localStorage.setItem('sdt-music-vol', String(musicVol)); } catch { /* localStorage 不可用/写入失败（隐私模式等）：音频设置回落默认值，可安全忽略 */ }
    syncBgm();
  }
  function setSfxVolume(v) {
    sfxVol = Math.min(1, Math.max(0, +v || 0));
    try { localStorage.setItem('sdt-sfx-vol', String(sfxVol)); } catch { /* localStorage 不可用/写入失败（隐私模式等）：音频设置回落默认值，可安全忽略 */ }
    if (sfxGain) sfxGain.gain.value = BASE_SFX * dbGain(sfxVol);
  }
  // 自动播放策略：首次交互后恢复上下文；若此前已选定 BGM 则立即开声
  function kick() {
    if (!ensure()) return;
    // 已解锁且 BGM 正常播放、WebAudio 也未挂起时，后续每次按键/点击直接跳过——
    // 否则每个输入都重走 syncBgm（Howler mute/volume 写入），还会打断进行中的音量淡入淡出。
    // ctx 挂起（浏览器音频策略）时不得早退，否则跳过 resume 会让音效一直哑着。
    // 声景由持续 WebAudio 节点驱动，没有 Howl 的 playing() 状态可供判断；
    // 只要上下文仍在运行，后续 pointer 不必重复 sync，避免反复重排淡入曲线。
    const audioAlreadyRunning = musicSource === 'scape'
      ? !!scape
      : activeBgm().playing();
    if (userGestured && musicMode && audioAlreadyRunning
      && (!Howler.ctx || Howler.ctx.state === 'running')) return;
    userGestured = true;
    if (Howler.ctx && Howler.ctx.state === 'suspended') Howler.ctx.resume().catch(() => {});
    syncBgm();
  }
  document.addEventListener('pointerdown', kick);
  document.addEventListener('keydown', kick);
  document.addEventListener('visibilitychange', syncBgm);

  // 全局事件委托：任何 <button> 被点击都播放点击音（替代各处手动绑定，避免重复）
  document.addEventListener('pointerdown', (e) => {
    if (e.target && e.target.closest && e.target.closest('button')) sfx('click');
  });
  // 全局事件委托：菜单按钮掠过播放悬停音（pointerover 会因子元素冒泡重复触发，去重）
  let lastHoverBtn = null;
  document.addEventListener('pointerover', (e) => {
    if (!e.target || !e.target.closest) return;
    const btn = e.target.closest('button');
    if (!btn || btn === lastHoverBtn || btn.disabled) return;
    lastHoverBtn = btn;
    sfx('hover');
  });
  document.addEventListener('pointerout', (e) => {
    if (lastHoverBtn && e.target && e.target.closest && e.target.closest('button') === lastHoverBtn) lastHoverBtn = null;
  });
  // 全局事件委托：复选框/开关切换播放开关音
  document.addEventListener('change', (e) => {
    if (e.target && e.target.type === 'checkbox') sfx('switch');
  });

  sdtDefine('Sound', {
    sfx, scene, music, setMuted, setMusicMuted, setMusicSource, setSfxMuted, setMusicVolume, setSfxVolume, setDucked, setBoss, setBattlePressure, ensure,
    get muted() { return muted; },
    get musicMuted() { return musicOff; },
    get sfxMuted() { return sfxOff; },
    get musicVolume() { return musicVol; },
    get sfxVolume() { return sfxVol; },
    get musicSource() { return musicSource; },
  });

