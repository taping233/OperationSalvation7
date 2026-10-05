/* ui.character-idle.js —— 选人页（cls2）五人待机演出：差异化动作 + 大量粒子特效（2026-10-03 老板令）。
 * 动作：CSS keyframes 驱动 .art-figure-wrap 整幅立绘变换，动画名与 IDLE_SPECS[].motion 一一对应
 *       （定义在 game/css/character-idle.css：侠客沉浮 / 降临者悬浮 / 法师呼吸 / 战士稳固 / 牧师摇曳）。
 * 特效：Canvas 双层——idle-vfx-back（人物后：地面辉光 / 法阵 / 光柱）+ idle-vfx-front（人物前：环境粒子 + 周期大招）。
 * 自挂载：监听 sdt-overlay-mode（ui/overlay.js 每次 showOverlay 重建内容后广播），检出 .cls2-fullart 即挂；
 *       选人页切换角色整页重建，旧宿主断开时引擎按帧巡检 isConnected 自毁，game.run.altar.js 零改动
 *       （该文件系 WF-ph1-sys03 在途属地，自挂载设计正为避开撞线）。
 * 停机口径：reduceMotion（SDT.Motion 或 prefers-reduced-motion）不挂载；document.hidden 时 rAF 自然停摆；
 *       同屏粒子受 P_LIMIT 硬顶。随机一律走 Random 'visual' 命名流（全库守卫禁 Math.random，
 *       视觉流与玩法命名流互不干扰，random.test 钉死；10-05 打包门修正）。 */
import SDT from '../core/sdt-facade.js';
import { Random } from '../core/random.js';

const P_LIMIT = 140;          // 同屏粒子硬顶（环境粒子 + 大招残段合计）
const ACCENT_MIN = 3000, ACCENT_MAX = 9000;   // 大招周期合法区间（测试钉死，防配置漂成闪屏）

const rand = (a, b) => a + Random.random('visual') * (b - a);

function hexRGB(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function reducedMotion() {
  const fn = SDT && SDT.Motion && SDT.Motion.reduceMotion;
  if (typeof fn === 'function') { try { if (fn()) return true; } catch { /* 门面异常按未降级处理 */ } }
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  catch { return false; }
}

/* ---------- 五人待机规格（颜色口径对齐 core/characters.js 的角色 color）----------
 * motion  → character-idle.css 的 keyframes 名（idleWu / idleChangwuyu / ...）
 * floor   → 人物后地面辉光（RGB + 基准透明度 + 呼吸周期）
 * emitters→ 环境粒子（kind 决定运动/绘制，every 生成间隔 ms，target 同屏期望数）
 * accent  → 周期性大招演出（slash 剑光 / rune 符爆 / pillar 圣光柱 / burst 怒气迸发 / meteor 流星） */
const IDLE_SPECS = Object.freeze({
  wu: Object.freeze({
    motion: 'wu', color: '#ed9b53',
    floor: Object.freeze({ rgb: [237, 155, 83], alpha: 0.16, pulseMs: 3400 }),
    emitters: Object.freeze([
      Object.freeze({ kind: 'leaf', every: 340, target: 9 }),     // 飘叶：旋转下落 + 侧向摆
      Object.freeze({ kind: 'wind', every: 1500, target: 3 }),    // 风痕：细长光条快速掠过
    ]),
    accent: Object.freeze({ kind: 'slash', every: 5200, jitter: 1200 }),
  }),
  changwuyu: Object.freeze({
    motion: 'changwuyu', color: '#ad9ddd',
    floor: Object.freeze({ rgb: [173, 157, 221], alpha: 0.14, pulseMs: 4600 }),
    emitters: Object.freeze([
      Object.freeze({ kind: 'dust', every: 130, target: 26 }),    // 星尘：自底部缓升
      Object.freeze({ kind: 'orbit', every: 0, target: 3 }),      // 环绕光点：绕躯干公转（常驻）
    ]),
    accent: Object.freeze({ kind: 'rune', every: 4600, jitter: 1000 }),
  }),
  baita: Object.freeze({
    motion: 'baita', color: '#e9bd69',
    floor: Object.freeze({ rgb: [233, 189, 105], alpha: 0.18, pulseMs: 2400 }),
    emitters: Object.freeze([
      Object.freeze({ kind: 'mote', every: 120, target: 30 }),    // 金尘：缓升 + 明暗闪烁
      Object.freeze({ kind: 'speck', every: 900, target: 6 }),    // 天降光斑：自顶缓落
      Object.freeze({ kind: 'halo', every: 2400, target: 2 }),    // 脚下光环脉冲（后层）
    ]),
    accent: Object.freeze({ kind: 'pillar', every: 6200, jitter: 1200 }),
  }),
  heixiang: Object.freeze({
    motion: 'heixiang', color: '#d0805a',
    floor: Object.freeze({ rgb: [208, 128, 90], alpha: 0.2, pulseMs: 1900 }),
    emitters: Object.freeze([
      Object.freeze({ kind: 'spark', every: 110, target: 28 }),   // 火星：上升抖动 + 湮灭闪烁
      Object.freeze({ kind: 'shimmer', every: 800, target: 4 }),  // 热浪弧：低透明上升
    ]),
    accent: Object.freeze({ kind: 'burst', every: 5400, jitter: 1100 }),
  }),
  xingyue: Object.freeze({
    motion: 'xingyue', color: '#81bcb0',
    floor: Object.freeze({ rgb: [129, 188, 176], alpha: 0.13, pulseMs: 4000 }),
    emitters: Object.freeze([
      Object.freeze({ kind: 'star', every: 700, target: 11 }),    // 四芒星：原位明灭
      Object.freeze({ kind: 'firefly', every: 600, target: 8 }),  // 萤光：缓慢游走
    ]),
    accent: Object.freeze({ kind: 'meteor', every: 6800, jitter: 1400 }),
  }),
});

function idleSpecFor(characterId) { return IDLE_SPECS[characterId] || null; }

/* 规格表粒子预算（环境粒子 target 合计，不含大招残段）——测试与性能护栏共用 */
function emitterBudget(spec) {
  return spec.emitters.reduce((sum, e) => sum + e.target, 0);
}

/* ---------- 粒子引擎 ---------- */

function spawn(kind, w, h, rgb) {
  const p = { kind, age: 0, rgb, x: 0, y: 0, vx: 0, vy: 0, life: 1, size: 3, rot: 0, vr: 0, a: 1, seed: Random.random('visual') * Math.PI * 2 };
  switch (kind) {
    case 'leaf':    // 自画面上半区生成，边摆边旋落下
      p.x = rand(0.16, 0.9) * w; p.y = rand(-0.06, 0.3) * h;
      p.vy = rand(26, 52); p.vx = rand(-8, 8); p.life = rand(5, 8);
      p.size = rand(3.4, 6.4); p.rot = rand(0, 6.28); p.vr = rand(-2.6, 2.6); p.a = 0.85; break;
    case 'wind':    // 细长光条快速横掠（左→右），人物带上淡出
      p.x = rand(0.05, 0.4) * w; p.y = rand(0.12, 0.82) * h;
      p.vx = rand(300, 520); p.vy = rand(10, 30); p.life = rand(0.7, 1.1);
      p.size = rand(80, 160); p.a = 0.2; break;
    case 'dust':    // 星尘自底部缓升
      p.x = rand(0.18, 0.94) * w; p.y = h + rand(4, 40);
      p.vy = -rand(20, 46); p.vx = rand(-7, 7); p.life = rand(3.4, 6);
      p.size = rand(1.2, 2.8); break;
    case 'orbit':   // 常驻环绕光点：中心/半径由引擎每帧按宿主尺寸推导
      p.life = Infinity; p.size = rand(2.2, 3.4); p.speed = rand(0.5, 1.1) * (Random.random('visual') < 0.5 ? -1 : 1); break;
    case 'mote':    // 金尘：慢升 + 横向正弦游移 + 明暗闪烁
      p.x = rand(0.16, 0.95) * w; p.y = rand(0.25, 1.02) * h;
      p.vy = -rand(10, 26); p.life = rand(4, 7.5); p.size = rand(1.4, 3); break;
    case 'speck':   // 天降亮斑
      p.x = rand(0.2, 0.92) * w; p.y = rand(-0.05, 0.1) * h;
      p.vy = rand(14, 30); p.life = rand(4, 6.5); p.size = rand(1.8, 3.4); p.a = 0.9; break;
    case 'halo':    // 脚下光环脉冲（画在后层）
      p.x = 0.55 * w; p.y = 0.9 * h; p.life = 1.6; p.size = 0; break;
    case 'spark':   // 火星：快速上升 + 水平抖动 + 闪烁
      p.x = rand(0.2, 0.93) * w; p.y = rand(0.72, 1.0) * h;
      p.vy = -rand(46, 92); p.life = rand(0.9, 1.8); p.size = rand(1, 2.4); break;
    case 'shimmer': // 热浪弧：极低透明缓升
      p.x = rand(0.25, 0.85) * w; p.y = rand(0.55, 0.95) * h;
      p.vy = -rand(14, 26); p.life = rand(2.4, 4); p.size = rand(16, 34); p.a = 0.09; break;
    case 'star':    // 四芒星：原位放大明灭
      p.x = rand(0.1, 0.95) * w; p.y = rand(0.05, 0.72) * h;
      p.life = rand(1.4, 2.4); p.size = rand(2.4, 5.4); break;
    case 'firefly': // 萤光：双正弦游走
      p.x = rand(0.15, 0.93) * w; p.y = rand(0.25, 0.9) * h;
      p.life = rand(6, 10); p.size = rand(1.8, 3); p.speed = rand(0.4, 1); break;
    default: return null;
  }
  return p;
}

function rgba(rgb, a) { return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`; }

function drawParticle(ctx, p, tSec, w, h) {
  const fade = p.life === Infinity ? 1 : Math.min(1, p.age / 0.4) * Math.min(1, (p.life - p.age) / 0.6); // 头尾柔化
  if (fade <= 0) return;
  switch (p.kind) {
    case 'leaf': {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = fade * p.a * 0.8;
      ctx.fillStyle = rgba(p.rgb, 1);
      ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.42, 0, 0, 6.283); ctx.fill();
      ctx.restore(); break;
    }
    case 'wind': {
      const grad = ctx.createLinearGradient(p.x, p.y, p.x - p.size, p.y - p.size * p.vy / p.vx);
      grad.addColorStop(0, rgba(p.rgb, fade * p.a));
      grad.addColorStop(1, rgba(p.rgb, 0));
      ctx.strokeStyle = grad; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.size, p.y - p.size * p.vy / p.vx); ctx.stroke();
      break;
    }
    case 'dust': case 'mote': case 'speck': {
      const tw = 0.55 + 0.45 * Math.sin(tSec * 3.1 + p.seed * 7);      // 明暗闪烁
      const r = p.size * (p.kind === 'speck' ? 1 : 0.9);
      ctx.globalAlpha = fade * tw * (p.a || 1);
      ctx.fillStyle = rgba(p.rgb, 0.35);
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.2, 0, 6.283); ctx.fill();
      ctx.fillStyle = p.kind === 'speck' ? 'rgba(255,246,220,.95)' : rgba(p.rgb, 0.95);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 1; break;
    }
    case 'orbit': {
      const cx = 0.55 * w, cy = 0.42 * h, rx = 0.3 * w, ry = 0.1 * h;
      const ang = p.phase;
      p.x = cx + Math.cos(ang) * rx; p.y = cy + Math.sin(ang) * ry;
      const behind = Math.sin(ang) > 0 ? 0.5 : 1;                        // 后半程压暗，人物在前
      ctx.globalAlpha = 0.9 * behind;
      ctx.strokeStyle = rgba(p.rgb, 0.5 * behind); ctx.lineWidth = p.size;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, ang - 0.7, ang); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.6, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 1; break;
    }
    case 'halo': {
      const k = p.age / p.life, r = k * 0.26 * w;
      ctx.globalAlpha = (1 - k) * 0.5;
      ctx.strokeStyle = rgba(p.rgb, 1); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.22, 0, 0, 6.283); ctx.stroke();
      ctx.globalAlpha = 1; break;
    }
    case 'spark': {
      const fl = Random.random('visual') < 0.24 ? 0.25 : 1;                        // 湮灭闪烁
      ctx.globalAlpha = fade * fl;
      ctx.fillStyle = 'rgba(255,190,120,.9)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.283); ctx.fill();
      ctx.fillStyle = rgba(p.rgb, 0.5);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.6, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 1; break;
    }
    case 'shimmer': {
      ctx.globalAlpha = fade * p.a;
      ctx.strokeStyle = rgba(p.rgb, 1); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y + p.size * 0.4, p.size, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.globalAlpha = 1; break;
    }
    case 'star': {
      const k = p.age / p.life, s = Math.sin(k * Math.PI);                // 放大明灭
      ctx.globalAlpha = s * 0.95;
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.1;
      const L = p.size * (1.4 + s);
      ctx.beginPath();
      ctx.moveTo(p.x - L, p.y); ctx.lineTo(p.x + L, p.y);
      ctx.moveTo(p.x, p.y - L); ctx.lineTo(p.x, p.y + L); ctx.stroke();
      ctx.fillStyle = rgba(p.rgb, 0.9);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.5, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 1; break;
    }
    case 'firefly': {
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(tSec * 2.2 + p.seed * 5));
      ctx.globalAlpha = fade * tw;
      ctx.fillStyle = rgba(p.rgb, 0.3);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.4, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(235,255,250,.95)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.7, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 1; break;
    }
  }
}

/* 周期大招（每种一套短演出，挂到 front 或 back） */
function spawnAccent(kind, w, h, rgb) {
  const fx = { kind, age: 0, life: 1, rgb, back: false, x: 0.55 * w, y: 0.4 * h };
  switch (kind) {
    case 'slash':   // 剑光斜斩：两道弧扫过立绘
      fx.life = 0.62; fx.x = rand(0.3, 0.7) * w; fx.y = rand(0.3, 0.6) * h; break;
    case 'rune':    // 符爆：菱形轮廓自胸口扩张
      fx.life = 0.8; fx.y = 0.36 * h; break;
    case 'pillar':  // 圣光柱（人物后）：竖向光带亮起再收
      fx.life = 0.9; fx.back = true; fx.x = 0.56 * w; break;
    case 'burst':   // 怒气迸发：躯干处径向短光束
      fx.life = 0.48; fx.x = 0.55 * w; fx.y = 0.5 * h; break;
    case 'meteor':  // 流星：右上斜落带尾迹
      fx.life = 0.7; fx.x = rand(0.55, 0.9) * w; fx.y = rand(0.02, 0.14) * h; break;
    default: return null;
  }
  return fx;
}

function drawAccent(ctx, fx) {
  const k = fx.age / fx.life;
  const env = Math.sin(Math.min(1, k) * Math.PI);                        // 起-峰-收包络
  const [r, g, b] = fx.rgb;
  switch (fx.kind) {
    case 'slash': {
      const sweep = -0.5 + k * 1.9;                                      // 扫过角度推进
      ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(-0.65);
      for (let i = 0; i < 2; i++) {
        const rad = 120 + i * 34;
        ctx.globalAlpha = env * (i ? 0.4 : 0.85);
        ctx.strokeStyle = i ? `rgba(${r},${g},${b},1)` : 'rgba(255,244,224,1)';
        ctx.lineWidth = i ? 6 : 2.2;
        ctx.beginPath(); ctx.arc(0, 0, rad, sweep - 0.85, sweep); ctx.stroke();
      }
      ctx.restore(); ctx.globalAlpha = 1; break;
    }
    case 'rune': {
      const s = 26 + k * 150;
      ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(Math.PI / 4);
      ctx.globalAlpha = env * 0.8;
      ctx.strokeStyle = `rgba(${r},${g},${b},1)`; ctx.lineWidth = 2;
      ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.globalAlpha = env * 0.35;
      ctx.strokeStyle = 'rgba(255,255,255,1)'; ctx.lineWidth = 1;
      ctx.strokeRect(-s / 3, -s / 3, s * 2 / 3, s * 2 / 3);
      ctx.restore(); ctx.globalAlpha = 1; break;
    }
    case 'pillar': {
      const wdt = 90 + 70 * env, x0 = fx.x - wdt / 2;
      const grad = ctx.createLinearGradient(x0, 0, x0 + wdt, 0);
      grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
      grad.addColorStop(0.5, `rgba(${r},${g},${b},${0.3 * env})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x0, 0, wdt, ctx.canvas.clientHeight || 9999);
      break;
    }
    case 'burst': {
      ctx.save(); ctx.translate(fx.x, fx.y);
      for (let i = 0; i < 18; i++) {
        const ang = (i / 18) * 6.283 + 0.3, len = 26 + 86 * env;
        ctx.globalAlpha = env * 0.75;
        ctx.strokeStyle = i % 3 ? `rgba(${r},${g},${b},1)` : 'rgba(255,214,170,1)';
        ctx.lineWidth = i % 3 ? 2.4 : 1.2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * 22, Math.sin(ang) * 22);
        ctx.lineTo(Math.cos(ang) * (22 + len), Math.sin(ang) * (22 + len)); ctx.stroke();
      }
      ctx.restore(); ctx.globalAlpha = 1; break;
    }
    case 'meteor': {
      const dist = k * 620, dx = -0.62, dy = 0.78;                        // 右上→左下
      const hx = fx.x + dist * dx, hy = fx.y + dist * dy;
      const grad = ctx.createLinearGradient(hx, hy, hx - dx * 150, hy - dy * 150);
      grad.addColorStop(0, `rgba(255,255,255,${env})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.strokeStyle = grad; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - dx * 150, hy - dy * 150); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${env})`;
      ctx.beginPath(); ctx.arc(hx, hy, 2.6, 0, 6.283); ctx.fill(); break;
    }
  }
}

/* ---------- 挂载 / 卸载 ---------- */

let active = null;   // { host, wrap, spec, engine }

function unmountCharacterIdle() {
  if (!active) return;
  const { host, engine } = active;
  host.classList.remove('idle-stage');
  delete host.dataset.idleMotion;
  if (engine) engine.destroy();
  active = null;
}

function mountCharacterIdle(host) {
  if (!host || typeof host.querySelector !== 'function') return false;
  const wrap = host.querySelector('.art-figure-wrap');
  const m = wrap && /(?:^|\s)figure-([a-z]+)/.exec(String(wrap.className || ''));
  const spec = m && idleSpecFor(m[1]);
  if (!spec) return false;
  if (active && active.host === host) return true;      // 同宿主重复广播（如皮肤热切不重建）不重挂
  unmountCharacterIdle();
  if (reducedMotion()) return false;                    // 降动效：静态立绘原样
  host.classList.add('idle-stage');
  host.dataset.idleMotion = spec.motion;
  const engine = createIdleEngine(host, spec);
  active = { host, wrap, spec, engine };
  return true;
}

function createIdleEngine(host, spec) {
  const back = document.createElement('canvas');
  const front = document.createElement('canvas');
  back.className = 'idle-vfx idle-vfx-back';
  front.className = 'idle-vfx idle-vfx-front';
  back.setAttribute('aria-hidden', 'true');
  front.setAttribute('aria-hidden', 'true');
  host.insertBefore(back, host.firstChild);
  host.appendChild(front);
  const bctx = back.getContext && back.getContext('2d');
  const fctx = front.getContext && front.getContext('2d');
  if (!bctx || !fctx || typeof requestAnimationFrame !== 'function') {
    return { destroy() { back.remove(); front.remove(); } };            // jsdom / 无 rAF 环境：只留 CSS 动作
  }
  const rgb = hexRGB(spec.color);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let w = 0, h = 0, raf = 0, last = 0, dead = false;
  const parts = [];
  const fxA = [];                                       // 大招残段
  const nextSpawn = new Map();
  let nextAccent = performance.now() + spec.accent.every * 0.5;

  const resize = () => {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    w = r.width; h = r.height;
    for (const cv of [back, front]) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(host);

  const step = (now) => {
    if (dead) return;
    if (!host.isConnected) { destroy(); return; }       // 页面重建/关层：自毁（含 210ms 淡出尾巴）
    const dt = Math.min(0.064, last ? (now - last) / 1000 : 0.016);
    last = now;
    const tSec = now / 1000;
    // —— 生成（every=0 的常驻类只按 target 补员；间隔类按 due 时间 + 目标数双闸）——
    for (const em of spec.emitters) {
      const living = parts.reduce((n, p) => n + (p.kind === em.kind ? 1 : 0), 0);
      if (living >= em.target || parts.length >= P_LIMIT) continue;
      if (em.every) {
        const due = nextSpawn.get(em.kind) || 0;
        if (now < due) continue;
        nextSpawn.set(em.kind, now + em.every * rand(0.6, 1.4));
      }
      const p = spawn(em.kind, w, h, rgb);
      if (p) { if (p.kind === 'orbit') p.phase = Random.random('visual') * 6.283; parts.push(p); }
    }
    if (now >= nextAccent) {
      const fx = spawnAccent(spec.accent.kind, w, h, rgb);
      if (fx) fxA.push(fx);
      nextAccent = now + spec.accent.every + rand(-spec.accent.jitter, spec.accent.jitter);
    }
    // —— 推进（orbit 只推相位；其余寿命到期回收）——
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.kind === 'orbit') { p.phase += p.speed * dt * 1.6; continue; }
      if (p.age >= p.life || p.y < -60 || p.y > h + 80) { parts.splice(i, 1); continue; }
      p.x += (p.vx + (p.kind === 'mote' || p.kind === 'firefly' || p.kind === 'leaf' ? Math.sin(tSec * 1.7 + p.seed) * (p.kind === 'leaf' ? 22 : 9) : 0)) * dt;
      p.y += p.vy * dt;
      if (p.kind === 'spark') p.x += Math.sin(tSec * 13 + p.seed * 9) * 26 * dt;   // 火星横抖
      if (p.kind === 'firefly') p.y += Math.sin(tSec * 0.9 + p.seed * 3) * 14 * dt;
      if (p.rot !== undefined && p.vr) p.rot += p.vr * dt;
    }
    for (let i = fxA.length - 1; i >= 0; i--) { const fx = fxA[i]; fx.age += dt; if (fx.age >= fx.life) fxA.splice(i, 1); }
    // —— 绘制：后层（地面辉光 + 背景类大招）／前层（粒子 + 前景类大招）——
    bctx.clearRect(0, 0, w, h);
    fctx.clearRect(0, 0, w, h);
    const fl = spec.floor;
    const glow = fl.alpha * (0.72 + 0.28 * Math.sin((tSec * 6283) / fl.pulseMs));
    const gx = 0.55 * w, gy = 0.9 * h;
    const grad = bctx.createRadialGradient(gx, gy, 0, gx, gy, 0.34 * w);
    grad.addColorStop(0, `rgba(${fl.rgb[0]},${fl.rgb[1]},${fl.rgb[2]},${glow})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    bctx.fillStyle = grad;
    bctx.fillRect(gx - 0.34 * w, gy - 0.2 * h, 0.68 * w, 0.24 * h);
    if (spec.motion === 'changwuyu') drawRuneRing(bctx, w, h, rgb, tSec);          // 降临者专属：脚下法阵常转
    for (const fx of fxA) if (fx.back) drawAccent(bctx, fx);
    for (const p of parts) drawParticle(fctx, p, tSec, w, h);
    for (const fx of fxA) if (!fx.back) drawAccent(fctx, fx);
    raf = requestAnimationFrame(step);
  };

  function drawRuneRing(ctx, width, height, c, t) {
    const cx = 0.55 * width, cy = 0.88 * height, rx = 0.23 * width, ry = 0.052 * height;
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},1)`;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([9, 7]);
    ctx.lineDashOffset = -t * 26;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 6.283); ctx.stroke();
    ctx.setLineDash([3, 11]);
    ctx.lineDashOffset = t * 34;
    ctx.globalAlpha = 0.24;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.68, ry * 0.68, 0, 0, 6.283); ctx.stroke();
    ctx.restore();
  }

  function destroy() {
    dead = true;
    cancelAnimationFrame(raf);
    if (ro) ro.disconnect();
    back.remove(); front.remove();
  }

  raf = requestAnimationFrame(step);
  return { destroy };
}

function idleMountState() {
  return active ? Object.freeze({ host: active.host, motion: active.spec.motion, spec: active.spec }) : null;
}

/* ---------- 自挂载入口（main.js 副作用 import；node 环境无 document 直跳过） ---------- */
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  // showOverlay 每次重建 ovBody 后广播本事件（ui/overlay.js），选人页开页/切人均会触发；
  // 关层无广播，由引擎每帧 isConnected 巡检自毁收尾。
  document.addEventListener('sdt-overlay-mode', () => {
    const host = document.querySelector('.cls2-fullart');
    if (host) mountCharacterIdle(host);
  });
}

export { IDLE_SPECS, idleSpecFor, emitterBudget, mountCharacterIdle, unmountCharacterIdle, idleMountState, ACCENT_MIN, ACCENT_MAX, P_LIMIT };
