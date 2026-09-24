import { sdtDefine } from '../core/sdt-facade.js';
import { Howl, Howler } from 'howler';
import { assetUrl } from '../core/asset-url.js';
import { Random } from '../core/random.js';
import { shouldPlaySfx } from './sound.policy.js';
import { WinterSoundscape } from './sound.scape.js';
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
  let ctx = null, master = null, masterComp = null, sfxGain = null, clickGain = null, clickComp = null, scape = null;
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
    // 所有合成音共享一个软限幅器，给卡牌连击多段碰撞保留峰值余量。
    masterComp = ctx.createDynamicsCompressor();
    masterComp.threshold.value = -6; masterComp.knee.value = 8;
    masterComp.ratio.value = 12; masterComp.attack.value = 0.003; masterComp.release.value = 0.18;
    master.connect(masterComp); masterComp.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = BASE_SFX * dbGain(sfxVol); sfxGain.connect(master);
    // 点击音专用链路：增益拉响度，压缩器压掉归一化后的尖峰，避免破音
    clickGain = ctx.createGain(); clickGain.gain.value = 1.8;
    clickComp = ctx.createDynamicsCompressor();
    clickComp.threshold.value = -14; clickComp.ratio.value = 4;
    clickGain.connect(clickComp); clickComp.connect(sfxGain);
    scape = new WinterSoundscape(ctx, master);
    if (battleBoss) scape.setBoss(true);
    else if (battlePressure > 0) scape.setPressure(battlePressure);
    loadClicks();
    loadHovers();
    loadSwitches();
    loadBattle();
    loadJsfx();
    return true;
  }

  // 所有短音效共享两路解码队列。首次交互仍可立即使用合成音回退，后台不再同时解码 47 个文件。
  const decodeQueue = [];
  let activeDecodes = 0;
  const MAX_CONCURRENT_DECODES = 2;
  function pumpDecodeQueue() {
    while (activeDecodes < MAX_CONCURRENT_DECODES && decodeQueue.length) {
      const job = decodeQueue.shift();
      activeDecodes++;
      fetch(job.url)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(ab => ctx.decodeAudioData(ab))
        .then(normalizeBuffer)
        .then(job.resolve, job.reject)
        .finally(() => {
          activeDecodes--;
          setTimeout(pumpDecodeQueue, 0);
        });
    }
  }
  function decodeQueued(url) {
    return new Promise((resolve, reject) => {
      decodeQueue.push({ url, resolve, reject });
      pumpDecodeQueue();
    });
  }

  /* ---------- 开关音效：Kenney switch（CC0），预解码缓存，随机选一 ---------- */
  const SWITCH_URLS = [1, 2, 3, 4, 5, 6].map(i => assetUrl('assets/sfx/switch' + i + '.wav'));
  let switchBuffers = null;
  function loadSwitches() {
    if (switchBuffers) return;
    switchBuffers = [];
    Promise.all(SWITCH_URLS.map(u =>
      decodeQueued(u)
    )).then(bufs => {
      const ok = bufs.filter(Boolean);
      if (ok.length) switchBuffers = ok;
    }).catch(() => { /* 保留空数组，回退合成音 */ });
  }

  /* ---------- 悬停音效：Kenney rollover（CC0），预解码缓存，随机选一 ---------- */
  const HOVER_URLS = [1, 2, 3, 4, 5, 6].map(i => assetUrl('assets/sfx/rollover' + i + '.wav'));
  let hoverBuffers = null;
  function loadHovers() {
    if (hoverBuffers) return;
    hoverBuffers = [];
    Promise.all(HOVER_URLS.map(u =>
      decodeQueued(u)
    )).then(bufs => {
      const ok = bufs.filter(Boolean);
      if (ok.length) hoverBuffers = ok;
    }).catch(() => { /* 保留空数组，回退合成音 */ });
  }

  /* ---------- 点击音效：Kenney UI Audio（CC0）WAV，预解码缓存，随机选一 ---------- */
  const CLICK_URLS = [1, 2, 3, 4, 5].map(i => assetUrl('assets/sfx/click' + i + '.wav'));
  let clickBuffers = null; // null=未加载 []=全部失败 Array=已解码
  function loadClicks() {
    if (clickBuffers) return;
    clickBuffers = []; // 占位：解码完成前先回退合成音
    Promise.all(CLICK_URLS.map(u =>
      decodeQueued(u)
    )).then(bufs => {
      const ok = bufs.filter(Boolean);
      if (ok.length) clickBuffers = ok;
    }).catch(() => { /* 保留空数组，回退合成音 */ });
  }
  // 峰值归一化：Kenney 原始文件响度差异大且偏轻，统一拉到 95% 满幅
  function normalizeBuffer(buf) {
    let peak = 1e-6;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
    }
    const k = 0.95 / peak;
    if (Math.abs(k - 1) < 0.05) return buf;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < data.length; i++) data[i] *= k;
    }
    return buf;
  }
  function playClick() {
    if (clickBuffers && clickBuffers.length) {
      const src = ctx.createBufferSource();
      src.buffer = clickBuffers[Math.floor(Random.random('audio') * clickBuffers.length)];
      src.connect(clickGain || sfxGain);
      src.start();
    } else {
      tone({ f: 900, f2: 640, type: 'triangle', dur: .06, vol: .035 });
    }
  }
  function playHover() {
    if (hoverBuffers && hoverBuffers.length) {
      const src = ctx.createBufferSource();
      src.buffer = hoverBuffers[Math.floor(Random.random('audio') * hoverBuffers.length)];
      const g = ctx.createGain(); g.gain.value = 0.12; // 归一化后很响，压低成轻提示
      src.connect(g); g.connect(sfxGain);
      src.start();
    } else {
      tone({ f: 1500, type: 'sine', dur: .04, vol: .05 });
    }
  }
  function playSwitch() {
    if (switchBuffers && switchBuffers.length) {
      const src = ctx.createBufferSource();
      src.buffer = switchBuffers[Math.floor(Random.random('audio') * switchBuffers.length)];
      const g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(g); g.connect(sfxGain);
      src.start();
    } else {
      tone({ f: 700, f2: 1050, type: 'square', dur: .05, vol: .03 });
    }
  }
  /* ---------- 战斗/开箱采样：Kenney Impact Sounds / RPG Audio / Music Jingles（CC0）----------
     预解码缓存，按键随机选一；归一化后按 BATTLE_GAIN 压回各自响度。
     加载失败时该键缺位，sfx() 自动回退下方 SFX 表的合成音。 */
  const BATTLE_URLS = {
    hit:        [1, 2, 3, 4].map(i => assetUrl(`assets/sfx/battle/hit-${i}.ogg`)),
    hurt:       [1, 2].map(i => assetUrl(`assets/sfx/battle/hurt-${i}.ogg`)),
    parry:      [1, 2].map(i => assetUrl(`assets/sfx/battle/parry-${i}.ogg`)),
    curse:      [1, 2].map(i => assetUrl(`assets/sfx/battle/curse-${i}.ogg`)),
    heal:       [1, 2, 3].map(i => assetUrl(`assets/sfx/battle/heal-${i}.ogg`)),
    chestShake: [1, 2].map(i => assetUrl(`assets/sfx/battle/chestshake-${i}.ogg`)),
    chestBurst: [1, 2, 3].map(i => assetUrl(`assets/sfx/battle/chestburst-${i}.ogg`)),
    reveal:     [1, 2, 3].map(i => assetUrl(`assets/sfx/battle/reveal-${i}.ogg`)),
    legend:     [1, 2, 3].map(i => assetUrl(`assets/sfx/battle/legend-${i}.ogg`)),
    victory:    [1, 2].map(i => assetUrl(`assets/sfx/battle/victory-${i}.ogg`)),
    defeat:     [1].map(i => assetUrl(`assets/sfx/battle/defeat-${i}.ogg`)),
    // 卡牌操作实录（Kenney Casino sounds，CC0）：抽牌=cardSlide×4，洗牌=cardShuffle，出牌=cardPlace×4
    draw:       [1, 2, 3, 4].map(i => assetUrl(`assets/sfx/battle/draw-${i}.ogg`)),
    shuffle:    [1].map(i => assetUrl(`assets/sfx/battle/shuffle-${i}.ogg`)),
    card:       [1, 2, 3, 4].map(i => assetUrl(`assets/sfx/battle/cardPlace-${i}.ogg`)),
    cardSelect: [assetUrl('assets/sfx/battle/additions/card-select.ogg')],
    discard:    [assetUrl('assets/sfx/battle/additions/card-discard.ogg')],
    shieldUp:   [assetUrl('assets/sfx/battle/additions/shield-up.ogg')],
    kill:       [assetUrl('assets/sfx/battle/additions/kill-impact.ogg')],
  };
  // 采样峰值统一到 95% 后偏响，按键系数压回（参考原合成音的相对响度）
  const BATTLE_GAIN = {
    hit: 0.55, hurt: 0.55, parry: 0.4, curse: 0.35, heal: 0.45,
    chestShake: 0.5, chestBurst: 0.65, reveal: 0.45, legend: 0.55,
    victory: 0.5, defeat: 0.5,
    draw: 0.45, shuffle: 0.5, card: 0.5,
    cardSelect: 0.34, discard: 0.3, burn: 0.38, kill: 0.28, danger: 0.38,
    energyUp: 0.25, energyDown: 0.28, shieldUp: 0.22, shieldBreak: 0.48,
    phase: 0.28, rarePlay: 0.42, curseEnd: 0.34,
    strike: 0.55,
  };
  // 敌我方向分化（音频 P2#10）：我打敌（hit）=升 rate 更亮更利；敌打我（hurt）=降 rate+低通更闷更沉，
  // 闭眼也能分辨「谁在挨打」；其余键保持 ±5% 通用变调
  // strike（技能伤害，迭代评审 09-20）：复用 hit 实录池但 rate 微下探、不加低通——
  // 与 hit（1.05-1.18 亮）/ hurt（0.82-0.9+低通闷）成「亮/沉/闷」三段，盲听可辨
  const BATTLE_TONE_SHAPE = {
    hit:  { rateMin: 1.05, rateMax: 1.18 },
    hurt: { rateMin: 0.82, rateMax: 0.9, lowpass: 1400 },
    strike: { rateMin: 0.92, rateMax: 1.0 },
  };
  let battleBuffers = null; // null=未加载 {}=加载中/部分就绪
  function loadBattle() {
    if (battleBuffers) return;
    battleBuffers = {};
    const jobs = Object.entries(BATTLE_URLS).map(([key, urls]) =>
      Promise.all(urls.map(u =>
        decodeQueued(u)
      )).then(bufs => {
        const ok = bufs.filter(Boolean);
        if (ok.length) battleBuffers[key] = ok;
      }).catch(() => { /* 该键缺位，回退合成音 */ })
    );
    Promise.all(jobs).catch(() => { /* 各键已自行容错 */ });
  }

  const now = () => ctx.currentTime;

  // 单音：f 起始频率，f2 可选滑动终点
  function tone({ f = 440, f2 = null, type = 'sine', dur = 0.15, vol = 0.08, delay = 0, attack = 0.006 }) {
    const t0 = now() + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  // 噪声爆发（带通/低通扫频）：打击感
  function noise({ dur = 0.12, vol = 0.08, delay = 0, fLo = 400, fHi = 3000, type = 'bandpass' }) {
    const t0 = now() + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Random.random('audio') * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = type; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(fHi, t0);
    bp.frequency.exponentialRampToValueAtTime(Math.max(40, fLo), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(sfxGain);
    src.start(t0);
  }

  /* ---------- 音效表 ---------- */
  const SFX = {
    click:  playClick,
    hover:  playHover,
    switch: playSwitch,
    open:   () => { noise({ dur: .14, vol: .028, fHi: 600, fLo: 2200 }); tone({ f: 440, f2: 660, type: 'sine', dur: .12, vol: .025 }); },
    close:  () => { noise({ dur: .13, vol: .024, fHi: 1800, fLo: 500 }); tone({ f: 620, f2: 420, type: 'sine', dur: .11, vol: .02 }); },
    error:  () => { tone({ f: 190, type: 'square', dur: .09, vol: .045 }); tone({ f: 150, type: 'square', dur: .13, vol: .045, delay: .1 }); },
    pick:   () => { noise({ dur: .06, vol: .04, fHi: 2000, fLo: 800 }); tone({ f: 520, f2: 720, type: 'triangle', dur: .07, vol: .035 }); },
    drop:   () => { noise({ dur: .07, vol: .045, fHi: 1200, fLo: 400 }); tone({ f: 480, f2: 300, type: 'triangle', dur: .09, vol: .04 }); },
    card:   () => { noise({ dur: .13, vol: .055, fHi: 2600, fLo: 700 }); tone({ f: 520, f2: 300, type: 'triangle', dur: .1, vol: .03 }); },
    cardSelect: () => { tone({ f: 740, f2: 1040, type: 'sine', dur: .055, vol: .022 }); },
    discard: () => { noise({ dur: .11, vol: .026, fHi: 2100, fLo: 500 }); tone({ f: 420, f2: 260, type: 'triangle', dur: .1, vol: .022 }); },
    burn: () => { noise({ dur: .22, vol: .028, fHi: 1800, fLo: 180, type: 'lowpass' }); tone({ f: 560, f2: 120, type: 'sine', dur: .2, vol: .025 }); },
    kill: () => { tone({ f: 180, f2: 72, type: 'triangle', dur: .18, vol: .055 }); noise({ dur: .07, vol: .026, fHi: 900, fLo: 180 }); },
    danger: () => { tone({ f: 520, f2: 390, type: 'sine', dur: .16, vol: .03 }); tone({ f: 520, f2: 390, type: 'sine', dur: .16, vol: .03, delay: .21 }); },
    energyUp: () => { tone({ f: 540, f2: 810, type: 'triangle', dur: .1, vol: .027 }); },
    energyDown: () => { tone({ f: 620, f2: 360, type: 'triangle', dur: .1, vol: .027 }); },
    shieldUp: () => { tone({ f: 460, f2: 780, type: 'triangle', dur: .14, vol: .03 }); tone({ f: 1120, type: 'sine', dur: .07, vol: .016, delay: .05 }); },
    shieldBreak: () => { noise({ dur: .13, vol: .04, fHi: 3200, fLo: 420 }); tone({ f: 720, f2: 120, type: 'triangle', dur: .16, vol: .032 }); },
    phase: (opts = {}) => opts.side === 'foe'
      ? tone({ f: 230, f2: 110, type: 'sine', dur: .2, vol: .033 })
      : (tone({ f: 520, f2: 650, type: 'triangle', dur: .08, vol: .024 }), tone({ f: 700, f2: 940, type: 'triangle', dur: .12, vol: .026, delay: .08 })),
    rarePlay: () => [587, 740, 988].forEach((f, i) => tone({ f, type: 'triangle', dur: .15, vol: .025, delay: i * .055 })),
    curseEnd: () => { tone({ f: 380, f2: 170, type: 'sawtooth', dur: .14, vol: .022 }); noise({ dur: .06, vol: .017, fHi: 1700, fLo: 450, delay: .08 }); },
    hit:    () => { noise({ dur: .12, vol: .09, fHi: 900, fLo: 130, type: 'lowpass' }); tone({ f: 150, f2: 55, type: 'sine', dur: .16, vol: .1 }); },
    hurt:   () => { noise({ dur: .16, vol: .09, fHi: 1300, fLo: 220 }); tone({ f: 220, f2: 70, type: 'sawtooth', dur: .2, vol: .05 }); },
    curse:  () => tone({ f: 300, f2: 170, type: 'sawtooth', dur: .18, vol: .035 }),
    parry:  () => { tone({ f: 1250, f2: 1850, type: 'sine', dur: .12, vol: .05 }); tone({ f: 2600, type: 'sine', dur: .07, vol: .02, delay: .05 }); },
    heal:   () => { tone({ f: 520, f2: 780, type: 'sine', dur: .18, vol: .04 }); tone({ f: 660, f2: 990, type: 'sine', dur: .2, vol: .03, delay: .09 }); },
    coin:   () => { tone({ f: 1250, type: 'triangle', dur: .09, vol: .045 }); tone({ f: 1870, type: 'triangle', dur: .14, vol: .035, delay: .06 }); },
    scene:  () => noise({ dur: .32, vol: .032, fHi: 1300, fLo: 280 }),
    flee:   () => noise({ dur: .26, vol: .04, fHi: 700, fLo: 2600 }),
    ding:   () => { tone({ f: 880, type: 'triangle', dur: .12, vol: .05 }); tone({ f: 1318, type: 'triangle', dur: .18, vol: .04, delay: .09 }); },
    victory: () => [523, 659, 784, 1046].forEach((f, i) => tone({ f, type: 'triangle', dur: .22, vol: .05, delay: i * .12 })),
    defeat:  () => [392, 330, 262, 196].forEach((f, i) => tone({ f, type: 'sine', dur: .3, vol: .05, delay: i * .14 })),
    // —— 开宝箱（摇幌 → 爆开 → 逐卡揭晓 → 高稀有惊喜）——
    chestShake: () => { noise({ dur: .05, vol: .06, fHi: 600, fLo: 200, type: 'lowpass' }); tone({ f: 170, f2: 120, type: 'triangle', dur: .07, vol: .05 }); },
    chestBurst: () => {
      noise({ dur: .3, vol: .12, fHi: 1400, fLo: 90, type: 'lowpass' });
      tone({ f: 90, f2: 240, type: 'sine', dur: .25, vol: .09 });
      tone({ f: 1568, type: 'triangle', dur: .2, vol: .03, delay: .1 });
    },
    reveal:  () => noise({ dur: .09, vol: .045, fHi: 2400, fLo: 900 }),
    legend:  () => [659, 784, 988, 1318, 1568].forEach((f, i) => {
      tone({ f, type: 'triangle', dur: .26, vol: .055, delay: i * .1 });
      tone({ f: f * 2, type: 'sine', dur: .2, vol: .018, delay: i * .1 + .02 });
    }),
    // —— 回合权交接（P1#4）：你的回合=轻上行双音，敌方回合=低频闷坠 ——
    turnSelf: () => { tone({ f: 587, type: 'triangle', dur: .09, vol: .04 }); tone({ f: 880, type: 'triangle', dur: .16, vol: .05, delay: .07 }); },
    turnFoe:  () => { tone({ f: 210, f2: 92, type: 'sine', dur: .24, vol: .065 }); },
    // —— 敌方攻击前摇（P2#8）：高频→低频快速扫频=挥击呼啸，提示「要挨打了」——
    foeLunge: () => noise({ dur: .22, vol: .04, fHi: 2400, fLo: 300 }),
    // —— 祝福挂上/到期（P2#6）：上行三连=增益入手，下滑+碎裂=增益消失 ——
    buffUp:   () => [523, 659, 784].forEach((f, i) => tone({ f, type: 'triangle', dur: .12, vol: .04, delay: i * .06 })),
    buffDown: () => { tone({ f: 660, f2: 392, type: 'triangle', dur: .18, vol: .04 }); noise({ dur: .08, vol: .02, fHi: 1800, fLo: 600 }); },
    // —— 照相馆快门（批次四）：帘幕开合双噪声脉冲 + 机械咔哒 ——
    shutter: () => {
      noise({ dur: .04, vol: .07, fHi: 3200, fLo: 900 });
      noise({ dur: .05, vol: .05, fHi: 2400, fLo: 700, delay: .09 });
      tone({ f: 1800, type: 'square', dur: .03, vol: .018, delay: .09 });
    },
  };
  /* ---------- jsfxr 采样（程序化生成 wav，scripts/jsfxr-generate.cjs 可再生成）---------- */
  const JSFX_URLS = {
    gain:    assetUrl('assets/sfx/jsfxr/pickup.wav'),
    confirm: assetUrl('assets/sfx/jsfxr/confirm.wav'),
    deny:    assetUrl('assets/sfx/jsfxr/error.wav'),
    levelup: assetUrl('assets/sfx/jsfxr/levelup.wav'),
    strike:  assetUrl('assets/sfx/jsfxr/hit.wav'),
  };
  let jsfxBuffers = null; // null=未加载 {}=加载中/部分就绪
  function loadJsfx() {
    if (jsfxBuffers) return;
    jsfxBuffers = {};
    Promise.all(Object.entries(JSFX_URLS).map(([key, url]) =>
      decodeQueued(url).then(buf => { jsfxBuffers[key] = normalizeBuffer(buf); }).catch(() => {})
    )).catch(() => { /* 缺位时该键无声，不回退合成音（语义不同） */ });
  }
  function playJsfx(name) {
    const buf = jsfxBuffers && jsfxBuffers[name];
    if (!buf) return false;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.6;
      src.connect(g); g.connect(sfxGain);
      src.start();
      return true;
    } catch { return false; }
  }

  const lastSfxAt = new Map();
  // deny 反向抑制（迭代评审 09-20）：click 音挂在全局 pointerdown 委托、deny 多在 click 处理器内
  // 触发——同一次按压必先响 click（间隔≈按住时长）。deny 播出前若发现新鲜 click 记录则吞掉 deny
  // 保底音，消除「咔哒+错误低鸣」一按双响；视觉反馈（抖动/toast）不受影响。
  // 窗口取 350ms 覆盖按住时长；非按钮路径（程序化 deny）无新鲜 click 记录，照常出声。
  const DENY_SUPPRESS_MS = 350;
  function sfx(name, opts) {
    if (muted || sfxOff) return;
    const stamp = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    if (name === 'deny') {
      const lastClick = lastSfxAt.get('click');
      if (lastClick != null && stamp - lastClick < DENY_SUPPRESS_MS) return;
    }
    if (!shouldPlaySfx(name, stamp, lastSfxAt)) return;
    if (!ensure()) return;
    // 战斗/开箱采样优先（随机选一），未就绪或缺位时回退合成音
    // strike（技能伤害）复用 hit 实录池：避免同一批 ogg 双份解码驻留，音色差异靠 TONE_SHAPE rate 三段化
    const poolKey = name === 'strike' ? 'hit' : name;
    const pool = battleBuffers && battleBuffers[poolKey];
    if (pool && pool.length) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = pool[Math.floor(Random.random('audio') * pool.length)];
        // SFX 变调随机化（audio-design）：±5% 播放速率，连续打击不机械；
        // hit/hurt/strike 按 BATTLE_TONE_SHAPE 覆盖（P2#10 敌我分化 + 09-20 技能沉音）
        const shape = BATTLE_TONE_SHAPE[name];
        src.playbackRate.value = (shape
          ? shape.rateMin + Random.random('audio') * (shape.rateMax - shape.rateMin)
          : 0.95 + Random.random('audio') * 0.1) * ((opts && opts.rateScale) || 1);
        const g = ctx.createGain();
        g.gain.value = BATTLE_GAIN[name] || 0.5;
        if (name === 'shieldUp') {
          const t = ctx.currentTime;
          g.gain.setValueAtTime(g.gain.value, t);
          g.gain.linearRampToValueAtTime(0, t + 0.42);
        }
        if (shape && shape.lowpass) {
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass'; lp.frequency.value = shape.lowpass;
          src.connect(lp); lp.connect(g);
        } else {
          src.connect(g);
        }
        g.connect(sfxGain);
        if (name === 'shieldUp') src.start(0, 0, Math.min(0.42, src.buffer.duration));
        else src.start();
        return;
      } catch { /* 落入合成回退 */ }
    }
    // jsfxr 采样（gain/confirm/deny/levelup/strike）：语义独立，不与合成音互为回退；
    // strike 例外——实录为主（上方 hit 池），jsfxr hit 仅作实录未就绪时的兜底
    if (playJsfx(name)) return;
    const fn = SFX[name];
    if (!fn) return;
    try { fn(opts); } catch { /* 静默 */ }
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
    sfx, music, setMuted, setMusicMuted, setMusicSource, setSfxMuted, setMusicVolume, setSfxVolume, setDucked, setBoss, setBattlePressure, ensure,
    get muted() { return muted; },
    get musicMuted() { return musicOff; },
    get sfxMuted() { return sfxOff; },
    get musicVolume() { return musicVol; },
    get sfxVolume() { return sfxVol; },
    get musicSource() { return musicSource; },
  });

export { tone };
