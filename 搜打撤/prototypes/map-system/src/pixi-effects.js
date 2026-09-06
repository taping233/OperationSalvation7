const SDT = window.SDT = window.SDT || {};
let appPromise = null;
let dotTexture = null;
let activeBursts = 0;

function ensureApp() {
  if (appPromise) return appPromise;
  appPromise = (async () => {
    const { Application, Container, Graphics } = await import('pixi.js');
    const host = document.createElement('div');
    host.id = 'pixiFx';
    host.hidden = true;
    host.setAttribute('aria-hidden', 'true');
    document.body.appendChild(host);
    const app = new Application({ resizeTo: window, backgroundAlpha: 0, antialias: true, autoStart: false });
    host.appendChild(app.view);
    // 白圆贴图：所有粒子共用一张纹理，靠 tint/color behavior 着色区分伤害类型
    const dot = new Graphics().beginFill(0xffffff).drawCircle(8, 8, 7).endFill();
    dotTexture = app.renderer.generateTexture(dot);
    dot.destroy();
    return { app, Container, host };
  })().catch(error => {
    console.warn('[SDT.VisualFX] PixiJS initialization failed:', error);
    appPromise = null;
    return null;
  });
  return appPromise;
}

// 命中爆发：扇形喷洒 + 重力下坠 + 渐隐（物理参数沿用原手写粒子手感）
async function burstAtElement(element, { color = 0xe0523c, count = 14 } = {}) {
  if (!element || document.hidden || (SDT.Motion && SDT.Motion.reduceMotion())) return;
  const rect = element.getBoundingClientRect();
  const runtime = await ensureApp();
  if (!runtime || !dotTexture) return;
  const { app, Container, host } = runtime;
  const { Emitter, upgradeConfig } = await import('@pixi/particle-emitter');
  const group = new Container();
  group.x = rect.left + rect.width / 2;
  group.y = rect.top + rect.height * 0.42;
  app.stage.addChild(group);
  const hex = '#' + color.toString(16).padStart(6, '0');
  const emitter = new Emitter(group, upgradeConfig({
    frequency: 0.002,          // 2ms 一粒，配合 emitterLifetime 构成短促爆发
    emitterLifetime: 0.06,
    maxParticles: Math.max(10, count * 3),
    pos: { x: 0, y: 0 },
    addAtBack: false,
    spawnType: 'point',
    lifetime: { min: 0.3, max: 0.55 },
    speed: { start: 240, end: 30, min_start: 90, max_start: 260 },
    startRotation: { min: 0, max: 360 },
    gravity: { x: 0, y: 300 },
    alpha: { start: 0.95, end: 0 },
    scale: { start: 0.42, end: 0.08, min_start: 0.3, max_start: 0.55 },
    color: { start: hex, end: hex },
  }, dotTexture));
  emitter.emit = true;
  activeBursts++;
  if (activeBursts === 1) {
    host.hidden = false;
    app.start();
  }
  let elapsed = 0;
  let finished = false;
  const tick = ticker => {
    const seconds = ticker.deltaMS / 1000;
    elapsed += ticker.deltaMS;
    emitter.update(seconds);
    if (elapsed >= 700) {
      if (finished) return;
      finished = true;
      app.ticker.remove(tick);
      emitter.destroy();
      group.destroy({ children: true });
      activeBursts = Math.max(0, activeBursts - 1);
      if (activeBursts === 0) {
        app.stop();
        host.hidden = true;
      }
    }
  };
  app.ticker.add(tick);
}

SDT.VisualFX = Object.freeze({ burstAtElement });

export { burstAtElement };
