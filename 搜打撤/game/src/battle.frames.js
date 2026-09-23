import SDT from './sdt-facade.js';
import { assetUrl } from './asset-url.js';
import { on as busOn } from './event-bus.js';
import { rect as uiRect, scale as uiScale } from './ui-scale.js';
import { demoMs } from './battle.pace.js';

// ---------- 战斗单位序列帧播放器（批次D：Pixi 材质层） ----------
// 定调（老板 2026-09-12）：动画路线 = Pixi 材质层 + 序列帧，跳过 Spine；敌人本轮不上序列帧；
// 帧数按实际资产来（老板 09-12 追加定调：GPT 帧图分批交付，播放器有几帧播几帧，
// 不再假设固定 6 帧）。程序化位移（受击抖动 fx-hit-self / 回合沉浮）留在 DOM
// 常驻节点上走合成器，本模块只负责「立绘内容」的帧切换——每 tick 读 figure 的
// getBoundingClientRect（含 transform）跟随，抖动/沉浮时序列帧内容跟着 DOM 一起动。
// 帧资产：assets/portraits/frames/<角色>/<动作>.webp（基准帧）+ <动作>-1..N.webp
// （GPT 追加帧；idle 另有 idle-breathe）。加载时按候选名探测，实际存在几帧播几帧，
// SEQ_MS[动作] 总时长均分到各帧——帧数变化不用改代码。
// 角色无帧集 / 纹理未就绪 / 加载失败：不隐藏原 img，静态立绘兜底。
// 省电策略（三铁律：不出画面不渲染）：静止期 renderer 停止，低频轮询 rect；rect 变化或
// 切帧才拉起渲染。document.hidden 时整体暂停。
// 帧缺失容错：动作里某帧加载失败就跳过该帧；整个动作没帧则该动作不播（不罢工）。

const HAS_FRAMES = new Set(['changwuyu', 'baita', 'wu']);
const FRAME_H = 760, FRAME_W = 512;        // 烘焙画布尺寸
const GEO_TUNE = 1.02;                     // 人物等高对齐静态立绘的视觉微调（沿用旧画布口径）
// 帧节奏：每动作总时长（ms），均分到实际存在的帧上——攻击快、施法舒展、呼吸慢循环
const SEQ_MS = { idle: 2900, 'atk-wind': 320, 'atk-hit': 280, hurt: 420, cast: 800 };
const ACTIONS = Object.keys(SEQ_MS);
const MAX_PROBE = 5;                       // 追加帧探测上限：<动作>-1 .. <动作>-5
const POLL_MS = 200;                       // 静止期 rect 轮询间隔
// 播放语义：atk = 起手连命中；cast / hurt 单段；idle 常驻循环
const ACT_SEQS = {
  atk: ['atk-wind', 'atk-hit'],
  cast: ['cast'],
  hurt: ['hurt'],
};

let appPromise = null;      // { app, host }
let texSets = new Map();    // role -> Promise<{ set, seqs }> | null
let sprite = null;
let emptyTexture = null;
let cur = null;             // { role, fig, img, set, seqs, play, fi, tNext, lastRect }
let wanted = false;         // 已 attach（战斗进行中）
let pollTimer = 0;
let renderHoldT = 0;
let lifecycle = 0;
let releasePromise = null;

function releaseTextureSets() {
  if (releasePromise) return releasePromise;
  const entries = [...texSets];
  texSets.clear();
  if (!entries.length) return Promise.resolve();

  const pending = (async () => {
    const { Assets, Texture } = await import('pixi.js');
    // 宿主先隐藏，再清掉 sprite 的 GPU 引用并卸载 URL；新 attach 等释放完成。
    if (sprite) sprite.texture = Texture.EMPTY;
    await Promise.all(entries.map(async ([, assetPromise]) => {
      try {
        const loaded = await assetPromise;
        for (const url of loaded?.urls || []) {
          try { await Assets.unload(url); } catch (_) { /* Pixi may already have evicted it. */ }
        }
      } catch (_) { /* Failed probes have nothing to release. */ }
    }));
  })().finally(() => {
    if (releasePromise === pending) releasePromise = null;
  });
  releasePromise = pending;
  return pending;
}

async function evictOtherTextureSets(keepRole, Assets, Texture) {
  const evictions = [];
  for (const [role, pending] of texSets) {
    if (role === keepRole || cur?.role === role) continue;
    texSets.delete(role);
    evictions.push(Promise.resolve(pending).then(async loaded => {
      if (!loaded) return;
      if (sprite && (!cur || cur.role !== role)) sprite.texture = Texture.EMPTY;
      for (const url of loaded.urls || []) {
        try { await Assets.unload(url); } catch (_) { /* 已被 Pixi 回收则忽略 */ }
      }
    }).catch(() => {}));
  }
  await Promise.all(evictions);
}

// 探测某角色实际存在的帧：基准帧 <动作>.webp + 追加帧 <动作>-1..N.webp（idle 尾部含呼吸帧）
function candidateNames() {
  const names = [];
  for (const a of ACTIONS) {
    names.push(a);
    for (let i = 1; i <= MAX_PROBE; i++) names.push(`${a}-${i}`);
  }
  names.push('idle-breathe');
  return names;
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
  try { data = cx.getImageData(0, 0, sw, sh).data; } catch (_) { return null; }
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
  } catch (_) { /* 量不出按满高处理 */ }
  portraitFillCache.set(role, fill);
  return fill;
}

function ensureApp() {
  if (appPromise) return appPromise;
  appPromise = (async () => {
    const { Application, Sprite, Texture } = await import('pixi.js');
    const ov = document.getElementById('overlay');
    const host = document.createElement('div');
    host.id = 'unitFrames';
    host.hidden = true;
    host.setAttribute('aria-hidden', 'true');
    // 铺满 overlay 的绝对层：canvas 与 overlay 坐标一一对应（sprite 直接用视口 rect 定位）；
    // z-index 6：盖过单位区(2)/手牌常态，低于 hover 卡(9+)/aimArrow(60)/红闪(70)/飘字(80)
    host.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:6;';
    if (ov) ov.appendChild(host);
    const app = new Application({
      // antialias 关闭：帧图是预烘 webp 纹理，纹理采样自带双线性过滤，MSAA 对
      // 纹理四边形毫无收益，只烧全屏 MSAA 带宽。
      resizeTo: ov || window, backgroundAlpha: 0, antialias: false,
      // 物理分辨率补 UiScale.zoom（stage 坐标是布局值）：zoom>1 的大屏序列帧不糊；
      // autoDensity 保持 canvas CSS 尺寸=逻辑尺寸，显示仍由 html zoom 等比缩放
      resolution: Math.max(1, (window.devicePixelRatio || 1) * uiScale()),
      autoDensity: true,
      autoStart: false, powerPreference: 'low-power',
    });
    host.appendChild(app.view);
    sprite = new Sprite();
    emptyTexture = Texture.EMPTY;
    sprite.anchor.set(0.5, 1);   // 底部中心锚点：脚底对齐
    app.stage.addChild(sprite);
    // 序列帧节奏最慢 ~1.5s/帧，30fps 上限足够顺滑：不设限就会在 120Hz 屏上按刷新率
    // 全速渲染全屏透明画布（120 次合成/秒）白烧 GPU。配合脏标记跳帧见 ticker。
    app.ticker.maxFPS = 30;
    // 画布尺寸变化会清空 WebGL 后备缓冲：置脏补一帧，否则脏标记跳帧会在
    // resize 后留一帧空画布。
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => { if (cur) cur.dirty = true; }).observe(app.view);
    }
    return { app, host };
  })().catch(error => {
    console.warn('[SDT.BattleFrames] PixiJS init failed:', error);
    appPromise = null;
    return null;
  });
  return appPromise;
}

function loadSet(role) {
  if (texSets.has(role)) return texSets.get(role);
  const p = (async () => {
    const rt = await ensureApp();
    if (!rt) return null;
    const { Assets, Texture } = await import('pixi.js');
    // 序列帧纹理是 GPU/解码内存的大头（当前三套合计约 57.9MiB）。只保留最近
    // 使用角色；切换角色时卸载旧套，避免长局把所有角色纹理永久累积。
    await evictOtherTextureSets(role, Assets, Texture);
    const set = new Map();
    const boxes = new Map();
    const urls = [];
    for (const name of candidateNames()) {
      const url = assetUrl(`assets/portraits/frames/${role}/${name}.webp`);
      // 包围盒测量走独立 fetch（与 Assets.load 同 URL 命中缓存）：不依赖 Pixi 纹理内部
      // 结构拿位图，v8 的 source.resource 在部分环境下不可用，拿不到会让全部 box 为空、
      // sprite 退化到画布原点（人物消失）。
      const boxP = (async () => {
        const resp = await fetch(url);
        const bmp = await createImageBitmap(await resp.blob());
        const box = measureAlphaBox(bmp, bmp.width, bmp.height);
        bmp.close();
        return box;
      })().catch(() => null);
      try {
        const tex = await Assets.load(url);
        set.set(name, tex);
        boxes.set(name, await boxP);
        urls.push(url);
      } catch (e) { /* 探测：没这帧就跳过 */ }
    }
    // 每动作的实际帧序列 = 候选名里加载成功的按序集合
    const seqs = new Map();
    for (const a of ACTIONS) {
      const frames = [a, ...Array.from({ length: MAX_PROBE }, (_, i) => `${a}-${i + 1}`)]
        .filter(n => set.has(n)).concat(a === 'idle' && set.has('idle-breathe') ? ['idle-breathe'] : []);
      if (frames.length) seqs.set(a, frames);
    }
    if (!seqs.get('idle')) {
      await Promise.all(urls.map(async url => {
        try { await Assets.unload(url); } catch (_) { /* Pixi may already have evicted it. */ }
      }));
      return null;
    }
    return { set, seqs, urls, boxes };
  })().catch(() => null);
  texSets.set(role, p);
  return p;
}

function isLiveBattleFigure(body, fig) {
  const currentBody = document.getElementById('ovBody');
  return !!(body && fig && wanted && fig.isConnected && body === currentBody && body.contains(fig) && fig.closest('.battle-stage.sts'));
}

function hostVisible(v) {
  if (!appPromise) return;
  appPromise.then(rt => { if (rt) rt.host.hidden = !v; });
}

// —— 渲染开关：静止期停 renderer，仅低频轮询 ——
function wakeRenderer(holdMs = 350) {
  if (!appPromise) return;
  appPromise.then(rt => {
    if (!rt) return;
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

function layout() {
  if (!cur || !cur.fig || !cur.fig.isConnected) return;
  const r = uiRect(cur.fig);   // 布局口径：sprite 坐标是 Pixi stage 布局值
  if (r.width <= 0) return;
  const lr = cur.lastRect;
  if (!lr || r.left !== lr[0] || r.top !== lr[1] || r.width !== lr[2] || r.height !== lr[3]) {
    cur.dirty = true;   // 位/尺寸变了才需要重画；sprite 属性照常赋值（幂等）
  }
  // 人物等高锚定：「人物实际显示高」= 静态立绘显示高 × 立绘人物占比 × GEO_TUNE，
  // 帧间恒定；当前帧画布按人物包围盒反向放大（h = baseCharH × 760/人物高），
  // 人物脚底贴 img 底边（帧内脚底不在画布底时锚点相应上移）。
  cur.baseCharH = r.height * cur.portraitFill * GEO_TUNE;
  cur.imgBottom = r.top - cur.ovTop + r.height;
  cur.centerX = r.left - cur.ovLeft + r.width / 2;
  const box = cur.curBox;
  if (!box || box.y1 <= box.y0) return;   // 无帧盒：保持上次几何（异常兜底）
  const h = cur.baseCharH * (FRAME_H / (box.y1 - box.y0));
  sprite.height = h;
  sprite.width = h * (FRAME_W / FRAME_H);
  sprite.x = cur.centerX;
  sprite.y = cur.imgBottom + (FRAME_H - box.y1) / FRAME_H * h;
  cur.lastRect = [r.left, r.top, r.width, r.height];
}

function applyFrame(name) {
  if (!cur || !cur.set) return;
  const used = cur.set.has(name) ? name : cur.fallback;          // 缺帧兜底：待机基准帧
  const tex = cur.set.get(used);
  if (!tex) return;
  cur.curBox = (cur.boxes && cur.boxes.get(used)) || null;       // 盒跟实际贴的纹理走
  setTexture(tex);
  layout();
  wakeRenderer();
  // TODO(临时调试钩子，查完立绘闪现问题即删)：记录切帧时 sprite 几何与宿主状态
  const host = document.getElementById('unitFrames');
  window.__bfDebug = {
    t: Date.now(), frame: name, role: cur.role,
    spriteW: Math.round(sprite.width), spriteH: Math.round(sprite.height),
    spriteX: Math.round(sprite.x), spriteY: Math.round(sprite.y),
    hostHidden: host ? host.hidden : 'no-host',
    anchor: sprite.anchor && (sprite.anchor.x + ',' + sprite.anchor.y),
  };
}

// 把一个触发动作展开成帧时间轴：{ list, dur, loop }（帧数按实际资产，总时长均分）
function buildTimeline(trigger) {
  if (!cur) return null;
  const seqNames = trigger === 'idle' ? ['idle'] : ACT_SEQS[trigger] || [trigger];
  const list = [], dur = [];
  for (const a of seqNames) {
    const frames = cur.seqs.get(a);
    if (!frames || !frames.length) continue;   // 该动作没帧：跳过（如 cast 未交付时不播施法）
    frames.forEach(f => { list.push(f); dur.push(demoMs(SEQ_MS[a]) / frames.length); });   // demoMs：2× 档同步缩放攻击序列总时长（battle.pace.js）
  }
  return list.length ? { list, dur, loop: trigger === 'idle' } : null;
}

function playSeq(trigger) {
  const tl = buildTimeline(trigger);
  if (!tl || !cur) return false;
  cur.play = tl; cur.fi = 0;
  applyFrame(tl.list[0]);
  cur.tNext = performance.now() + tl.dur[0];
  return true;
}

// —— 帧时间轴推进（ticker 回调驱动） ——
function advance(now) {
  const tl = cur && cur.play;
  if (!tl) return;
  if (now < cur.tNext) return;
  cur.fi++;
  if (cur.fi >= tl.list.length) {
    if (tl.loop) { cur.fi = 0; }               // 待机循环
    else { playSeq('idle'); return; }          // 动作播完 → 回待机循环
  }
  applyFrame(tl.list[cur.fi]);
  cur.tNext = Math.max(cur.tNext, now) + tl.dur[cur.fi];
}

function tickLoop() {
  if (!cur || document.hidden) return;
  advance(performance.now());
  if (cur && cur.fig) {
    const r = uiRect(cur.fig);   // 与 lastRect（布局口径）同尺比较
    const lr = cur.lastRect;
    if (!lr || r.left !== lr[0] || r.top !== lr[1] || r.width !== lr[2] || r.height !== lr[3]) {
      layout();
      wakeRenderer();   // DOM 位移中（抖动/沉浮）持续跟随渲染
    }
  }
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
      // 上一帧内容继续显示（WebGL 画布不清屏就保持）；maxFPS=30 已封顶频率。
      if (cur && cur.dirty && cur.fig && cur.fig.isConnected) {
        cur.dirty = false;
        app.renderer.render(app.stage);
      }
    });
    app.stop();   // autoStart=false：只在 wakeRenderer 拉起时跑
  });
  if (!pollTimer) {
    pollTimer = setInterval(() => {   // 静止期轮询：rect 变了（回合沉浮/hover）拉起渲染
      if (!cur || document.hidden) return;
      const r = cur.fig && uiRect(cur.fig);   // 与 lastRect（布局口径）同尺比较
      if (!r || !r.width) return;
      const lr = cur.lastRect;
      if (!lr || r.left !== lr[0] || r.top !== lr[1] || r.width !== lr[2] || r.height !== lr[3]) {
        layout();
        wakeRenderer(500);
      }
    }, POLL_MS);
  }
}

// ---------- 对外接口 ----------

// 战斗渲染后调用：接管 #btSelf 的立绘为序列帧（无帧集/降动效时自动跳过）
async function attach(body) {
  const token = ++lifecycle;
  wanted = true;
  if (reduceMotion()) return;
  const fig = body && body.querySelector('#btSelf .sts-figure');
  const img = fig && fig.querySelector('img');
  if (!fig || !img) { hide(); return; }
  const m = /portraits\/battle\/([a-z]+?)\.webp/.exec(String(img.getAttribute('src') || ''));
  const role = m && m[1];
  if (!role || !HAS_FRAMES.has(role)) { hide(); return; }
  // 确认有帧集后立刻藏静态 img：纹理异步装载期间静态立绘会露一脸、就绪后跳切序列帧
  // （老板 09-20 实机反馈首次进场「闪一下」）。visibility 只藏内容不塌布局，
  // 装载失败/战斗已结束的原路恢复显示，静态立绘兜底不受影响。
  img.style.visibility = 'hidden';
  if (releasePromise) await releasePromise;
  if (token !== lifecycle) { img.style.visibility = ''; return; }
  const rt = await ensureApp();
  if (!rt || token !== lifecycle) { img.style.visibility = ''; return; }
  const set = await loadSet(role);
  // 资源探测是异步的：战斗可能已结束并切到搜刮/奖励页，旧 fig 即使仍有引用也不能复活帧层。
  if (!set || token !== lifecycle || !isLiveBattleFigure(body, fig)) { img.style.visibility = ''; return; }
  const fill = await portraitFillOf(role, img);
  // 量立绘占比也是异步的，fig 可能在等待期间随战斗结束被移除，复活前再查一次。
  if (token !== lifecycle || !isLiveBattleFigure(body, fig)) { img.style.visibility = ''; return; }
  if (cur && cur.role === role) {
    // 同战斗内重渲染：只换 DOM 引用（ovBody 重建后 fig/img 是新节点），不重置播放状态，
    // 否则出牌结算的多次 render 会把正在播的攻击/受击动作打断
    cur.fig = fig; cur.img = img;
    img.style.visibility = 'hidden';
    return;
  }
  const ov = document.getElementById('overlay');
  const ovR = ov ? uiRect(ov) : { left: 0, top: 0 };   // 布局口径：layout() 里 sprite 换算用
  cur = {
    role, fig, img, set: set.set, seqs: set.seqs, boxes: set.boxes,
    portraitFill: fill, curBox: null, baseCharH: 0, imgBottom: 0, centerX: 0,
    play: null, fi: 0, tNext: 0,
    fallback: set.seqs.get('idle')[0], lastRect: null, ovLeft: ovR.left, ovTop: ovR.top,
    dirty: true,   // 首帧必须渲染
  };
  img.style.visibility = 'hidden';   // 保布局，内容由 sprite 呈现
  hostVisible(true);
  startLoop();
  playSeq('idle');
  wakeRenderer(600);
}

// 动作触发：'atk' 攻击（起手连命中）/ 'cast' 施法 / 'hurt' 受击
function play(name) {
  if (!cur || !cur.set || document.hidden) return;
  if (!ACT_SEQS[name]) return;
  playSeq(name);
  wakeRenderer(900);
}

// 战斗收尾/弹层挂起：卸下 sprite，恢复静态 img
function hide() {
  lifecycle++;
  wanted = false;
  if (cur && cur.img) cur.img.style.visibility = '';
  cur = null;
  if (sprite && emptyTexture) sprite.texture = emptyTexture;
  // 先同步收起 overlay 直下的宿主，避免战斗结束后搜刮/奖励弹层出现一帧残留立绘；
  // 后续 attach 仍会复用同一宿主并重新显示，不影响返回战斗。
  const host = document.getElementById('unitFrames');
  if (host) host.hidden = true;
  hostVisible(false);
  if (appPromise) appPromise.then(rt => { if (rt) rt.app.stop(); });
  // 轮询 interval 只在战斗立绘在场时有意义：hide 后不清理会全程空转（每 200ms
  // 一次 rect 读取直到进程结束）。
  if (pollTimer) { clearInterval(pollTimer); pollTimer = 0; }
  void releaseTextureSets();
}

function cacheStats() {
  return Object.freeze({ roles: texSets.size, roleNames: [...texSets.keys()] });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (appPromise) appPromise.then(rt => { if (rt) rt.app.stop(); }); }
  else if (cur) wakeRenderer(600);
});

// 战斗结束必卸载（老板 09-12 实机 bug：胜利画面/地图上人物残影）——#unitFrames 挂在
// #overlay 直下、不随 ovBody 重建销毁，战斗收尾切走后若无人 hide 就一直浮在非战斗场景上。
// battle:end 由战斗核心 finish() 广播（victory/defeat/flee 全走这里），同步卸载。
busOn('battle:end', () => hide());
// 2026-09-13 留言（白名单）：人物序列帧只允许出现在 battle 模式的弹层里——
// 奖励/搜刮/背包/卡牌库等任何其他模式渲染时一律卸下，新增界面默认不在白名单。
document.addEventListener('sdt-overlay-mode', (e) => { if (e.detail !== 'battle') hide(); });

export { attach, play, hide, isLiveBattleFigure, cacheStats };
