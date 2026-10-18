import SDT, { sdtDefine } from '../core/sdt-facade.js';
import { Howl, Howler } from 'howler';
import { assetUrl } from '../core/asset-url.js';
import { SampleOnlyPlayer } from './sound.samples.player.js';
import { shouldPlaySfx } from './sound.policy.js';
import { MUSIC_TRACKS, overlayMusicScene, resolveMusicScene } from './sound.music.catalog.js';
import { SceneMusicPlayer } from './sound.music.player.js';
import { bgmDiagnosticDisabled } from './sound.diagnostic-policy.js';
  const diagnosticBgmOff = bgmDiagnosticDisabled(import.meta.env.DEV, typeof location === 'undefined' ? '' : location.search);
  // 同一页面重复初始化时，先释放旧实例，避免旧曲和监听继续运行。
  SDT.Sound?.dispose?.();
  const soundEvents = new AbortController();
  let disposed = false;
  let ctx = null, master = null, masterComp = null, sfxGain = null, sfxTame = null;
  // 三级开关：muted 全局静音（侧边栏 [[icon:gear]]）· musicOff 只关音乐 · sfxOff 只关音效（设置页）
  let muted = false, musicOff = false, sfxOff = false;
  // 音量 0~1，随 localStorage 持久化；音乐基准 0.45，音效基准 1.5
  let musicVol = 1, sfxVol = 1, musicSource = 'original';
  const BASE_MUSIC = 0.45, BASE_SFX = 1.5;
  // 滑条 0..1 → 增益走 dB 曲线（等比可闻：低段每格有变化，端点不变 0=静音 / 1=基准）
  const dbGain = k => Number(k) <= 0 ? 0 : Math.pow(10, ((Math.min(1, Number(k)) - 1) * 30) / 20);
  // 战斗 ducking：战斗期间 BGM 侧链压低（audio-design），结束恢复
  let ducked = false;
  let battleBoss = false;
  try {
    muted = localStorage.getItem('sdt-muted') === '1';
    musicOff = localStorage.getItem('sdt-music-off') === '1';
    sfxOff = localStorage.getItem('sdt-sfx-off') === '1';
    const mv = parseFloat(localStorage.getItem('sdt-music-vol')); if (mv >= 0 && mv <= 1) musicVol = mv;
    const sv = parseFloat(localStorage.getItem('sdt-sfx-vol')); if (sv >= 0 && sv <= 1) sfxVol = sv;
    // The approved four-track soundtrack supersedes the legacy soundscape preference.
  } catch { /* localStorage 不可用/写入失败（隐私模式等）：音频设置回落默认值，可安全忽略 */ }

  function ensure() {
    if (disposed) return false;
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return true; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return false; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
    // 所有短采样共享一个软限幅器，给卡牌连击多段碰撞保留峰值余量。
    masterComp = ctx.createDynamicsCompressor();
    masterComp.threshold.value = -6; masterComp.knee.value = 8;
    masterComp.ratio.value = 12; masterComp.attack.value = 0.003; masterComp.release.value = 0.18;
    master.connect(masterComp); masterComp.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = sfxOff ? 0 : BASE_SFX * dbGain(sfxVol);
    // 音效总线高频搁架衰减（>4.5kHz 收 4dB）：保留既有高频衰减以收敛采样瞬态，
    // 限幅器不再被高频尖峰顶着工作；总线级处理保持所有音效相对响度不变。
    sfxTame = ctx.createBiquadFilter();
    sfxTame.type = 'highshelf'; sfxTame.frequency.value = 4500; sfxTame.gain.value = -4;
    sfxGain.connect(sfxTame); sfxTame.connect(master);
    samples = new SampleOnlyPlayer(ctx, sfxGain);
    samples.load(url => decodeQueued(assetUrl(url)));
    return true;
  }

  // 所有短音效共享两路解码队列；未就绪时静默，不排程迟到补响。
  let samples = null;
  const decodeQueue = [];
  let activeDecodes = 0;
  const MAX_CONCURRENT_DECODES = 2;
  function pumpDecodeQueue() {
    if (disposed) return;
    while (activeDecodes < MAX_CONCURRENT_DECODES && decodeQueue.length) {
      const job = decodeQueue.shift();
      activeDecodes++;
      const audioContext = ctx;
      fetch(job.url, { signal: soundEvents.signal })
        .then(r => {
          if (disposed) throw new Error('Sound disposed');
          if (!r.ok) throw new Error(r.status);
          return r.arrayBuffer();
        })
        .then(ab => {
          if (disposed || audioContext.state === 'closed') throw new Error('Sound disposed');
          return audioContext.decodeAudioData(ab);
        })
        .then(buf => {
          if (disposed) throw new Error('Sound disposed');
          return buf;
        })
        .then(job.resolve, job.reject)
        .finally(() => {
          activeDecodes--;
          if (!disposed) pumpDecodeQueue();
        });
    }
  }
  function decodeQueued(url) {
    if (disposed) return Promise.reject(new Error('Sound disposed'));
    return new Promise((resolve, reject) => {
      decodeQueue.push({ url, resolve, reject });
      pumpDecodeQueue();
    });
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
    samples?.play(name, opts);
  }

  /* ---------- 文件背景乐 ---------- */
  let musicMode = null;
  let sceneTone = null;
  let battleBossId = '';
  let userGestured = false;
  const musicPlayer = new SceneMusicPlayer((scene, callbacks, { html5 = true } = {}) => new Howl({
    src: [MUSIC_TRACKS[scene]], format: ['opus'], loop: true, html5,
    preload: false, volume: 0, onload: callbacks.load, onloaderror: callbacks.error,
    onplay: callbacks.play, onplayerror: callbacks.playError, onunlock: callbacks.unlock,
  }), { backend: 'html5', onError: (scene, error) => console.warn('[music] load failed', scene, error) });
  function currentMusicScene() { return resolveMusicScene(musicMode, sceneTone, battleBoss ? battleBossId : ''); }
  function syncBgm() {
    if (disposed) return;
    const visible = typeof document === 'undefined' || !document.hidden;
    // 先尝试自动播放；浏览器若挂起音频，由 Howler 等待首次真实输入解锁。
    const on = !!(musicMode && !muted && !musicOff && !diagnosticBgmOff && visible);
    musicPlayer.set(currentMusicScene(), {
      enabled: on,
      volume: BASE_MUSIC * dbGain(musicVol) * (ducked ? 0.45 : 1),
      immediate: muted || musicOff || diagnosticBgmOff || !visible,
    });
  }
  function scene(tone, asset = '', metadata = {}) {
    const next = overlayMusicScene(tone, { ...metadata, asset }, sceneTone);
    if (next === sceneTone) return;
    sceneTone = next;
    syncBgm();
  }
  function music(mode) {
    sceneTone = null;
    if (mode === musicMode) { syncBgm(); return; }
    const nextMode = mode || null;
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
  function setMusicSource() {
    musicSource = 'original';
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
  // 保留战斗调用接口；首脑战也只使用当前文件配乐。
  function setBoss(on, id = '') {
    battleBoss = !!on;
    battleBossId = battleBoss ? id : '';
    syncBgm();
  }
  // 旧合成声景已退役，压力接口保留供现有战斗调用。
  function setBattlePressure() {}
  // 只关音效（设置页）
  function setSfxMuted(m) {
    sfxOff = !!m;
    if (sfxGain) sfxGain.gain.value = sfxOff ? 0 : BASE_SFX * dbGain(sfxVol);
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
    if (sfxGain) sfxGain.gain.value = sfxOff ? 0 : BASE_SFX * dbGain(sfxVol);
  }
  // 首次输入恢复被浏览器挂起的上下文，并重试未能开始的当前 BGM。
  function kick() {
    if (!muted && !sfxOff && !ensure()) return;
    musicPlayer.retryBlocked();
    // 已解锁且 BGM 正常播放、WebAudio 也未挂起时，后续每次按键/点击直接跳过——
    // 否则每个输入都重走 syncBgm（Howler mute/volume 写入），还会打断进行中的音量淡入淡出。
    // ctx 挂起（浏览器音频策略）时不得早退，否则跳过 resume 会让音效一直哑着。
    const audioAlreadyRunning = musicPlayer.playing();
    if (userGestured && musicMode && audioAlreadyRunning
      && (!Howler.ctx || Howler.ctx.state === 'running')) return;
    userGestured = true;
    if (Howler.ctx && Howler.ctx.state === 'suspended') Howler.ctx.resume().then(syncBgm).catch(() => {});
    syncBgm();
  }
  document.addEventListener('pointerdown', kick, { capture: true, signal: soundEvents.signal });
  document.addEventListener('keydown', kick, { capture: true, signal: soundEvents.signal });
  document.addEventListener('visibilitychange', syncBgm, { signal: soundEvents.signal });

  // 全局事件委托：任何 <button> 被点击都播放点击音（替代各处手动绑定，避免重复）
  document.addEventListener('pointerdown', (e) => {
    if (e.target && e.target.closest && e.target.closest('button')) sfx('click');
  }, { signal: soundEvents.signal });
  // 全局事件委托：菜单按钮掠过播放悬停音（pointerover 会因子元素冒泡重复触发，去重）
  let lastHoverBtn = null;
  document.addEventListener('pointerover', (e) => {
    if (!e.target || !e.target.closest) return;
    const btn = e.target.closest('button');
    if (!btn || btn === lastHoverBtn || btn.disabled) return;
    lastHoverBtn = btn;
    sfx('hover');
  }, { signal: soundEvents.signal });
  document.addEventListener('pointerout', (e) => {
    if (lastHoverBtn && e.target && e.target.closest && e.target.closest('button') === lastHoverBtn) lastHoverBtn = null;
  }, { signal: soundEvents.signal });
  // 全局事件委托：复选框/开关切换播放开关音
  document.addEventListener('change', (e) => {
    if (e.target && e.target.type === 'checkbox') sfx('switch');
  }, { signal: soundEvents.signal });

  function dispose() {
    if (disposed) return;
    disposed = true;
    soundEvents.abort();
    musicPlayer.dispose();
    samples?.dispose();
    samples = null;
    // 取消网络请求并结算尚未开始的任务；已开始的解码不能取消，但其迟到结果不再处理。
    for (const job of decodeQueue.splice(0)) job.reject(new Error('Sound disposed'));
    lastSfxAt.clear(); lastHoverBtn = null;
    if (master) master.gain.value = 0;
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
    ctx = master = masterComp = sfxGain = sfxTame = null;
  }
  if (import.meta.hot) import.meta.hot.dispose(dispose);

  sdtDefine('Sound', {
    sfx, music, scene, setMuted, setMusicMuted, setMusicSource, setSfxMuted, setMusicVolume, setSfxVolume, setDucked, setBoss, setBattlePressure, ensure, dispose,
    get muted() { return muted; },
    get musicMuted() { return musicOff; },
    get sfxMuted() { return sfxOff; },
    get musicVolume() { return musicVol; },
    get sfxVolume() { return sfxVol; },
    get musicSource() { return musicSource; },
    get musicScene() { return currentMusicScene(); },
    get musicPlayback() { return { ...musicPlayer.snapshot(), muted: muted || musicOff || diagnosticBgmOff, diagnosticOverride: diagnosticBgmOff ? 'bgm-off' : null }; },
  });

