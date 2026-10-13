import { assetUrl } from '../core/asset-url.js';
import { RainSimulation, Droplet } from './courtyard-vendor/RainSimulation.js';
import { RainRenderer } from './courtyard-vendor/RainRenderer.js';
import { createKoiPond } from './courtyard-vendor/KoiPond.js';

export function courtyardV3HTML(view = 'rain') {
  const rain = view !== 'koi';
  return `<section class="courtyard-v3" data-courtyard="${rain ? 'rain' : 'koi'}">
    <header class="courtyard-v3-heading"><h2>${rain ? '听雨' : '锦鲤池'}</h2><div class="courtyard-v3-controls">
      <button type="button" data-courtyard-control="interact">${rain ? '雨势：细雨' : '投喂'}</button>
      <button type="button" data-courtyard-control="sound" aria-pressed="false">声音：关</button>
      <button type="button" data-courtyard-control="pause" aria-pressed="false">暂停</button>
    </div></header>
    <div class="courtyard-v3-scene">${rain ? '<canvas class="courtyard-v3-backdrop" aria-hidden="true"></canvas>' : ''}
      <canvas class="courtyard-v3-canvas" tabindex="0" role="button" aria-label="${rain ? '雨窗：点击落下雨滴' : '锦鲤池：点击水面投喂'}"></canvas>
      <span class="courtyard-v3-status" role="status" aria-live="polite"></span>
    </div>
  </section>`;
}

// 生命周期由基地独立页负责；返回的清理函数可重复调用。
export function mountCourtyardV3(root, view = 'rain') {
  const host = root.matches?.('[data-courtyard]') ? root : root.querySelector('[data-courtyard]');
  if (!host) return () => {};
  const rain = view !== 'koi';
  const canvas = host.querySelector('.courtyard-v3-canvas');
  const backdrop = host.querySelector('.courtyard-v3-backdrop');
  const scene = host.querySelector('.courtyard-v3-scene');
  const status = host.querySelector('.courtyard-v3-status');
  const controls = host.querySelector('.courtyard-v3-controls');
  const pauseButton = controls.querySelector('[data-courtyard-control="pause"]');
  const soundButton = controls.querySelector('[data-courtyard-control="sound"]');
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reducedMotion = () => !!media?.matches || document.body.classList.contains('reduce-motion');
  if (!canvas.getContext('2d')) {
    status.textContent = '当前浏览器无法显示庭院';
    controls.querySelectorAll('button').forEach(button => { button.disabled = true; });
    return () => {};
  }
  const settings = {
    intensity: 40, dropletSize: 4, windSpeed: 12, windAngle: 8, trailPersistence: 45,
    glassWetness: 40, gravity: 4, surfaceTension: 6, thunder: false, thunderFrequency: 0,
    bokehIntensity: 0, fogDensity: 0, glassBlur: 5, gustiness: 40, condensation: 20,
  };
  let disposed = false, paused = false, frame = 0, previous = 0, image = null;
  let soundEnabled = false, audio = null, noise = null;
  let engine = null, renderer = null;
  const running = () => !disposed && !paused && !document.hidden && !reducedMotion();
  const draw = (dt = 0, animate = false) => {
    if (!engine || disposed) return;
    if (rain) {
      if (animate) engine.update(dt * 1000, settings);
      const beads = engine.getTrailBeads();
      if (beads.length > 260) beads.splice(0, beads.length - 260);
      renderer.render(engine.getDroplets(), beads, { x: .3, y: .2, intensity: .7 });
    } else engine.render(dt, animate);
  };
  const drawBackdrop = () => {
    if (!rain || !renderer || disposed) return;
    const context = backdrop.getContext('2d');
    context.fillStyle = '#293f49'; context.fillRect(0, 0, backdrop.width, backdrop.height);
    if (image?.complete && image.naturalWidth) renderer.drawBackground('custom', image, 5);
  };
  const resize = () => {
    if (disposed) return;
    const bounds = scene.getBoundingClientRect();
    // 受控像素预算；仅绘制当前窗口，不启动隐藏副场景。
    const scale = Math.min(1.25, window.devicePixelRatio || 1, 1500 / Math.max(1, bounds.width));
    const width = Math.max(1, Math.round(bounds.width * scale));
    const height = Math.max(1, Math.round(bounds.height * scale));
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width; canvas.height = height;
    if (rain) {
      backdrop.width = width; backdrop.height = height;
      engine?.resize(width, height); renderer?.resize(width, height);
      if (engine) { engine.reset(); engine.populate(settings); }
      drawBackdrop();
    } else engine?.resize(width, height);
    draw();
  };
  resize();
  if (rain) {
    engine = new RainSimulation(90, 12, true);
    renderer = new RainRenderer(canvas, backdrop);
    engine.resize(canvas.width, canvas.height); renderer.resize(canvas.width, canvas.height);
    engine.populate(settings);
    image = new Image();
    image.onload = () => { drawBackdrop(); draw(); };
    image.src = assetUrl('assets/scenes/winter-expedition/greenhouse.webp');
    drawBackdrop();
  } else engine = createKoiPond(canvas);
  draw();
  const stopSound = () => {
    try { noise?.stop(); } catch { /* 尚未启动的音源也须继续释放上下文。 */ }
    noise?.disconnect(); noise = null;
    const oldAudio = audio; audio = null;
    oldAudio?.close().catch(() => {});
    soundEnabled = false; soundButton.textContent = '声音：关'; soundButton.setAttribute('aria-pressed', 'false');
  };
  const soundState = () => {
    if (!audio) return;
    const operation = document.hidden || paused ? audio.suspend() : audio.resume();
    operation.catch(() => {});
  };
  const toggleSound = () => {
    if (audio) { stopSound(); return; }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) { soundButton.textContent = '声音不可用'; soundButton.disabled = true; return; }
    try {
      audio = new Audio();
      const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
      const samples = buffer.getChannelData(0);
      let smooth = 0;
      for (let i = 0; i < samples.length; i++) { smooth = .97 * smooth + .03 * (Math.random() * 2 - 1); samples[i] = rain ? smooth * 4 : smooth * 2.5; }
      noise = audio.createBufferSource(); noise.buffer = buffer; noise.loop = true;
      const filter = audio.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = rain ? 1600 : 500;
      const gain = audio.createGain(); gain.gain.value = .06;
      noise.connect(filter); filter.connect(gain); gain.connect(audio.destination); noise.start();
      soundEnabled = true; soundButton.textContent = '声音：开'; soundButton.setAttribute('aria-pressed', 'true');
      status.textContent = '';
      soundState();
    } catch { stopSound(); status.textContent = '声音暂不可用'; }
  };
  const loop = time => {
    frame = 0;
    if (!host.isConnected) { dispose(); return; }
    if (!running()) return;
    if (!previous || time - previous >= 32) {
      draw(previous ? Math.min(.05, (time - previous) / 1000) : 1 / 30, true);
      previous = time;
    }
    frame = requestAnimationFrame(loop);
  };
  const sync = () => {
    if (disposed) return;
    if (frame) cancelAnimationFrame(frame);
    frame = 0; previous = 0;
    const reduced = reducedMotion();
    host.classList.toggle('is-still', reduced || paused);
    pauseButton.textContent = reduced ? '静态' : paused ? '继续' : '暂停';
    pauseButton.disabled = reduced; pauseButton.setAttribute('aria-pressed', String(paused));
    if (running()) frame = requestAnimationFrame(loop);
    else draw();
    if (soundEnabled) soundState();
  };
  const interact = (x, y) => {
    if (disposed) return;
    if (rain) {
      const droplets = engine.getDroplets();
      if (droplets.length >= engine.maxDroplets) droplets.shift();
      const droplet = new Droplet(x, y, 24, settings); droplet.opacity = 1; droplets.push(droplet);
    } else engine.tap(x, y);
    draw();
  };
  const pointer = event => {
    const bounds = canvas.getBoundingClientRect();
    interact((event.clientX - bounds.left) / Math.max(1, bounds.width) * canvas.width,
      (event.clientY - bounds.top) / Math.max(1, bounds.height) * canvas.height);
  };
  const key = event => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault(); interact(canvas.width / 2, canvas.height / 2);
  };
  const control = event => {
    const action = event.target.closest('[data-courtyard-control]')?.dataset.courtyardControl;
    if (action === 'sound') void toggleSound();
    if (action === 'pause') { paused = !paused; sync(); }
    if (action === 'interact') {
      if (rain) {
        settings.intensity = settings.intensity === 40 ? 80 : 40;
        event.target.closest('button').textContent = settings.intensity === 40 ? '雨势：细雨' : '雨势：大雨';
        engine.reset(); engine.populate(settings); draw();
      } else interact(canvas.width / 2, canvas.height / 2);
    }
  };
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  const motionObserver = typeof MutationObserver !== 'undefined' ? new MutationObserver(sync) : null;
  observer?.observe(scene);
  motionObserver?.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  if (!observer) window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', pointer); canvas.addEventListener('keydown', key);
  controls.addEventListener('click', control); document.addEventListener('visibilitychange', sync);
  media?.addEventListener?.('change', sync);
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (frame) cancelAnimationFrame(frame); frame = 0;
    observer?.disconnect(); motionObserver?.disconnect(); window.removeEventListener('resize', resize);
    canvas.removeEventListener('pointerdown', pointer); canvas.removeEventListener('keydown', key);
    controls.removeEventListener('click', control); document.removeEventListener('visibilitychange', sync);
    media?.removeEventListener?.('change', sync);
    if (image) { image.onload = null; image = null; }
    stopSound();
    if (rain) { engine.reset(); renderer.clear(); } else engine.dispose();
    canvas.width = canvas.height = 1;
    if (backdrop) backdrop.width = backdrop.height = 1;
  }
  sync();
  return dispose;
}
