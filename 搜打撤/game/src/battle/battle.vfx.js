/* 由 battle.view.js 拆出（2026-09-22 六文件重构批5）：战斗特效（飘字/抖动/红闪/火花——自闭合，唯一对外入口 spawnFloats）。
 * 逐字搬迁；本片不 import 壳（壳→片单向）；viewApi 反取已改 battle.core 具名直引。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { rect as uiRect, scale as uiScale } from '../ui/ui-scale.js';
import { Random } from '../core/random.js';
import { demoMs, getPace } from './battle.pace.js';
import { FEEDBACK_DELTA_MS, enqueueFeedback, feedbackClass, feedbackDelay, feedbackShakeDuration, waitMs } from './battle.feedback.js';
import { play as playUnitFrames, setPaused as setUnitFramesPaused } from './battle.frames.js';
import { assetUrl } from '../core/asset-url.js';
import { takeFloats } from './battle.core.js';
const foeHurtTimers = new WeakMap();
const shakeAnimations = new WeakMap();
  // ---------- 战斗特效（v0.32.2）：伤害/受击飘字 + 受击抖动 + 红闪 ----------
  // 飘字挂在 #overlay 层而不是 ovBody——ovBody 每次渲染整块重建，飘字动画会被腰斩
  // baseDelay：等出牌飞行落点后再结算（杀戮尖塔式：牌到手伤害才跳）
  // —— STS2 打击感两件套（2026-09-12 对齐） ——
  // AnimShake：x(t)=10·sin(4t)·sin(t/2)，t:0→2π、Cubic-Out 时间映射（快速颤动带衰减包络）
  // stopMs>0：开头插入静止段（演出层顿帧）——重击/终结一击先卡住一拍再弹开
  function stsShake(figEl, power = 1, stopMs = 0, duration = 1000) {
    if (!figEl || !figEl.animate) return;
    const previous = shakeAnimations.get(figEl);
    if (previous && previous.playState !== 'finished') previous.cancel();
    const T = Math.PI * 2, N = 32, kf = [];
    const total = duration + stopMs;
    const lead = stopMs / total;
    if (stopMs) kf.push({ transform: 'translateX(0px)', offset: 0 });
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const t = T * (1 - Math.pow(1 - u, 3));
      kf.push({ transform: `translateX(${(10 * power * Math.sin(4 * t) * Math.sin(0.5 * t)).toFixed(2)}px)`, offset: lead + u * (1 - lead) });
    }
    const animation = figEl.animate(kf, { duration: total, easing: 'linear' });
    shakeAnimations.set(figEl, animation);
  }
  // 自我受击：后仰 + 红染（原 .fx-hit-self CSS 类从未被挂载，2026-09-19 改走 WAAPI 落地；
  // 玩家立绘在左侧面向敌人，后仰=向左拉开距离；关键帧结构沿用旧 stsSelfHit 设计）
  function stsSelfHit(figEl, power = 1, stopMs = 0) {
    if (!figEl || !figEl.animate) return;
    const total = 450 + stopMs;
    const lead = stopMs / total;
    const kf = [
      { transform: 'translateX(0)', filter: 'none', offset: 0 },
      { transform: 'translateX(0)', filter: 'none', offset: lead },
      { transform: `translateX(${(-8 * power).toFixed(1)}px)`, filter: 'brightness(1.6) saturate(1.6) drop-shadow(0 0 14px rgba(255,90,70,.8))', offset: lead + 0.25 * (1 - lead) },
      { transform: `translateX(${(-3 * power).toFixed(1)}px)`, filter: 'brightness(1.15)', offset: lead + 0.6 * (1 - lead) },
      { transform: 'translateX(0)', filter: 'none', offset: 1 },
    ];
    figEl.animate(kf, { duration: total, easing: 'ease-out' });
  }
  function playFoeHurtFrame(figEl) {
    const unit = figEl.closest('.sts-foe');
    const img = figEl.querySelector('img');
    if (!unit || !img) return;
    clearTimeout(foeHurtTimers.get(unit));
    unit.classList.remove('fx-hit');
    void img.offsetWidth;
    unit.classList.add('fx-hit');
    const finish = event => {
      if (event && event.animationName !== 'btFoeHurt') return;
      unit.classList.remove('fx-hit');
      img.removeEventListener('animationend', finish);
      clearTimeout(foeHurtTimers.get(unit));
      foeHurtTimers.delete(unit);
    };
    img.addEventListener('animationend', finish);
    foeHurtTimers.set(unit, setTimeout(() => finish(), demoMs(900)));
  }
  // 敌方攻击前摇（P1）：立绘向玩家方向突进再回弹——敌人面向左，突进=负 X
  function foeLunge(figEl) {
    if (!figEl || !figEl.animate) return;
    figEl.animate([
      { transform: 'translateX(0)' },
      { transform: 'translateX(-14px) scale(1.04)', offset: 0.45 },
      { transform: 'translateX(0)' },
    ], { duration: demoMs(260), easing: 'cubic-bezier(.3,.7,.4,1)' });
  }
  // 诅咒施加彩闪（P1）：按诅咒 key 上色的边缘光一闪（替代已删除的粒子喷发）
  const CURSE_TINT = {
    burn: 'rgba(255,140,60,', bleed: 'rgba(220,60,70,', poison: 'rgba(140,200,90,',
    freeze: 'rgba(140,215,255,', silence: 'rgba(170,140,200,', abreak: 'rgba(200,170,90,',
    healban: 'rgba(180,90,160,',
  };
  function curseFlash(figEl, cls) {
    if (!figEl || !figEl.animate) return;
    const key = (String(cls).match(/curse-(\w+)/) || [])[1];
    const col = CURSE_TINT[key] || 'rgba(200,120,255,';
    figEl.animate([
      { filter: 'none' },
      { filter: `brightness(1.25) drop-shadow(0 0 18px ${col}.9)`, offset: 0.3 },
      { filter: `brightness(1.25) drop-shadow(0 0 18px ${col}.9)`, offset: 0.55 },
      { filter: 'none' },
    ], { duration: demoMs(700), easing: 'ease-out' });
  }
  // 伤害类型染色（P1）：按伤害类型给命中贴图着色——攻击=原生琥珀不染、固定=炽橙、
  // 法术=青蓝、真实=纯白；毒/灼烧 DoT 走 tintKey 优先（贴图黑底走 screen 混合，filter 只染纹样）。
  // freeze/thunder 键为冰/雷系预留（迭代评审 09-20 美术岗）：卡片透传 tintKey 即生效
  const IMPACT_TINT = {
    fixed: 'sepia(1) saturate(2.8) hue-rotate(-15deg) brightness(1.25)',
    spell: 'sepia(1) saturate(2.4) hue-rotate(160deg) brightness(1.15)',
    true: 'saturate(0) brightness(1.9)',
    poison: 'sepia(1) saturate(2.2) hue-rotate(55deg) brightness(1.1)',
    burn: 'sepia(1) saturate(3) hue-rotate(-10deg) brightness(1.3)',
    freeze: 'sepia(1) saturate(2.6) hue-rotate(150deg) brightness(1.5)',
    thunder: 'sepia(1) saturate(1.6) hue-rotate(215deg) brightness(1.7)',
  };
  // 元素三系火花参数包（迭代评审 09-20 美术岗 Top3）：颜色/数量/速度差分——
  // tintKey 命中即换包（毒=绿缓、灼烧=橙密快、冰=蓝疏慢、雷=紫白密更快），未命中走默认琥珀
  const SPARK_PRESETS = {
    burn: { color: '#ffb34d', count: 16, speed: 1.15 },
    poison: { color: '#8cc85a', count: 10, speed: 0.85 },
    freeze: { color: '#bfe8ff', count: 12, speed: 0.7 },
    thunder: { color: '#e8e0ff', count: 18, speed: 1.4 },
  };
  // 轻量受击火花（P2 补回，替代已删除的 Pixi 粒子通道）：WAAPI 预采样抛散+重力+淡出，
  // 一次性元素即抛即毁、纯 transform/opacity 走合成器，不建常驻渲染管线
  function spawnSparks(ov, figEl, { color = '#ffb34d', count = 12, speed = 1 } = {}) {
    if (!ov || !figEl) return;
    const r = uiRect(figEl);
    const ovR = uiRect(ov);
    const cx = r.left - ovR.left + r.width / 2, cy = r.top - ovR.top + r.height * 0.42;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('i');
      p.className = 'sts-spark';
      const sz = (3 + Random.random('fx') * 4).toFixed(1);
      p.style.cssText = `left:${cx.toFixed(1)}px;top:${cy.toFixed(1)}px;width:${sz}px;height:${sz}px;background:${color}`;
      ov.appendChild(p);
      const ang = Random.random('fx') * Math.PI * 2;
      const v = (70 + Random.random('fx') * 150) * speed;
      const vx = Math.cos(ang) * v, vy = Math.sin(ang) * v - 60;
      const dur = 420 + Random.random('fx') * 260;
      const N = 10, kf = [];
      for (let k = 0; k <= N; k++) {
        const u = k / N, t = (u * dur) / 1000;
        kf.push({
          transform: `translate(${(vx * t).toFixed(1)}px,${(vy * t + 480 * t * t).toFixed(1)}px) scale(${(1 - u * 0.7).toFixed(2)})`,
          opacity: u < 0.55 ? 0.95 : Math.max(0, 0.95 * (1 - (u - 0.55) / 0.45)),
          offset: u,
        });
      }
      p.animate(kf, { duration: dur, easing: 'linear', fill: 'forwards' }).onfinish = () => p.remove();
      setTimeout(() => p.remove(), dur + 150);   // 兜底清理
    }
  }
  // 敌方攻击弹道（P2）：前摇同刻从敌人立绘到玩家立绘闪现一道上弓弧线+箭头，快速淡出
  //（多敌混战时读得出这一刀是谁砍的；一次性 canvas，与指向施法的 #aimArrow 无关）
  function foeAttackLine(body, figEl) {
    const ov = UI.el.overlay;
    const me = body.querySelector('#btSelf .sts-figure');
    if (!ov || !me) return;
    const ovR = uiRect(ov);
    const a = uiRect(figEl), b = uiRect(me);
    const x1 = a.left - ovR.left + a.width * 0.35, y1 = a.top - ovR.top + a.height * 0.42;
    const x2 = b.left - ovR.left + b.width * 0.65, y2 = b.top - ovR.top + b.height * 0.42;
    const w = Math.max(2, Math.ceil(ovR.width)), h = Math.max(2, Math.ceil(ovR.height));
    // 坐标是布局口径：物理密度补上 zoom（大屏 zoom>1 时不糊）
    const ratio = Math.max(1, (window.devicePixelRatio || 1) * uiScale());
    const cv = document.createElement('canvas');
    cv.className = 'sts-attack-line';
    cv.width = w * ratio; cv.height = h * ratio;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    ov.appendChild(cv);
    const ctx = cv.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 46;   // 弓背朝上
    ctx.strokeStyle = '#ff6659';
    ctx.lineCap = 'round';
    ctx.globalAlpha = .16; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
    ctx.globalAlpha = .85; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
    const tx = x2 - mx, ty = y2 - my, tl = Math.hypot(tx, ty) || 1;
    const ux = tx / tl, uy = ty / tl;
    ctx.globalAlpha = .95;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * 13 - uy * 6, y2 - uy * 13 + ux * 6);
    ctx.lineTo(x2 - ux * 13 + uy * 6, y2 - uy * 13 - ux * 6);
    ctx.closePath(); ctx.fillStyle = '#ff6659'; ctx.fill();
    cv.animate([{ opacity: 1 }, { opacity: 0 }], { duration: demoMs(420), easing: 'ease-out', fill: 'forwards' })
      .onfinish = () => cv.remove();
    setTimeout(() => cv.remove(), 580);   // 兜底清理
  }
  // NDamageNumVfx：伤害数字抛体——随机初速上抛 + 重力下坠 + 后半程淡出（WAAPI 预采样）。
  // 随机全部走种子随机服务（random.test 禁 Math.random），'fx' 流不进对局存档口径
  function physicsFloat(span) {
    const vx = Random.random('fx') * 180 - 90;
    const vy = -(500 + Random.random('fx') * 160);
    const g = 960;
    const dur = 1000 + Random.random('fx') * 180;
    const N = 20, kf = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, t = (u * dur) / 1000;
      kf.push({
        transform: `translate(-50%,-50%) translate(${(vx * t).toFixed(1)}px,${(vy * t + 0.5 * g * t * t).toFixed(1)}px)`,
        opacity: u < 0.45 ? 1 : Math.max(0, 1 - (u - 0.45) / 0.55),
        offset: u,
      });
    }
    span.animate(kf, { duration: dur, easing: 'linear', fill: 'forwards' });
  }
  async function globalHitStop(ms) {
    if (!(ms > 0) || SDT.Motion?.reduceMotion()) return;
    const running = typeof document.getAnimations === 'function'
      ? document.getAnimations().filter(animation => animation.playState === 'running') : [];
    running.forEach(animation => { try { animation.pause(); } catch { /* 已结束的动画不参与顿帧 */ } });
    setUnitFramesPaused(true);
    try { await new Promise(resolve => setTimeout(resolve, demoMs(ms))); }
    finally {
      setUnitFramesPaused(false);
      running.forEach(animation => {
        if (animation.playState === 'paused') { try { animation.play(); } catch { /* 已移除节点上的动画无需恢复 */ } }
      });
    }
  }
  function presentHitHealth(body, unit, hp, maxHp, instant = false) {
    if (unit == null || !(maxHp > 0) || !Number.isFinite(Number(hp))) return;
    const target = body.querySelector(`.sts-foe[data-eidx="${unit}"]`);
    const wrap = target && target.querySelector('.bt-hpwrap');
    if (!wrap) return;
    const pct = `${Math.max(0, Math.min(100, Number(hp) / maxHp * 100)).toFixed(1)}%`;
    const bars = [wrap.querySelector('.sts-hp-main'), wrap.querySelector('.sts-hp-ghost')].filter(Boolean);
    for (const bar of bars) {
      if (instant) {
        bar.style.transition = 'none';
        bar.style.width = pct;
        void bar.offsetWidth;
        bar.style.transition = '';
      } else bar.style.width = pct;
    }
    const text = wrap.querySelector('span');
    if (text) text.textContent = `${Math.max(0, hp)}/${maxHp}`;
  }
  function spawnFloats(body, baseDelay = 0) {
    const list = takeFloats();
    if (!list.length) return;
    const ov = UI.el.overlay;
    const ovR = uiRect(ov);   // 布局口径：飘字/贴图定位
    const perUnit = {};   // #19：同单位多段伤害错峰呈现
    const damageBeatCounts = new Map();
    let previousDue = 0;
    const stagedHealth = new Set();
    list.forEach((f) => {
      if (f.hpBefore == null) return;
      const key = String(f.unit);
      damageBeatCounts.set(key, (damageBeatCounts.get(key) || 0) + 1);
    });
    list.forEach((f) => {
      if (f.hpBefore != null && f.maxHp > 0 && !stagedHealth.has(String(f.unit))) {
        stagedHealth.add(String(f.unit));
        presentHitHealth(body, f.unit, f.hpBefore, f.maxHp, true);
      }
      const fire = async () => {
      const isSelf = f.unit === 'self';
      const allyI = isSelf ? null : (/^ally:(\d+)$/.exec(String(f.unit)) || [])[1];   // 随从替伤：battle.core 推 'ally:N'
      const figEl = isSelf
        ? body.querySelector('#btSelf .sts-figure')
        : allyI != null
          ? body.querySelector(`.sts-ally[data-ally-i="${allyI}"] .sts-figure`)
          : body.querySelector(`.sts-foe[data-eidx="${f.unit}"] .sts-figure`);
      if (!figEl) return;
      // 纯演出指令（无文字）：敌方攻击前摇+弹道 / 诅咒施加彩闪
      if ((f.cls || '').includes('windupfx')) {
        if (!SDT.Motion?.reduceMotion()) {
          figEl.classList.add('bt-hit-anticipate');
          setTimeout(() => figEl.classList.remove('bt-hit-anticipate'), demoMs(130));
        }
        return;
      }
      if ((f.cls || '').includes('lungefx')) {
        if (!SDT.Motion?.reduceMotion()) { foeLunge(figEl); foeAttackLine(body, figEl); }
        // 2× 档呼啸提速 ×1.5（迭代评审 09-20 音频岗）：步进压缩后 0.22s 呼啸会「未完即中弹」
        // 丢失预警语义；经 opts 传参不在 sfx() 里读全局节奏态（音频岗 R3 落点）
        SDT.Sound.sfx('foeLunge', getPace() > 1 ? { rateScale: 1.5 } : undefined);   // 前摇呼啸（音频 P2#8）：提示「要挨打了」，无论是否减动效都响
        return;
      }
      if ((f.cls || '').includes('cursefx')) { if (!SDT.Motion?.reduceMotion()) curseFlash(figEl, f.cls); return; }
      const reduced = !!SDT.Motion?.reduceMotion();
      const stk = (f.cls || '').includes('stk');
      const isBlock = (f.cls || '').includes('block');
      const damage = !f.warm && !stk && !isBlock;
      const amt = parseInt(String(f.text).replace(/[^\d-]/g, ''), 10) || 0;
      const heavy = damage && amt >= 10;   // 重击：≥10 点——更大命中贴图 + 更猛抖动 + 顿帧
      const finisher = damage && feedbackClass(f).includes('fx-finisher');
      const stopMs = (heavy || finisher) && !reduced ? 100 : 0;   // 全场顿帧一拍，2× 同步缩短
      if (damage) SDT.Sound.sfx('hit', { rateScale: heavy ? 1.18 : amt >= 5 ? 1.08 : 0.96 });
      if (f.shieldBreak) SDT.Sound.sfx('shieldBreak');
      // STS2 口径：hurt 骨骼/序列帧动画与抖动互斥——帧播上了就不抖；随从无帧集，不代播玩家动作。
      // 攻击动作（atk）改在卡牌起飞时播（见 animateBattleTransition），此处不再倒挂重播
      const framesPlayed = damage && !reduced && isSelf && playUnitFrames('hurt');
      if (damage && !reduced && !framesPlayed) {
        if (isSelf) stsSelfHit(figEl, heavy ? 1.35 : 1);   // 自己：后仰+红染
        else {
          if (allyI == null) playFoeHurtFrame(figEl);
          stsShake(figEl, heavy ? 1.55 : 1, 0, feedbackShakeDuration(damageBeatCounts.get(String(f.unit)) || 1));
        }
      }
      if (!reduced && !stk) {
        const preset = SPARK_PRESETS[f.tintKey];
        spawnSparks(ov, figEl, preset ? { ...preset } : {
          color: f.warm ? '#61d69b' : ((isSelf || allyI != null) ? '#ff6659' : '#ffb34d'),
          count: f.warm ? 8 : (heavy ? 18 : 12),
        });
      }
      if (isSelf && damage && !reduced) hurtFlash(ov);
      // 2026-09-13 老板：治疗闪绿光；自己攻击或造成伤害时轻微抖屏（受击红闪已有）
      if (isSelf && f.warm && !reduced) healFlash(ov);
      if (damage && !isSelf && allyI == null && !reduced) screenShake(body);
      // 掉血血条槽体红闪（样式 winter.css .hp-dropping；320ms 错峰配 300ms 清除避免竞态）
      if (damage && !reduced) {
        const unitEl = figEl.closest('.sts-unit');
        const bar = unitEl && unitEl.querySelector('.bt-hpwrap');
        if (bar) {
          bar.classList.remove('hp-dropping');
          void bar.offsetWidth;   // 强制 reflow，让连续掉血重播闪红
          bar.classList.add('hp-dropping');
          setTimeout(() => bar.classList.remove('hp-dropping'), 300);
        }
      }
      if (f.warm) {   // 治疗暖色滤镜（表情反馈·零美术）
        figEl.classList.add('fx-warm');
        setTimeout(() => figEl.classList.remove('fx-warm'), 950);
      }
      const r = uiRect(figEl);
      // 命中特效贴图：格挡/免伤=护盾碎裂，治疗不出，其余伤害=斩击（黑底图走 screen 混合）
      const impactCls = isBlock ? 'fx-block'
        : (f.warm || stk) ? null : 'fx-slash';
      if (impactCls && !reduced) {
        const imp = document.createElement('div');
        imp.className = 'sts-impact ' + impactCls;
        const sz = heavy ? 210 : 150, half = sz / 2;
        imp.style.width = imp.style.height = sz + 'px';
        imp.style.margin = `${-half}px 0 0 ${-half}px`;
        imp.style.left = (r.left - ovR.left + r.width / 2) + 'px';
        imp.style.top = (r.top - ovR.top + r.height * 0.4) + 'px';
        // 方向收敛（P1）：以贴图原生斜向为基准 ±22° 抖动（读得出「斩击」而非乱转的贴图）；
        // 自伤/我方受击转 180° 镜像方向。伤害类型染色（攻击=原生琥珀不染）
        const baseRot = (isSelf || allyI != null) ? 180 : 0;
        imp.style.setProperty('--imp-rot', Math.floor(baseRot + Random.random('fx') * 44 - 22) + 'deg');
        const tint = IMPACT_TINT[f.tintKey || f.type];
        if (tint) imp.style.filter = tint;
        ov.appendChild(imp);
        imp.addEventListener('animationend', () => imp.remove(), { once: true });
        setTimeout(() => imp.remove(), 900);
      }
      const span = document.createElement('span');
      span.className = 'sts-float ' + feedbackClass(f);
      // SVG 贴纸（P2，替代 emoji）：cls 带 sticker-* 时渲染对应手绘贴纸图
      const sticker = (String(f.cls || '').match(/sticker-(\w+)/) || [])[1];
      if (sticker) {
        span.classList.add('sticker');
        span.innerHTML = `<img src="${assetUrl('assets/battle/fx-sticker-' + sticker + '.svg')}" alt="">`;
      } else {
        if (f.label) {
          const label = document.createElement('small');
          label.textContent = f.label + ' ';
          span.appendChild(label);
        }
        span.appendChild(document.createTextNode(f.text));
      }
      // STS2：伤害数字落点随机抖动（±10, ±5），与同伴不重影
      span.style.left = (r.left - ovR.left + r.width / 2 + (Random.random('fx') * 20 - 10)) + 'px';
      span.style.top = (r.top - ovR.top + r.height * (stk ? 0.02 : 0.32) + (Random.random('fx') * 10 - 5)) + 'px';
      ov.appendChild(span);
      if (damage && !reduced && span.animate) {
        span.classList.add('phys');   // 抑制 CSS 上飘动画，走抛体
        physicsFloat(span);
        setTimeout(() => span.remove(), 1400);
      } else {
        span.addEventListener('animationend', () => span.remove(), { once: true });
        setTimeout(() => span.remove(), 1400);   // 兜底：animationend 偶尔不触发时清掉不可见残骸
      }
      await globalHitStop(stopMs);
      };
      const due = baseDelay + (f.delay || 0) + feedbackDelay(f.unit, perUnit, demoMs(FEEDBACK_DELTA_MS));   // 同单位多段按节拍错开
      const gap = Math.max(0, due - previousDue);
      previousDue = Math.max(previousDue, due);
      enqueueFeedback(async () => {
        const isSelf = f.unit === 'self';
        const allyI = isSelf ? null : (/^ally:(\d+)$/.exec(String(f.unit)) || [])[1];
        const fig = isSelf
          ? body.querySelector('#btSelf .sts-figure')
          : allyI != null
            ? body.querySelector(`.sts-ally[data-ally-i="${allyI}"] .sts-figure`)
            : body.querySelector(`.sts-foe[data-eidx="${f.unit}"] .sts-figure`);
        const damage = !f.warm && !(f.cls || '').includes('stk') && !(f.cls || '').includes('block') && !(f.cls || '').includes('windupfx');
        if (fig && damage && !SDT.Motion?.reduceMotion()) {
          fig.classList.add('bt-hit-anticipate');
          try { await waitMs(demoMs(85)); } finally { fig.classList.remove('bt-hit-anticipate'); }
        }
        if (f.hpAfter != null) presentHitHealth(body, f.unit, f.hpAfter, f.maxHp);
        await fire();
      }, gap);
    });
  }
  // 全屏受击红闪（径向暗角，600ms 淡出）
  function hurtFlash(ov) {
    if (ov.querySelector('.sts-hurtflash')) return;   // 连续受击不叠层
    const div = document.createElement('div');
    div.className = 'sts-hurtflash';
    ov.appendChild(div);
    div.addEventListener('animationend', () => div.remove(), { once: true });
    setTimeout(() => div.remove(), 1000);   // 兜底清理
  }
  // 全屏治疗绿闪（2026-09-13 老板：回复血量时闪绿光）——口径同 hurtFlash
  function healFlash(ov) {
    if (ov.querySelector('.sts-healflash')) return;   // 连续治疗不叠层
    const div = document.createElement('div');
    div.className = 'sts-healflash';
    ov.appendChild(div);
    div.addEventListener('animationend', () => div.remove(), { once: true });
    setTimeout(() => div.remove(), 1000);   // 兜底清理
  }
  // 轻微抖屏（2026-09-13 老板：自己攻击或造成伤害时）——战斗内容层小幅位移 240ms，抖动中不叠层
  function screenShake(body) {
    if (!body || body.classList.contains('sts-screenshake')) return;
    body.classList.add('sts-screenshake');
    const clear = () => body.classList.remove('sts-screenshake');
    body.addEventListener('animationend', clear, { once: true });
    setTimeout(clear, 400);   // 兜底：animationend 偶发不触发时也能复位
  }

export { spawnFloats };
