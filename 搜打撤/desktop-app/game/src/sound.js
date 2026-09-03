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
  bgm.volume = 0.45;
  let ctx = null, master = null, sfxGain = null;
  // 三级开关：muted 全局静音（侧边栏 [[icon:gear]]）· musicOff 只关音乐 · sfxOff 只关音效（设置页）
  let muted = false, musicOff = false, sfxOff = false;
  try {
    muted = localStorage.getItem('sdt-muted') === '1';
    musicOff = localStorage.getItem('sdt-music-off') === '1';
    sfxOff = localStorage.getItem('sdt-sfx-off') === '1';
  } catch (e) {}

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return true; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    loadClicks();
    return true;
  }

  /* ---------- 点击音效：Kenney UI Audio（CC0）WAV，预解码缓存，随机选一 ---------- */
  const CLICK_URLS = [1, 2, 3, 4, 5].map(i => 'assets/sfx/click' + i + '.wav');
  let clickBuffers = null; // null=未加载 []=全部失败 Array=已解码
  function loadClicks() {
    if (clickBuffers) return;
    clickBuffers = []; // 占位：解码完成前先回退合成音
    Promise.all(CLICK_URLS.map(u =>
      fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(ab => ctx.decodeAudioData(ab))
    )).then(bufs => {
      const ok = bufs.filter(Boolean);
      if (ok.length) clickBuffers = ok;
    }).catch(() => { /* 保留空数组，回退合成音 */ });
  }
  function playClick() {
    if (clickBuffers && clickBuffers.length) {
      const src = ctx.createBufferSource();
      src.buffer = clickBuffers[Math.floor(Math.random() * clickBuffers.length)];
      src.connect(sfxGain);
      src.start();
    } else {
      tone({ f: 900, f2: 640, type: 'triangle', dur: .06, vol: .035 });
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
    hover:  () => tone({ f: 1500, type: 'sine', dur: .04, vol: .016 }),
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

  window.SDT = window.SDT || {};
  window.SDT.Sound = {
    sfx, music, setMuted, setMusicMuted, setSfxMuted, ensure,
    get muted() { return muted; },
    get musicMuted() { return musicOff; },
    get sfxMuted() { return sfxOff; },
  };
})();
