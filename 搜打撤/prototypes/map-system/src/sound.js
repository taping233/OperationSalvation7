/* ============================================================
 * 搜打撤 v0.3 —— 音频（程序化战斗音效 + 文件背景乐）
 *
 * 全部由 WebAudio 合成，无音频文件、离线可用：
 *   · 音效 SFX：出牌/命中/受击/格挡庇幕/治疗/金币/骰子/场景/胜利/失败…
 *   · 背景乐 BGM：assets/bgm-black-stream-sea.mp3，循环播放；
 *     title/board/base/battle 只负责控制播放状态，不重启曲目。
 *
 * 浏览器自动播放策略：首次用户点击/按键后才会真正出声（ensure() 恢复
 * AudioContext）；静音状态持久化在 localStorage('sdt-muted')。
 * ============================================================ */
(function () {
  const BGM_URL = 'assets/bgm-black-stream-sea.mp3';
  const bgm = new Audio(BGM_URL);
  bgm.loop = true;
  bgm.preload = 'auto';
  let ctx = null, master = null, sfxGain = null, clickGain = null, clickComp = null;
  // 三级开关：muted 全局静音（侧边栏 [[icon:gear]]）· musicOff 只关音乐 · sfxOff 只关音效（设置页）
  let muted = false, musicOff = false, sfxOff = false;
  // 音量 0~1，随 localStorage 持久化；音乐基准 0.45，音效基准 0.9
  let musicVol = 1, sfxVol = 1;
  const BASE_MUSIC = 0.45, BASE_SFX = 0.9;
  bgm.volume = BASE_MUSIC * musicVol;
  try {
    muted = localStorage.getItem('sdt-muted') === '1';
    musicOff = localStorage.getItem('sdt-music-off') === '1';
    sfxOff = localStorage.getItem('sdt-sfx-off') === '1';
    const mv = parseFloat(localStorage.getItem('sdt-music-vol')); if (mv >= 0 && mv <= 1) musicVol = mv;
    const sv = parseFloat(localStorage.getItem('sdt-sfx-vol')); if (sv >= 0 && sv <= 1) sfxVol = sv;
  } catch (e) {}

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return true; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = BASE_SFX * sfxVol; sfxGain.connect(master);
    // 点击音专用链路：增益拉响度，压缩器压掉归一化后的尖峰，避免破音
    clickGain = ctx.createGain(); clickGain.gain.value = 1.8;
    clickComp = ctx.createDynamicsCompressor();
    clickComp.threshold.value = -14; clickComp.ratio.value = 4;
    clickGain.connect(clickComp); clickComp.connect(sfxGain);
    loadClicks();
    loadHovers();
    loadSwitches();
    return true;
  }

  /* ---------- 开关音效：Kenney switch（CC0），预解码缓存，随机选一 ---------- */
  const SWITCH_URLS = [1, 2, 3, 4, 5, 6].map(i => 'assets/sfx/switch' + i + '.wav');
  let switchBuffers = null;
  function loadSwitches() {
    if (switchBuffers) return;
    switchBuffers = [];
    Promise.all(SWITCH_URLS.map(u =>
      fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(ab => normalize(ctx.decodeAudioData(ab)))
    )).then(bufs => {
      const ok = bufs.filter(Boolean);
      if (ok.length) switchBuffers = ok;
    }).catch(() => { /* 保留空数组，回退合成音 */ });
  }

  /* ---------- 悬停音效：Kenney rollover（CC0），预解码缓存，随机选一 ---------- */
  const HOVER_URLS = [1, 2, 3, 4, 5, 6].map(i => 'assets/sfx/rollover' + i + '.wav');
  let hoverBuffers = null;
  function loadHovers() {
    if (hoverBuffers) return;
    hoverBuffers = [];
    Promise.all(HOVER_URLS.map(u =>
      fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(ab => normalize(ctx.decodeAudioData(ab)))
    )).then(bufs => {
      const ok = bufs.filter(Boolean);
      if (ok.length) hoverBuffers = ok;
    }).catch(() => { /* 保留空数组，回退合成音 */ });
  }

  /* ---------- 点击音效：Kenney UI Audio（CC0）WAV，预解码缓存，随机选一 ---------- */
  const CLICK_URLS = [1, 2, 3, 4, 5].map(i => 'assets/sfx/click' + i + '.wav');
  let clickBuffers = null; // null=未加载 []=全部失败 Array=已解码
  function loadClicks() {
    if (clickBuffers) return;
    clickBuffers = []; // 占位：解码完成前先回退合成音
    Promise.all(CLICK_URLS.map(u =>
      fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(ab => normalize(ctx.decodeAudioData(ab)))
    )).then(bufs => {
      const ok = bufs.filter(Boolean);
      if (ok.length) clickBuffers = ok;
    }).catch(() => { /* 保留空数组，回退合成音 */ });
  }
  // 峰值归一化：Kenney 原始文件响度差异大且偏轻，统一拉到 95% 满幅
  function normalize(promise) {
    return promise.then(buf => {
      try {
        const peak = Math.max(1e-6, Math.max(...Array.from({ length: buf.numberOfChannels }, (_, c) =>
          Math.max(...buf.getChannelData(c).map(Math.abs)))));
        const k = 0.95 / peak;
        if (Math.abs(k - 1) < 0.05) return buf;
        for (let c = 0; c < buf.numberOfChannels; c++) {
          const d = buf.getChannelData(c);
          for (let i = 0; i < d.length; i++) d[i] *= k;
        }
      } catch (e) { /* 归一化失败就用原样 */ }
      return buf;
    });
  }
  function playClick() {
    if (clickBuffers && clickBuffers.length) {
      const src = ctx.createBufferSource();
      src.buffer = clickBuffers[Math.floor(Math.random() * clickBuffers.length)];
      src.connect(clickGain || sfxGain);
      src.start();
    } else {
      tone({ f: 900, f2: 640, type: 'triangle', dur: .06, vol: .035 });
    }
  }
  function playHover() {
    if (hoverBuffers && hoverBuffers.length) {
      const src = ctx.createBufferSource();
      src.buffer = hoverBuffers[Math.floor(Math.random() * hoverBuffers.length)];
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
      src.buffer = switchBuffers[Math.floor(Math.random() * switchBuffers.length)];
      const g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(g); g.connect(sfxGain);
      src.start();
    } else {
      tone({ f: 700, f2: 1050, type: 'square', dur: .05, vol: .03 });
    }
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
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
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
    hit:    () => { noise({ dur: .12, vol: .09, fHi: 900, fLo: 130, type: 'lowpass' }); tone({ f: 150, f2: 55, type: 'sine', dur: .16, vol: .1 }); },
    hurt:   () => { noise({ dur: .16, vol: .09, fHi: 1300, fLo: 220 }); tone({ f: 220, f2: 70, type: 'sawtooth', dur: .2, vol: .05 }); },
    curse:  () => tone({ f: 300, f2: 170, type: 'sawtooth', dur: .18, vol: .035 }),
    parry:  () => { tone({ f: 1250, f2: 1850, type: 'sine', dur: .12, vol: .05 }); tone({ f: 2600, type: 'sine', dur: .07, vol: .02, delay: .05 }); },
    heal:   () => { tone({ f: 520, f2: 780, type: 'sine', dur: .18, vol: .04 }); tone({ f: 660, f2: 990, type: 'sine', dur: .2, vol: .03, delay: .09 }); },
    coin:   () => { tone({ f: 1250, type: 'triangle', dur: .09, vol: .045 }); tone({ f: 1870, type: 'triangle', dur: .14, vol: .035, delay: .06 }); },
    dice:   () => { for (let i = 0; i < 5; i++) noise({ dur: .03, vol: .03, delay: i * .05, fHi: 3200, fLo: 1600 }); },
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
  };
  function sfx(name) {
    if (muted || sfxOff) return;
    const fn = SFX[name];
    if (!fn || !ensure()) return;
    try { fn(); } catch (e) { /* 静默 */ }
  }

  /* ---------- 文件背景乐 ---------- */
  let musicMode = null;
  function syncBgm() {
    bgm.muted = muted || musicOff;
    if (!musicMode) { bgm.pause(); return; }
    if (!bgm.muted) bgm.play().catch(() => {});
  }
  function music(mode) {
    if (mode === musicMode) { syncBgm(); return; }
    musicMode = mode || null;
    syncBgm();
  }
  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem('sdt-muted', muted ? '1' : '0'); } catch (e) {}
    if (master) master.gain.value = muted ? 0 : 1;
    syncBgm();
  }
  // 只关音乐（设置页）：立即静音已排程的乐句；重开时恢复当前 BGM
  function setMusicMuted(m) {
    musicOff = !!m;
    try { localStorage.setItem('sdt-music-off', musicOff ? '1' : '0'); } catch (e) {}
    syncBgm();
  }
  // 只关音效（设置页）
  function setSfxMuted(m) {
    sfxOff = !!m;
    try { localStorage.setItem('sdt-sfx-off', sfxOff ? '1' : '0'); } catch (e) {}
  }
  // 音量（0~1，设置页滑条）：即时生效并持久化
  function setMusicVolume(v) {
    musicVol = Math.min(1, Math.max(0, +v || 0));
    try { localStorage.setItem('sdt-music-vol', String(musicVol)); } catch (e) {}
    bgm.volume = BASE_MUSIC * musicVol;
  }
  function setSfxVolume(v) {
    sfxVol = Math.min(1, Math.max(0, +v || 0));
    try { localStorage.setItem('sdt-sfx-vol', String(sfxVol)); } catch (e) {}
    if (sfxGain) sfxGain.gain.value = BASE_SFX * sfxVol;
  }
  // 自动播放策略：首次交互后恢复上下文；若此前已选定 BGM 则立即开声
  function kick() {
    if (!ensure()) return;
    syncBgm();
  }
  document.addEventListener('pointerdown', kick);
  document.addEventListener('keydown', kick);

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

  window.SDT = window.SDT || {};
  window.SDT.Sound = {
    sfx, music, setMuted, setMusicMuted, setSfxMuted, setMusicVolume, setSfxVolume, ensure,
    get muted() { return muted; },
    get musicMuted() { return musicOff; },
    get sfxMuted() { return sfxOff; },
    get musicVolume() { return musicVol; },
    get sfxVolume() { return sfxVol; },
  };
})();
