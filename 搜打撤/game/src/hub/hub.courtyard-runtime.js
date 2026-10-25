import { getPerformanceSettings, getQualityPreset, onPerformanceSettingsChange } from '../core/performance-settings.js';
import { assetUrl } from '../core/asset-url.js';
import { Random } from '../core/random.js';
import { createRainTableau } from './courtyard.rain-tableau.js';
import { createKoiPond } from './courtyard-vendor/KoiPond.js';
import { watchSurfaceActivity } from '../ui/surface-activity.js';
import { createVisualResourceRecovery } from '../ui/visual-resource-recovery.js';

// 生命周期由基地独立页负责；返回的清理函数可重复调用。
export function mountCourtyardV3(root) {
  const host = root.matches?.('[data-courtyard]') ? root : root.querySelector('[data-courtyard]');
  if (!host) return () => {};
  const overlay = host.closest('#overlay');
  const departed = () => !host.isConnected || (overlay && (!overlay.contains(host) || overlay.hidden
    || overlay.classList.contains('closing') || overlay.hasAttribute('data-ui-closing')));
  let rain = true;
  const canvas = host.querySelector('.courtyard-v3-canvas');
  const backdrop = host.querySelector('.courtyard-v3-backdrop');
  const rainCanvas = host.querySelector('.courtyard-v3-rain-layer');
  const scene = host.querySelector('.courtyard-v3-scene');
  const status = host.querySelector('.courtyard-v3-status');
  const controls = host.querySelector('.courtyard-v3-controls');
  const pauseButton = controls.querySelector('[data-courtyard-control="pause"]');
  const soundButton = controls.querySelector('[data-courtyard-control="sound"]');
  const rainButton = controls.querySelector('[data-courtyard-control="rain"]');
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reducedMotion = () => !!media?.matches || document.body.classList.contains('reduce-motion');
  if (!canvas.getContext('2d')) {
    status.textContent = '当前浏览器无法显示庭院';
    controls.querySelectorAll('button').forEach(button => { button.disabled = true; });
    return () => {};
  }
  const settings = { intensity:40 };
  let disposed = false, paused = false, frame = 0, previous = null, nextDraw = 0, image = null, feedbackTimer = 0;
  let soundEnabled = false, audio = null, noise = null, rainGain = null, rainFilter = null;
  let engine = null, koi = null;
  let activity = null, surfaceActive = false, lastReduced = null;
  const running = () => !disposed && !paused && surfaceActive && !reducedMotion();
  const draw = (dt = 0, animate = false) => {
    if (!engine || disposed) return;
    koi?.render(dt, animate);
    if (rain) engine.render(dt, animate);
  };
  const drawBackdrop = () => {
    if (disposed || !backdrop) return;
    const context = backdrop.getContext('2d');
    context.fillStyle = '#547980'; context.fillRect(0, 0, backdrop.width, backdrop.height);
    if (image?.complete && image.naturalWidth) {
      const scale = Math.max(backdrop.width / image.naturalWidth, backdrop.height / image.naturalHeight);
      const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
      context.drawImage(image, (backdrop.width - width) / 2, (backdrop.height - height) / 2, width, height);
      host.classList.add('scene-ready');
    }
  };
  const resize = () => {
    if (disposed) return;
    const bounds = scene.getBoundingClientRect();
    // 受控像素预算；仅绘制当前窗口，不启动隐藏副场景。
    const scale = Math.min(getQualityPreset().courtyardScale, window.devicePixelRatio || 1, 1500 / Math.max(1, bounds.width));
    const width = Math.max(1, Math.round(bounds.width * scale));
    const height = Math.max(1, Math.round(bounds.height * scale));
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width; canvas.height = height;
    rainCanvas.width = width; rainCanvas.height = height;
    backdrop.width = width; backdrop.height = height; drawBackdrop();
    engine?.resize(width, height);
    koi?.resize(width, height);
    draw();
  };
  resize();
  engine = createRainTableau(rainCanvas, { sceneBackdrop:true });
  koi = createKoiPond(canvas, { onProgress: ({ found, total, eaten }) => {
    controls.querySelector('[data-pond-found]').textContent = found === total ? `已找到全部 ${total} 条锦鲤` : `发现锦鲤 ${found} / ${total}`;
    controls.querySelector('[data-pond-eaten]').textContent = `吃食 ${eaten} 次`;
  } });
  engine.resize(canvas.width, canvas.height);
  const backdropRecovery = createVisualResourceRecovery({ host:scene, floating:true,
    source:assetUrl('assets/scenes/courtyard-pond-v4.webp'), label:'庭院背景暂未加载',
    isCurrent:() => !disposed && !departed(),
    apply:loaded => { image = loaded; drawBackdrop(); draw(); },
  });
  backdropRecovery.load();
  drawBackdrop();
  draw();
  const stopSound = () => {
    try { noise?.stop(); } catch { /* 尚未启动的音源也须继续释放上下文。 */ }
    noise?.disconnect(); noise = null;
    rainGain?.disconnect(); rainFilter?.disconnect(); rainGain = rainFilter = null;
    const oldAudio = audio; audio = null;
    oldAudio?.close().catch(() => {});
    soundEnabled = false; soundButton.textContent = '声音：关'; soundButton.setAttribute('aria-pressed', 'false');
  };
  const soundState = () => {
    if (!audio) return;
    const operation = !surfaceActive || paused ? audio.suspend() : audio.resume();
    operation.catch(() => {});
  };
  const syncRainSound = () => {
    if (!audio || !rainGain || !rainFilter) return;
    const heavy = settings.intensity === 80;
    for (const [param, value] of [[rainGain.gain, heavy ? .095 : .035], [rainFilter.frequency, heavy ? 2200 : 1100]]) {
      if (param.setTargetAtTime) param.setTargetAtTime(value, audio.currentTime, .15);
      else param.value = value;
    }
  };
  const toggleSound = () => {
    if (!rain) return;
    if (audio) { stopSound(); return; }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) { soundButton.textContent = '声音不可用'; soundButton.disabled = true; return; }
    try {
      audio = new Audio();
      const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
      const samples = buffer.getChannelData(0);
      let smooth = 0;
      for (let i = 0; i < samples.length; i++) { smooth = .97 * smooth + .03 * (Random.random('audio') * 2 - 1); samples[i] = rain ? smooth * 4 : smooth * 2.5; }
      noise = audio.createBufferSource(); noise.buffer = buffer; noise.loop = true;
      rainFilter = audio.createBiquadFilter(); rainFilter.type = 'lowpass';
      rainGain = audio.createGain(); rainGain.gain.value = 0;
      syncRainSound();
      noise.connect(rainFilter); rainFilter.connect(rainGain); rainGain.connect(audio.destination); noise.start();
      soundEnabled = true; soundButton.textContent = '声音：开'; soundButton.setAttribute('aria-pressed', 'true');
      status.textContent = '';
      soundState();
    } catch { stopSound(); status.textContent = '声音暂不可用'; }
  };
  const loop = time => {
    frame = 0;
    if (departed()) { dispose(); return; }
    if (!running()) return;
    const interval = 1000 / Math.min(30, getPerformanceSettings().fps);
    if (previous === null || time >= nextDraw - .5) {
      draw(previous === null ? 1 / 30 : Math.min(.05, (time - previous) / 1000), true);
      nextDraw = previous === null ? time + interval
        : nextDraw + Math.max(1, Math.floor((time - nextDraw) / interval) + 1) * interval;
      previous = time;
    }
    frame = requestAnimationFrame(loop);
  };
  const sync = () => {
    if (disposed) return;
    if (departed()) { dispose(); return; }
    if (frame) cancelAnimationFrame(frame);
    frame = 0; previous = null; nextDraw = 0;
    const reduced = reducedMotion();
    lastReduced = reduced;
    host.classList.toggle('is-still', reduced || paused || !surfaceActive);
    pauseButton.textContent = reduced ? '静态' : paused ? '继续' : '暂停';
    pauseButton.disabled = reduced; pauseButton.setAttribute('aria-pressed', String(paused));
    if (running()) frame = requestAnimationFrame(loop);
    else draw();
    if (soundEnabled) soundState();
  };
  const interact = (x, y) => {
    if (disposed) return;
    const accepted = rain ? engine.tap(x, y) : true;
    koi.tap(x, y);
    koi.pointer(x, y);
    status.textContent = accepted === false ? '轻点水面投喂' : rain ? '已投喂 · 雨圈散开' : '已投喂 · 等锦鲤来吃';
    clearTimeout(feedbackTimer); feedbackTimer = setTimeout(() => { if (!disposed) status.textContent = ''; }, 1400);
    draw();
  };
  const pointer = event => {
    if (!surfaceActive) return;
    const bounds = canvas.getBoundingClientRect();
    interact((event.clientX - bounds.left) / Math.max(1, bounds.width) * canvas.width,
      (event.clientY - bounds.top) / Math.max(1, bounds.height) * canvas.height);
  };
  const hover = event => {
    if (!surfaceActive) return;
    const bounds = canvas.getBoundingClientRect();
    koi.pointer((event.clientX - bounds.left) / Math.max(1, bounds.width) * canvas.width,
      (event.clientY - bounds.top) / Math.max(1, bounds.height) * canvas.height);
    if (!running()) draw();
  };
  const leave = () => koi.pointer(null, null);
  const key = event => {
    if (!surfaceActive) return;
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault(); interact(canvas.width / 2, canvas.height / 2);
  };
  const control = event => {
    if (!surfaceActive) return;
    const action = event.target.closest('[data-courtyard-control]')?.dataset.courtyardControl;
    if (action === 'rain') {
      rain = !rain; rainCanvas.hidden = !rain;
      rainButton.textContent = rain ? '关闭雨' : '开启雨'; rainButton.setAttribute('aria-pressed', String(rain));
      host.dataset.courtyard = rain ? 'rain' : 'koi';
      soundButton.disabled = !rain;
      controls.querySelector('[data-courtyard-control="interact"]').disabled = !rain;
      controls.querySelectorAll('[data-palette]').forEach(button => { button.disabled = !rain; });
      if (!rain) stopSound();
      status.textContent = rain ? '雨落池塘' : '雨已停 · 仍可投喂和寻找锦鲤';
      draw();
    }
    if (action === 'sound') void toggleSound();
    if (action === 'feed') interact(canvas.width / 2, canvas.height / 2);
    if (action === 'pause') { paused = !paused; sync(); }
    if (action === 'palette' && rain) { const palette = event.target.closest('button').dataset.palette; engine.setPalette(palette); controls.querySelectorAll('[data-palette]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.palette === palette))); draw(); }
    if (action === 'interact') {
      if (rain) {
        settings.intensity = settings.intensity === 40 ? 80 : 40;
        event.target.closest('button').textContent = settings.intensity === 40 ? '雨势：细雨' : '雨势：大雨';
        engine.setIntensity(settings.intensity); syncRainSound(); draw();
      } else interact(canvas.width / 2, canvas.height / 2);
    }
  };
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  observer?.observe(scene);
  if (!observer) window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', pointer); canvas.addEventListener('keydown', key);
  canvas.addEventListener('pointermove', hover); canvas.addEventListener('pointerleave', leave);
  controls.addEventListener('click', control);
  const unsubscribePerformance = onPerformanceSettingsChange(() => { resize(); sync(); });
  function dispose() {
    if (disposed) return;
    disposed = true;
    backdropRecovery.dispose();
    activity?.dispose(); activity = null;
    unsubscribePerformance();
    clearTimeout(feedbackTimer);
    if (frame) cancelAnimationFrame(frame); frame = 0;
    observer?.disconnect(); window.removeEventListener('resize', resize);
    canvas.removeEventListener('pointerdown', pointer); canvas.removeEventListener('keydown', key);
    canvas.removeEventListener('pointermove', hover); canvas.removeEventListener('pointerleave', leave);
    controls.removeEventListener('click', control);
    if (image) { image.onload = null; image = null; }
    stopSound();
    engine.dispose();
    koi.dispose(); rainCanvas.width = rainCanvas.height = 1;
    canvas.width = canvas.height = 1;
    if (backdrop) backdrop.width = backdrop.height = 1;
  }
  activity = watchSurfaceActivity(host, {
    onChange:value => { surfaceActive = value; sync(); },
    onRefresh:() => {
      if (disposed) return;
      if (departed()) dispose();
      else if (lastReduced !== reducedMotion()) sync();
    },
  });
  if (disposed) activity.dispose();
  return dispose;
}
