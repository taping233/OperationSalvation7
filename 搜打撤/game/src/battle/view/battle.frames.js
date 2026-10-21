/** @typedef {import("./battle.dom.types.js").BattleElement} BattleElement */
import { createFrameAssets } from './battle.frame-assets.js';
import { recordFrameStage } from '../../core/flight-recorder.local.js';
import { RenderScheduler } from '../../core/render-scheduler.js';
import { getPerformanceSettings, getQualityPreset, onPerformanceSettingsChange } from '../../core/performance-settings.js';
import SDT from '../../core/sdt-facade.js';
import { assetUrl } from '../../core/asset-url.js';
import { on as busOn } from '../../core/event-bus.js';
import { rect as uiRect, scale as uiScale } from '../../ui/ui-scale.js';
import { demoMs, getPace } from '../runtime/battle.pace.js';
import { Random } from '../../core/random.js';
import { WU_FRAME_SEQUENCES, WU_FRAME_SIZE, wuTimeline } from './battle.frame-catalog.js';
import { CHANGWUYU_FRAME_SEQUENCES, CHANGWUYU_FRAME_SIZE, changwuyuTimeline } from './battle.frame-catalog-changwuyu.js';
import { THREE_ROLE_FRAME_SEQUENCES, THREE_ROLE_FRAME_SIZE, threeRoleTimeline } from './battle.frame-catalog-three-role.js';
import { registerDefeatPresenter } from '../core/battle.presentation.js';
import { loadFrameRenderer } from './battle.frame-renderer.js';
import { framesDiagnosticStatic, summarizeFrameTextures } from './battle.frames-diagnostic-policy.js';
import { frameResolutionFor, resizeFrameSurface } from './battle.frame-resolution.js';
import { cueAction, frameImpactRemaining } from './battle.action-timing.js';

// ---------- 战斗单位序列帧播放器（批次D：Pixi 材质层） ----------
// 定调（老板 2026-09-12）：动画路线 = Pixi 材质层 + 序列帧，跳过 Spine；敌人本轮不上序列帧；
// 帧数按实际资产来（老板 09-12 追加定调：GPT 帧图分批交付，播放器有几帧播几帧，
// 不再假设固定 6 帧）。程序化位移（受击抖动 fx-hit-self / 回合沉浮）留在 DOM
// 常驻节点上走合成器，本模块只负责「立绘内容」的帧切换——每 tick 读 figure 的
// getBoundingClientRect（含 transform）跟随，抖动/沉浮时序列帧内容跟着 DOM 一起动。
// 五位角色：sprite-v1 去重帧库，采用原稿时间步和固定画布/脚底；死亡末帧保持到结算切页。
// 角色无帧集 / 纹理未就绪 / 加载失败：不隐藏原 img，静态立绘兜底。
// 省电策略（三铁律：不出画面不渲染）：静止期 renderer 停止，低频轮询 rect；rect 变化或
// 切帧才拉起渲染。document.hidden 时整体暂停。
// 帧缺失容错：动作里某帧加载失败就跳过该帧；整个动作没帧则该动作不播（不罢工）。

// 保留重复字节的帧槽与原有顺序；清单只避免请求未交付文件，不改变动作节奏。
const FRAME_SEQUENCES = {
  wu: WU_FRAME_SEQUENCES,
  changwuyu: CHANGWUYU_FRAME_SEQUENCES,
  ...THREE_ROLE_FRAME_SEQUENCES,
};
const HAS_FRAMES = new Set(Object.keys(FRAME_SEQUENCES));
const fixedFrameRole = role => role === 'wu' || role === 'changwuyu' || Object.hasOwn(THREE_ROLE_FRAME_SEQUENCES, role);
const FRAME_H = 760, FRAME_W = 512;        // 烘焙画布尺寸
const GEO_TUNE = 1.02;                     // 人物等高对齐静态立绘的视觉微调（沿用旧画布口径）
// 帧节奏：每动作总时长（ms），均分到实际存在的帧上——攻击快、施法舒展、呼吸慢循环
const SEQ_MS = { idle: 2900, 'atk-wind': 320, 'atk-hit': 280, hurt: 420, cast: 800 };
const LOAD_BATCH = 3;                      // 限制同时解码的纹理数，仍按候选顺序登记帧
const POLL_MS = 200;                       // 静止期 rect 轮询间隔
// 播放语义：atk = 起手连命中；cast / hurt 单段；idle 常驻循环
const ACT_SEQS = {
  atk: ['atk-wind', 'atk-hit'],
  cast: ['cast'],
  hurt: ['hurt'],
};

const frameDrawScheduler = new RenderScheduler({ activeFps: getPerformanceSettings().fps });
let liveFrameApp = null;
let appPromise = null;      // { app, host }
let texSets = new Map();    // role -> { ready, complete, cancelled, set, seqs, urls, boxes }
let sprite = null;
let emptyTexture = null;
let cur = null;             // { role, fig, img, set, seqs, play, fi, tNext, lastRect }
let pausedAt = 0;
let suspended = null;       // Only a retained same-battle settings scene may keep textures while covered.
let wanted = false;         // 已 attach（战斗进行中）
let pollTimer = 0;
let renderHoldT = 0;
let lifecycle = 0;
let releasePromise = null;
const frameAssets = createFrameAssets();
let tickGeometry = null;
let diagnosticPhase = 'before-entry';
let rendererBackend = 'none';
function setDiagnosticPhase(value) {
  if (diagnosticPhase === value) return;
  diagnosticPhase = value;
  if (import.meta.env.DEV) recordFrameStage(value, cacheStats());
}
const staticDiagnostic = () => framesDiagnosticStatic(import.meta.env.DEV, typeof location === 'undefined' ? '' : location.search);

function frameResolution() {
  return frameResolutionFor(window.devicePixelRatio, uiScale(), getQualityPreset().backdropScale);
}

function syncFrameSurface(checkSize = false) {
  const renderer = liveFrameApp?.renderer;
  if (!renderer) return;
  const resolution = frameResolution();
  // Active ticks only compare numbers; layout dimensions are read on change.
  if (!checkSize && renderer.resolution === resolution) return;
  const overlay = document.getElementById('overlay');
  const width = overlay ? overlay.clientWidth : window.innerWidth;
  const height = overlay ? overlay.clientHeight : window.innerHeight;
  if (!resizeFrameSurface(renderer, resolution, width, height)) return;
  frameDrawScheduler.invalidate();
  if (cur) { cur.dirty = true; wakeRenderer(); }
}
onPerformanceSettingsChange(({ fps }) => {
  frameDrawScheduler.activeInterval = 1000 / fps;
  frameDrawScheduler.invalidate();
  if (!liveFrameApp) return;
  syncFrameSurface(true);
  if (cur) { cur.dirty = true; wakeRenderer(); }
});

function cancelTextureRecord(record) {
  if (record.cancelled) return;
  record.cancelled = true;
  record.controller.abort();
}

function releaseTextureSets() {
  if (releasePromise) return releasePromise;
  const entries = [...texSets];
  texSets.clear();
  for (const [, record] of entries) cancelTextureRecord(record);
  if (!entries.length) return Promise.resolve();

  const pending = (async () => {
    const { Texture } = await import('pixi.js');
    // Detach the sprite before disposing completed URLs; pending loads clean up on arrival.
    if (sprite) sprite.texture = Texture.EMPTY;
    await Promise.all(entries.map(([, record]) => frameAssets.release(record)));
  })().finally(() => {
    if (releasePromise === pending) releasePromise = null;
  });
  releasePromise = pending;
  return pending;
}

async function evictOtherTextureSets(keepRole, Texture) {
  const evictions = [];
  for (const [role, record] of texSets) {
    if (role === keepRole) continue;
    texSets.delete(role);
    cancelTextureRecord(record);
    if (sprite && cur?.role === role) sprite.texture = Texture.EMPTY;
    evictions.push(frameAssets.release(record));
  }
  await Promise.all(evictions);
}

// 保留原装载优先级：动作依 ACTIONS 排列，idle-breathe 最后加载。
function candidateNames(role) {
  const names = Object.values(FRAME_SEQUENCES[role]).flat();
  return [...new Set([...names.filter(name => name !== 'idle-breathe'), ...names.filter(name => name === 'idle-breathe')])];
}

function reduceMotion() {
  return !!(SDT.Motion && SDT.Motion.reduceMotion && SDT.Motion.reduceMotion());
}

// —— 人物包围盒测量（帧/立绘构图归一化的依据） ——
// 这批序列帧是独立重烘的，人物在 512×760 画布中的占比帧与帧、角色与角色都不一致
// （idle 69%~98%，立绘 94%~100%），整画布等比贴放会在切帧/进出动作时人物忽大忽小。
// 逐帧量 alpha 包围盒后按「人物实际显示高恒定」反推画布缩放，战斗演出才稳定。
const SAMPLE = 4, ALPHA_MIN = 8;
function measureAlphaBox(source, w, h) {
  const sw = Math.max(1, Math.ceil(w / SAMPLE)), sh = Math.max(1, Math.ceil(h / SAMPLE));
  const cv = document.createElement('canvas');
  cv.width = sw; cv.height = sh;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  if (!cx) return null;
  cx.drawImage(source, 0, 0, sw, sh);
  let data;
  try { data = cx.getImageData(0, 0, sw, sh).data; } catch { return null; }
  let x0 = sw, y0 = sh, x1 = -1, y1 = -1;
  for (let y = 0; y < sh; y++) {
    const row = y * sw;
    for (let x = 0; x < sw; x++) {
      if (data[(row + x) * 4 + 3] >= ALPHA_MIN) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const kx = w / sw, ky = h / sh;
  return { x0: x0 * kx, y0: y0 * ky, x1: (x1 + 1) * kx, y1: (y1 + 1) * ky };
}

// 立绘人物高占立绘画布高的比例（静态立绘 ≈ 满高 0.94~1.0），按角色缓存
const portraitFillCache = new Map();
async function portraitFillOf(role, img) {
  if (portraitFillCache.has(role)) return portraitFillCache.get(role);
  let fill = 1;
  try {
    if (!img.complete && img.decode) await img.decode().catch(() => {});
    if (img.complete && img.naturalWidth) {
      const box = measureAlphaBox(img, img.naturalWidth, img.naturalHeight);
      if (box && box.y1 > box.y0) fill = Math.min(1, (box.y1 - box.y0) / img.naturalHeight);
    }
  } catch { /* 量不出按满高处理 */ }
  portraitFillCache.set(role, fill);
  return fill;
}

function ensureApp() {
  if (appPromise) return appPromise;
  setDiagnosticPhase('renderer-loading');
  let host, app, resizeObserver, createdSprite;
  appPromise = (async () => {
    const { Application, Sprite, Texture, RENDERER_TYPE } = await loadFrameRenderer();
    const ov = document.getElementById('overlay');
    host = document.createElement('div');
    host.id = 'unitFrames';
    host.hidden = true;
    host.setAttribute('aria-hidden', 'true');
    // 铺满 overlay 的绝对层：canvas 与 overlay 坐标一一对应（sprite 直接用视口 rect 定位）；
    // z-index 6：盖过单位区(2)/手牌常态，低于 hover 卡(9+)/aimArrow(60)/红闪(70)/飘字(80)
    host.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:6;';
    if (ov) ov.appendChild(host);
    setDiagnosticPhase('app-init');
    app = new Application({
      // antialias 关闭：帧图是预烘 webp 纹理，纹理采样自带双线性过滤，MSAA 对
      // 纹理四边形毫无收益，只烧全屏 MSAA 带宽。
      // Own sizing below: Pixi's ResizePlugin would resize again and render outside our budget.
      resizeTo: null, backgroundAlpha: 0, antialias: false,
      // backing 按 DPR×UiScale（允许小于1）采样，仍受所选画质上限约束；
      // autoDensity 保持 canvas CSS 尺寸=逻辑尺寸，显示仍由 html zoom 等比缩放
      resolution: frameResolution(),
      autoDensity: true,
      autoStart: false, powerPreference: 'low-power',
    });
    host.dataset.renderer = app.renderer.type === RENDERER_TYPE.CANVAS ? 'canvas' : app.renderer.type === RENDERER_TYPE.WEBGL ? 'webgl' : 'unknown';
    rendererBackend = host.dataset.renderer;
    host.appendChild(app.view);
    createdSprite = new Sprite();
    sprite = createdSprite;
    emptyTexture = Texture.EMPTY;
    sprite.anchor.set(0.5, 1);   // 底部中心锚点：脚底对齐
    app.stage.addChild(sprite);
    // 序列帧节奏最慢 ~1.5s/帧，30fps 上限足够顺滑：不设限就会在 120Hz 屏上按刷新率
    // 全速渲染全屏透明画布（120 次合成/秒）白烧 GPU。配合脏标记跳帧见 ticker。
    // Keep the original timeline clock; only GPU submission observes the user budget.
    app.ticker.maxFPS = 30;
    // Pixi installs an automatic render callback; remove it so our dirty/budget gate is authoritative.
    app.ticker.remove?.(app.render, app);
    liveFrameApp = app;
    syncFrameSurface(true);
    setDiagnosticPhase('app-ready');
    // 画布尺寸变化会清空 WebGL 后备缓冲：置脏补一帧，否则脏标记跳帧会在
    // resize 后留一帧空画布。
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => { if (cur) cur.dirty = true; });
      resizeObserver.observe(app.view);
    }
    return { app, host };
  })().catch(error => {
    // 初始化失败只清理这次创建的资源；重试不能留下重复宿主或旧观察器。
    liveFrameApp = null;
    rendererBackend = 'none';
    resizeObserver?.disconnect();
    try { app?.destroy(true, { children: true }); } catch { /* 部分初始化的应用可能无法销毁 */ }
    host?.remove();
    if (sprite === createdSprite) { sprite = null; emptyTexture = null; }
    setDiagnosticPhase('failed');
    console.warn('[SDT.BattleFrames] PixiJS init failed:', error);
    appPromise = null;
    return null;
  });
  return appPromise;
}

function loadSet(role, battleToken) {
  if (texSets.has(role)) return texSets.get(role).ready;
  const perfProbeStarted = import.meta.env.DEV && new URLSearchParams(location.search).has('perfProbe')
    ? performance.now() : 0;
  let resolveReady;
  const record = { set: new Map(), boxes: new Map(), seqs: new Map(), cancelled: false,
    battleToken, controller: new AbortController(),
    ready: new Promise(resolve => { resolveReady = resolve; }), complete: null };
  // 新角色在同步段取消旧任务，避免初始化期间两个角色互等卸载。
  for (const [otherRole, other] of texSets) if (otherRole !== role) cancelTextureRecord(other);
  texSets.set(role, record);
  const phase = value => { if (!record.cancelled && texSets.get(role) === record) setDiagnosticPhase(value); };
  const refreshSequences = () => {
    for (const [action, names] of Object.entries(FRAME_SEQUENCES[role])) {
      const frames = names.filter(name => record.set.has(name));
      if (frames.length) record.seqs.set(action, frames);
    }
  };
  record.complete = (async () => {
    const rt = await ensureApp();
    if (!rt || record.cancelled) return;
    const { Assets, Texture } = await import('pixi.js');
    // 序列帧纹理是 GPU/解码内存的大头。只保留最近
    // 使用角色；切换角色时卸载旧套，避免长局把所有角色纹理永久累积。
    await evictOtherTextureSets(role, Texture);
    if (record.cancelled) return;
    const loadCandidate = async (name, measureBox = !fixedFrameRole(role)) => {
      const url = assetUrl(`assets/portraits/frames/${role}/${name}.webp`);
      // Fixed-canvas roles use only their first available idle box in applyFrame.
      // Other textures must not also decode a separate measurement bitmap.
      // Non-fixed roles retain per-frame geometry probes without relying on Pixi internals.
      const boxProbe = measureBox ? (async () => {
        const resp = await fetch(url, { signal: record.controller.signal });
        const bmp = await createImageBitmap(await resp.blob());
        try { return record.cancelled ? null : measureAlphaBox(bmp, bmp.width, bmp.height); }
        finally { bmp.close(); }
      })().catch(() => null) : Promise.resolve(null);
      // fetch 可取消，位图解码本身不可取消；停止等待但仍接住迟到位图并释放它。
      const boxP = new Promise(resolve => {
        const signal = record.controller.signal;
        const finish = box => { signal.removeEventListener('abort', cancel); resolve(box); };
        const cancel = () => finish(null);
        if (signal.aborted) { resolve(null); return; }
        signal.addEventListener('abort', cancel, { once: true });
        boxProbe.then(finish);
      });
      try {
        const tex = await frameAssets.load(url, record, Assets);
        if (!tex || record.cancelled) return null;
        return { name, url, tex, box: await boxP };
      } catch { return null; } // 探测：没这帧就跳过
    };
    const add = entry => {
      if (!entry || record.cancelled) return;
      record.set.set(entry.name, entry.tex);
      record.boxes.set(entry.name, entry.box);
    };
    // 首个可用 idle 就是入场所需帧；剩余纹理不阻塞 attach 的首画面提交。
    phase('idle-loading');
    const triedIdle = new Set();
    for (const name of FRAME_SEQUENCES[role].idle) {
      if (record.cancelled) return;
      if (triedIdle.has(name)) continue;
      triedIdle.add(name);
      add(await loadCandidate(name, true));
      if (record.set.size) break;
    }
    if (record.cancelled || !record.set.size) { phase('failed'); return; }
    refreshSequences();
    phase('idle-ready');
    resolveReady(record);
    const candidates = candidateNames(role).filter(name => !triedIdle.has(name));
    for (let i = 0; i < candidates.length && !record.cancelled; i += LOAD_BATCH) {
      phase('frame-batch');
      const batch = await Promise.all(candidates.slice(i, i + LOAD_BATCH).map(name => loadCandidate(name)));
      batch.forEach(add);
      if (!record.cancelled) refreshSequences();
    }
    phase('all-ready');
  })().catch(() => { phase('failed'); }).finally(() => resolveReady(null));
  if (perfProbeStarted) record.ready.then(result => {
    const ended = performance.now();
    try { performance.measure('sdt:battle-frames-' + role, { start: perfProbeStarted, end: ended }); }
    catch { /* 老浏览器不支持 start/end 对象时只输出控制台测量。 */ }
    console.info('[vite-perf-frames]', JSON.stringify({ role, durationMs: +(ended - perfProbeStarted).toFixed(1),
      frames: result?.set.size || 0, ready: !!result }));
  });
  return record.ready;
}

function isLiveBattleFigure(body, fig) {
  const currentBody = document.getElementById('ovBody');
  const overlay = document.getElementById('overlay');
  return !!(body && fig && wanted && overlay && !overlay.hidden && overlay.contains(body)
    && fig.isConnected && body === currentBody && body.contains(fig) && fig.closest('.battle-stage.sts'));
}

function hostVisible(v) {
  if (!appPromise) return;
  const token = lifecycle;
  appPromise.then(rt => { if (rt && token === lifecycle) rt.host.hidden = !v; });
}

// —— 渲染开关：静止期停 renderer，仅低频轮询 ——
function wakeRenderer(holdMs = 350) {
  if (!appPromise) return;
  const token = lifecycle;
  appPromise.then(rt => {
    if (!rt || !wanted || token !== lifecycle) return;
    const { app } = rt;
    app.start();
    clearTimeout(renderHoldT);
    renderHoldT = setTimeout(() => { if (!cur || !cur.play) app.stop(); }, holdMs);
  });
}

function setTexture(tex) {
  if (!sprite || !tex || sprite.texture === tex) return;
  sprite.texture = tex;
  if (cur) cur.dirty = true;
}

function layout(preRead) {
  if (!cur || !cur.fig || !cur.fig.isConnected) return;
  const r = preRead || uiRect(cur.fig);   // 布局口径：sprite 坐标是 Pixi stage 布局值；调用方已读时可传入复用
  if (r.width <= 0) return;
  const lr = cur.lastRect;
  if (!lr || r.left !== lr[0] || r.top !== lr[1] || r.width !== lr[2] || r.height !== lr[3]) {
    cur.dirty = true;   // 位/尺寸变了才需要重画；sprite 属性照常赋值（幂等）
  }
  // 人物等高锚定：「人物实际显示高」= 静态立绘显示高 × 立绘人物占比 × GEO_TUNE，
  // 帧间恒定；当前帧画布按人物包围盒反向放大（h = baseCharH × 760/人物高），
  // 人物脚底贴 img 底边（帧内脚底不在画布底时锚点相应上移）。
  cur.baseCharH = r.height * cur.portraitFill * (fixedFrameRole(cur.role) ? 1 : GEO_TUNE);
  cur.imgBottom = r.top - cur.ovTop + r.height;
  cur.centerX = r.left - cur.ovLeft + r.width / 2;
  const box = cur.curBox;
  const size = cur.role === 'wu' ? WU_FRAME_SIZE : cur.role === 'changwuyu' ? CHANGWUYU_FRAME_SIZE
    : Object.hasOwn(THREE_ROLE_FRAME_SEQUENCES, cur.role) ? THREE_ROLE_FRAME_SIZE : { width: FRAME_W, height: FRAME_H };
  // 包围盒探测失败仍以实际帧画布绘制，不能把首帧承诺兑现成空人物。
  const bounds = box && box.y1 > box.y0 ? box : { y0: 0, y1: size.height };
  if (fixedFrameRole(cur.role)) cur.imgBottom = r.top - cur.ovTop + r.height * bounds.y1 / size.height;
  const h = cur.baseCharH * (size.height / (bounds.y1 - bounds.y0));
  sprite.height = h;
  sprite.width = h * (size.width / size.height);
  sprite.x = cur.centerX;
  sprite.y = cur.imgBottom + (size.height - bounds.y1) / size.height * h;
  cur.lastRect = [r.left, r.top, r.width, r.height];
}

function applyFrame(name) {
  if (!cur || !cur.set) return;
  const used = cur.set.has(name) ? name : cur.fallback;          // 缺帧兜底：待机基准帧
  const tex = cur.set.get(used);
  if (!tex) return;
  // 已统一画布和脚底的角色始终用待机包围盒，避免倒地后被放大。
  cur.curBox = (cur.boxes && cur.boxes.get(fixedFrameRole(cur.role) ? cur.fallback : used)) || null;
  const host = document.getElementById('unitFrames');
  if (host) host.dataset.frame = used;
  setTexture(tex);
  if (!tickGeometry) layout();
  wakeRenderer();
}

// 把一个触发动作展开成帧时间轴：{ list, dur, loop }（帧数按实际资产，总时长均分）
function buildTimeline(trigger) {
  if (!cur) return null;
  if (fixedFrameRole(cur.role)) {
    const timeline = cur.role === 'wu' ? wuTimeline(trigger, getPace()) : cur.role === 'changwuyu'
      ? changwuyuTimeline(trigger, getPace()) : threeRoleTimeline(cur.role, trigger, getPace());
    if (!timeline) return null;
    const available = timeline.list.map((name, index) => ({ name, ms: timeline.dur[index] }))
      .filter(frame => cur.set.has(frame.name));
    return available.length ? { ...timeline, list: available.map(frame => frame.name), dur: available.map(frame => frame.ms) } : null;
  }
  const seqNames = trigger === 'idle' ? ['idle'] : ACT_SEQS[trigger] || [trigger];
  const list = [], dur = [];
  for (const a of seqNames) {
    const frames = cur.seqs.get(a);
    if (!frames || !frames.length) continue;   // 该动作没帧：跳过（如 cast 未交付时不播施法）
    frames.forEach(f => { list.push(f); dur.push(demoMs(SEQ_MS[a]) / frames.length); });   // demoMs：2× 档同步缩放攻击序列总时长（battle.pace.js）
  }
  return list.length ? { list, dur, loop: trigger === 'idle' } : null;
}

function playSeq(trigger, phase = 0) {
  const tl = buildTimeline(trigger);
  if (!tl || !cur) return false;
  cur.play = tl;
  cur.action = trigger;
  const host = document.getElementById('unitFrames');
  if (host) { host.dataset.action = trigger; host.dataset.role = cur.role; }
  cur.fi = tl.loop ? Math.min(tl.list.length - 1, Math.floor(Math.max(0, phase) * tl.list.length)) : 0;
  applyFrame(tl.list[cur.fi]);
  cur.tNext = performance.now() + tl.dur[cur.fi];
  return true;
}

// —— 帧时间轴推进（ticker 回调驱动） ——
function advance(now) {
  const tl = cur && cur.play;
  if (!tl || pausedAt) return;
  if (now < cur.tNext) return;
  while (now >= cur.tNext) {
  cur.fi++;
  if (cur.fi >= tl.list.length) {
    if (tl.loop) { playSeq('idle'); return; }  // 下一个循环采用后台新补齐的待机帧。
    else if (tl.hold) {
      cur.fi = tl.list.length - 1;
      cur.play = null;
      cur.deathResolve?.();
      cur.deathResolve = null;
      return;
    }
    else if (cur.resumeAfter) {
      const resume = cur.resumeAfter;
      cur.resumeAfter = null;
      cur.play = resume.play;
      cur.fi = resume.fi;
      applyFrame(cur.play.list[cur.fi]);
      cur.tNext = now + cur.play.dur[cur.fi];
      return;
    } else { playSeq('idle', fixedFrameRole(cur.role) ? 0 : Random.random('fx')); return; }
  }
  applyFrame(tl.list[cur.fi]);
  cur.tNext += tl.dur[cur.fi];
  }
}

// Reuse the existing hide/release path when the preference changes mid-session.
function stopForReducedMotion() {
  if (!reduceMotion()) return false;
  hide();
  return true;
}

function tickLoop() {
  if (!wanted || !cur || document.hidden || stopForReducedMotion()) return;
  syncFrameSurface();
  const geometry = cur.fig && uiRect(cur.fig);
  tickGeometry = geometry;
  try { advance(performance.now()); }
  finally { tickGeometry = null; }
  if (cur && cur.fig) {
    const r = geometry;   // 同一 tick 切帧与 DOM 跟随共用一次布局读取
    const lr = cur.lastRect;
    if (cur.dirty || !lr || r.left !== lr[0] || r.top !== lr[1] || r.width !== lr[2] || r.height !== lr[3]) {
      layout(r);
      wakeRenderer();   // DOM 位移中（抖动/沉浮）持续跟随渲染
    }
  }
}

// Consume only the invalidation being painted. A render hook may dirty this frame
// again; never clear that newer work after render, and retain retries on failure.
function commitFrame(app) {
  const frame = cur;
  const presentation = frame?.presentation;
  if (frame) frame.dirty = false;
  try { app.renderer.render(app.stage); }
  catch (error) {
    if (cur === frame && frame) frame.dirty = true;
    throw error;
  }
  // Only an attach needs a handoff; ordinary animated paints do no extra DOM work.
  if (!presentation) return true;
  const { token, body, fig, img, battleToken } = presentation;
  if (cur !== frame || frame.presentation !== presentation || token !== lifecycle
      || frame.fig !== fig || frame.img !== img || imageOwners.get(img) !== token
      || /** @type {BattleElement} */ (fig.closest('.battle-stage'))?._battleToken !== battleToken
      || fig.querySelector('img') !== img || !isLiveBattleFigure(body, fig)) return false;
  const host = document.getElementById('unitFrames');
  if (!host) return false;
  host.hidden = false;
  img.style.visibility = 'hidden';
  frame.presentation = null;
  return true;
}

function startLoop() {
  appPromise.then(rt => {
    if (!rt) return;
    const { app } = rt;
    if (app._bfHooked) return;
    app._bfHooked = true;
    app.ticker.add(() => {
      tickLoop();
      // 脏标记跳帧：纹理与 rect 都没变的 tick 直接跳过 renderer.render，
      // 上一帧内容继续显示（两种 canvas 后端均保留已绘画面）；帧率按角色封顶。
      if (wanted && cur && cur.dirty && cur.fig && cur.fig.isConnected
          && frameDrawScheduler.shouldDraw(performance.now(), { active: true, covered: document.hidden })) {
        commitFrame(app);
      }
    });
    app.stop();   // autoStart=false：只在 wakeRenderer 拉起时跑
  });
  startGeometryPolling();
}

function stopGeometryPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = 0; }
}
function startGeometryPolling() {
  if (!pollTimer && wanted && cur && !document.hidden) {
    pollTimer = setInterval(() => {   // 静止期轮询：rect 变了（回合沉浮/hover）拉起渲染
      if (!wanted || !cur || document.hidden || stopForReducedMotion()) return;
      syncFrameSurface();
      const r = cur.fig && uiRect(cur.fig);   // 与 lastRect（布局口径）同尺比较
      if (!r || !r.width) return;
      const lr = cur.lastRect;
      if (!lr || r.left !== lr[0] || r.top !== lr[1] || r.width !== lr[2] || r.height !== lr[3]) {
        layout(r);
        wakeRenderer(500);
      }
    }, POLL_MS);
  }
}

// ---------- 对外接口 ----------

// 战斗渲染后调用：接管 #btSelf 的立绘为序列帧（无帧集/降动效时自动跳过）
let pendingAttach = null;
const imageOwners = new WeakMap();
function figureRole(img) {
  const key = /^battle-([a-z]+)$/.exec(String(img?.getAttribute('data-asset-key') || ''));
  const source = /portraits\/battle\/([a-z]+?)\.webp/.exec(String(img?.getAttribute('src') || ''));
  return key ? key[1] : source && source[1];
}
function attach(body) {
  const fig = /** @type {BattleElement} */ (body?.querySelector('#btSelf .sts-figure'));
  const img = /** @type {HTMLImageElement} */ (fig?.querySelector('img'));
  const role = figureRole(img);
  const stage = /** @type {BattleElement} */ (fig?.closest('.battle-stage'));
  const battleToken = stage?._battleToken;
  if (suspended) {
    const overlay = document.getElementById('overlay');
    const sameScene = suspended.stage === stage && suspended.battleToken === battleToken
      && suspended.body === body && stage?.isConnected && body === document.getElementById('ovBody')
      && overlay === suspended.overlay && overlay?.isConnected && !overlay.hidden && overlay.contains(body)
      && !body.querySelector('.battle-secondary-layer');
    if (!sameScene) hide();
    else {
      clearSuspension();
      wanted = true;
      setPaused(false);
      if (cur && (cur.fig !== fig || cur.img !== img)) clearCurrentFigure();
      // A warm return can commit the retained frame synchronously, without a blank reload window.
      if (cur?.fig === fig && cur.img === img && cur.role === role && cur.battleToken === battleToken
          && liveFrameApp && !reduceMotion() && !staticDiagnostic()) {
        imageOwners.set(img, lifecycle);
        cur.presentation = { token: lifecycle, body, fig, img, battleToken };
        syncFrameSurface(true); layout();
        if (!commitFrame(liveFrameApp)) return Promise.resolve(false);
        startGeometryPolling(); wakeRenderer(600);
        return Promise.resolve(true);
      }
    }
  }
  if (pendingAttach?.battleToken === battleToken && pendingAttach?.body === body && pendingAttach.fig === fig && pendingAttach.img === img && pendingAttach.role === role) return pendingAttach.promise;
  const request = { body, fig, img, role, battleToken, promise: null };
  pendingAttach = request;
  request.promise = attachCurrent(body).finally(() => { if (pendingAttach === request) pendingAttach = null; });
  return request.promise;
}
async function attachCurrent(body) {
  const token = ++lifecycle;
  wanted = true;
  const fig = body && /** @type {BattleElement} */ (body.querySelector('#btSelf .sts-figure'));
  const img = fig && /** @type {HTMLImageElement} */ (fig.querySelector('img'));
  if (!fig || !img) { hide(); return; }
  const role = figureRole(img);
  const stage = /** @type {BattleElement} */ (fig.closest('.battle-stage'));
  const battleToken = stage?._battleToken;
  const isCurrentFigure = () => stage?._battleToken === battleToken && isLiveBattleFigure(body, fig);
  if (cur && (cur.role !== role || cur.battleToken !== battleToken)) clearCurrentFigure();
  if (texSets.has(role) && texSets.get(role).battleToken !== battleToken) releaseTextureSets();
  if (!role || !HAS_FRAMES.has(role)) { hide(); return; }
  if (fixedFrameRole(role)) {
    // 统一静态兜底与序列帧，并保留原玩家槽位的立绘高度。
    fig.style.aspectRatio = '512 / 760';
    img.setAttribute('data-asset-key', `battle-${role}`);
    img.style.position = 'absolute'; img.style.height = '100%'; img.style.width = 'auto';
    img.style.left = '50%'; img.style.translate = '-50% 0';
    const source = assetUrl(`assets/portraits/frames/${role}/sprite-v1/neutral.webp`);
    if (img.getAttribute('src') !== source) img.setAttribute('src', source);
  }
  if (staticDiagnostic()) { hide('static'); return true; }
  if (reduceMotion()) { hide(); return; }
  // Keep the static portrait until this attachment successfully paints its first GPU frame.
  img.style.visibility = '';
  imageOwners.set(img, token);
  const restoreStatic = () => { if (imageOwners.get(img) === token) { img.style.visibility = ''; imageOwners.delete(img); } };
  const cancelled = () => token !== lifecycle || stopForReducedMotion();
  armBattleEndHide();
  if (releasePromise) await releasePromise;
  if (cancelled()) { restoreStatic(); return; }
  const rt = await ensureApp();
  if (!rt || cancelled()) { restoreStatic(); return false; }
  syncFrameSurface(true);
  const set = await loadSet(role, battleToken);
  // 资源探测是异步的：战斗可能已结束并切到搜刮/奖励页，旧 fig 即使仍有引用也不能复活帧层。
  if (!set || cancelled() || !isCurrentFigure()) { restoreStatic(); return false; }
  const fill = await portraitFillOf(role, img);
  // 量立绘占比也是异步的，fig 可能在等待期间随战斗结束被移除，复活前再查一次。
  if (cancelled() || !isCurrentFigure()) { restoreStatic(); return; }
  if (cur && cur.role === role) {
    // 同战斗内重渲染：只换 DOM 引用（ovBody 重建后 fig/img 是新节点），不重置播放状态，
    // 否则出牌结算的多次 render 会把正在播的攻击/受击动作打断
    cur.fig = fig; cur.img = img;
    cur.portraitFill = fill; cur.lastRect = null;
    cur.presentation = { token, body, fig, img, battleToken };
    layout();
    return commitFrame(rt.app);
  }
  const ov = document.getElementById('overlay');
  const ovR = ov ? uiRect(ov) : { left: 0, top: 0 };   // 布局口径：layout() 里 sprite 换算用
  cur = {
    role, battleToken, fig, img, presentation: { token, body, fig, img, battleToken }, set: set.set, seqs: set.seqs, boxes: set.boxes,
    portraitFill: fill, curBox: null, baseCharH: 0, imgBottom: 0, centerX: 0,
    play: null, fi: 0, tNext: 0, resumeAfter: null,
    fallback: set.seqs.get('idle')[0], lastRect: null, ovLeft: ovR.left, ovTop: ovR.top,
    dirty: true,   // 首帧必须渲染
  };
  rt.app.ticker.maxFPS = fixedFrameRole(role) ? 60 : 30;
  frameDrawScheduler.invalidate();
  startLoop();
  playSeq('idle', fixedFrameRole(role) ? 0 : Random.random('fx'));
  if (!commitFrame(rt.app)) return false;   // Readiness requires a successful current-owner paint.
  wakeRenderer(600);
  return true;
}

// 动作触发：'atk' 攻击（起手连命中）/ 'cast' 施法 / 'hurt' 受击
function play(name, { continueActive = false } = {}) {
  if (!wanted || !cur || !cur.set || cur.dying || document.hidden || stopForReducedMotion()) return false;
  if (!ACT_SEQS[name]) return false;
  if (continueActive && cur.action === name && cur.play && !cur.play.loop) return true;
  if (fixedFrameRole(cur.role)) {
    cur.resumeAfter = null;
    const played = playSeq(name);
    if (played) wakeRenderer(900);
    return played;
  }
  if (name !== 'idle') {
    if (cur.play?.loop) cur.resumeAfter = { play: cur.play, fi: cur.fi };
  } else {
    cur.resumeAfter = null;
  }
  const played = playSeq(name);
  wakeRenderer(900);
  return played;
}

export function actionImpactRemaining(cue, battleToken) {
  if (!wanted || !cur?.play || cur.battleToken !== battleToken || cur.dying || document.hidden
    || reduceMotion() || cur.action !== cueAction(cue) || !cur.fig?.isConnected) return null;
  return frameImpactRemaining({ role: cur.role, timeline: cur.play, index: cur.fi,
    nextAt: cur.tNext, now: pausedAt || performance.now() });
}

function presentDeath(player) {
  if (!wanted || !cur || !fixedFrameRole(cur.role) || document.hidden || reduceMotion()) return null;
  if (cur.dying) return cur.deathPromise;
  const timeline = buildTimeline('death');
  if (!timeline) return null;
  cur.dying = true; cur.resumeAfter = null;
  const health = /** @type {BattleElement} */ (cur.fig.closest('#btSelf')?.querySelector('.bt-hpwrap'));
  if (health) {
    const label = /** @type {BattleElement} */ (health.querySelector('span'));
    const maxHp = player?.maxHp ?? label?.textContent.split('/')[1];
    if (label && maxHp != null) label.textContent = `0/${maxHp}`;
    /** @type {NodeListOf<BattleElement>} */ (health.querySelectorAll(':scope > div')).forEach(bar => { bar.style.width = '0%'; });
  }
  cur.deathPromise = new Promise(resolve => { cur.deathResolve = resolve; });
  cur.deathStage = cur.fig.closest('.battle-stage');
  if (cur.deathStage) { cur.oldInert = cur.deathStage.inert; cur.deathStage.inert = true; }
  playSeq('death');
  wakeRenderer(1200);
  return cur.deathPromise;
}
registerDefeatPresenter(presentDeath);

function setPaused(paused) {
  if (paused) {
    if (!pausedAt) pausedAt = performance.now();
    return;
  }
  if (!pausedAt) return;
  const elapsed = Math.max(0, performance.now() - pausedAt);
  pausedAt = 0;
  if (cur && Number.isFinite(cur.tNext)) cur.tNext += elapsed;
}

// 仅同一场次复用动作；换场不能继承倒地锁或旧结算等待。
function clearCurrentFigure() {
  const host = document.getElementById('unitFrames');
  if (host) host.hidden = true;
  if (cur?.deathStage && cur.deathStage._battleToken === cur.battleToken) cur.deathStage.inert = cur.oldInert;
  cur?.deathResolve?.();
  if (cur?.img) cur.img.style.visibility = '';
  cur = null;
  if (sprite && emptyTexture) sprite.texture = emptyTexture;
}

function clearSuspension() {
  suspended?.observer.disconnect();
  suspended = null;
}

function suspendSettingsScene(mode) {
  const body = document.getElementById('ovBody');
  const overlay = document.getElementById('overlay');
  const layer = body?.querySelector('.battle-secondary-layer');
  // The full battle-settings presenter uses boolean wide mode; require its marker.
  if (mode !== 'settings' && !(mode === true && layer?.querySelector('.bt-settings'))) return false;
  const fig = pendingAttach?.fig || cur?.fig || suspended?.stage.querySelector('#btSelf .sts-figure');
  const stage = /** @type {BattleElement} */ (fig?.closest('.battle-stage.sts'));
  const battleToken = pendingAttach?.battleToken ?? cur?.battleToken ?? suspended?.battleToken;
  // The secondary layer is installed before showOverlay broadcasts; the scene stays connected.
  // The observer still validates its token and ownership at the next checkpoint.
  if (!overlay || !overlay.contains(body) || !layer || !stage || battleToken == null
      || stage._battleToken !== battleToken) return false;
  if (suspended?.stage === stage && suspended.battleToken === battleToken) return true;
  clearSuspension();
  lifecycle++;
  if (pendingAttach?.img) { pendingAttach.img.style.visibility = ''; imageOwners.delete(pendingAttach.img); }
  pendingAttach = null;
  wanted = false;
  setPaused(true);
  if (cur?.img) cur.img.style.visibility = '';
  const host = document.getElementById('unitFrames');
  if (host) host.hidden = true;
  clearTimeout(renderHoldT); renderHoldT = 0;
  stopGeometryPolling();
  liveFrameApp?.stop();
  const validateScene = () => {
    if (suspended?.stage === stage && (body !== document.getElementById('ovBody')
        || !stage.isConnected || stage._battleToken !== battleToken || !body.contains(stage)
        || overlay !== document.getElementById('overlay') || overlay.hidden || !overlay.contains(body))) hide();
  };
  const observer = new MutationObserver(validateScene);
  suspended = { body, stage, battleToken, overlay, observer };
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  queueMicrotask(validateScene);
  return true;
}

// Battle exit and unretained pages release resources; retained settings only suspend above.
/** @param {string | Event} [diagnostic] */
function hide(diagnostic = 'released') {
  clearSuspension();
  setPaused(false);
  lifecycle++;
  if (pendingAttach?.img) { pendingAttach.img.style.visibility = ''; imageOwners.delete(pendingAttach.img); }
  pendingAttach = null;
  wanted = false;
  clearCurrentFigure();
  clearTimeout(renderHoldT); renderHoldT = 0;
  // 先同步收起 overlay 直下的宿主，避免战斗结束后搜刮/奖励弹层出现一帧残留立绘；
  // 后续 attach 仍会复用同一宿主并重新显示，不影响返回战斗。
  const host = document.getElementById('unitFrames');
  if (host) host.hidden = true;
  hostVisible(false);
  if (appPromise) appPromise.then(rt => { if (rt) rt.app.stop(); });
  // 轮询 interval 只在战斗立绘在场时有意义：hide 后不清理会全程空转（每 200ms
  // 一次 rect 读取直到进程结束）。
  stopGeometryPolling();
  const released = releaseTextureSets();
  setDiagnosticPhase(diagnostic === 'static' ? 'static' : 'released');
  return released;
}

function cacheStats() {
  const view = liveFrameApp?.view;
  const dimension = value => Number.isSafeInteger(value) && value > 0 ? value : 0;
  return Object.freeze({ roles: texSets.size, roleNames: [...texSets.keys()],
    ...summarizeFrameTextures(texSets.values()),
    liveApps: liveFrameApp ? 1 : 0, activeFrameSessions: cur && wanted ? 1 : 0,
    pendingAttach: pendingAttach ? 1 : 0,
    backingWidth: dimension(view?.width), backingHeight: dimension(view?.height),
    resolution: Number.isFinite(liveFrameApp?.renderer?.resolution) ? liveFrameApp.renderer.resolution : 0,
    phase: diagnosticPhase, rendererBackend, staticDiagnostic: staticDiagnostic() });
}

// UiScale's dependency registers its resize listener first, so this sees new zoom.
window.addEventListener('resize', () => syncFrameSurface(true));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopGeometryPolling();
    if (appPromise) appPromise.then(rt => { if (rt) rt.app.stop(); });
  } else if (cur) { startGeometryPolling(); syncFrameSurface(true); wakeRenderer(600); }
});

// 战斗结束必卸载（老板 09-12 实机 bug：胜利画面/地图上人物残影）——#unitFrames 挂在
// #overlay 直下、不随 ovBody 重建销毁，战斗收尾切走后若无人 hide 就一直浮在非战斗场景上。
// battle:end 由战斗核心 finish() 广播（victory/defeat/flee 全走这里），同步卸载。
// 只在真正接管过立绘后才订阅（见 attach）：模块级常驻订阅会让 battle:end 的「0 订阅回退」
// 判定失效，吞掉战斗核心对 game.onBattleEnd 的回退——审计 harness 与测试依赖该回退。
let battleEndHideArmed = false;
function armBattleEndHide() {
  if (battleEndHideArmed) return;
  battleEndHideArmed = true;
  busOn('battle:end', () => hide());
}
// Frames remain visible only in battle mode. Retained settings keep one hidden role set;
// any other page, discarded scene, overlay close, or battle end still releases ownership.
document.addEventListener('sdt-overlay-mode', (e) => {
  if (/** @type {CustomEvent} */ (e).detail !== 'battle' && !suspendSettingsScene(/** @type {CustomEvent} */ (e).detail)) hide();
});
document.addEventListener('sdt-overlay-close', hide);

export { attach, play, hide, isLiveBattleFigure, cacheStats, setPaused, presentDeath };
