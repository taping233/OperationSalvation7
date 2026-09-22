/* 由 battle.view.js 拆出（2026-09-22 六文件重构批5）：牌局动画（离场克隆飞行 / 回合横幅 / 幸存者归位 / 手牌区显隐）。
 * 逐字搬迁；本片不 import 壳（壳→片单向）；viewApi 反取已改 battle.core 具名直引。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { rect as uiRect, scale as uiScale } from './ui-scale.js';
import { esc } from './shared.js';
import { attach as attachUnitFrames, play as playUnitFrames, hide as hideUnitFrames, cacheStats as frameCacheStats } from './battle.frames.js';
  // ---------- 牌局动画（2026-09-09）：离场克隆飞行 / 新牌飞入 / 幸存者归位 / 手牌区显隐 ----------
  // 渲染是整块重建，跨渲染的位移全部走 WAAPI：离场牌在 overlay 常驻层放克隆体飞行，
  // 入场/归位用 composite:'add' 加法合成——不破坏槽位自身的扇形 transform。
  function captureBattleView() {
    const ov = UI.el.overlay;
    if (!ov || ov.hidden) return null;
    const handEl = ov.querySelector('.sts-hand');
    if (!handEl) return null;
    const ovR = uiRect(ov);   // 布局口径：rect 存档供飞行动画消费
    const stage = handEl.closest('.battle-stage');
    const cards = {};
    handEl.querySelectorAll('.bt-card[data-uid]').forEach(el => {
      const r = uiRect(el);
      cards[el.dataset.uid] = {
        html: el.outerHTML,
        name: ((el.querySelector('.hsc-name') || {}).textContent || '').trim(),
        rect: { left: r.left - ovR.left, top: r.top - ovR.top, width: r.width, height: r.height },
      };
    });
    const rectOf = (sel) => {
      const el = ov.querySelector(sel);
      if (!el) return null;
      const r = uiRect(el);
      return { left: r.left - ovR.left, top: r.top - ovR.top, width: r.width, height: r.height };
    };
    const energyEl = stage ? stage.querySelector('.sts-energy b') : null;
    return {
      cards,
      phase: stage ? stage.dataset.phase : null,
      energy: energyEl ? parseInt(energyEl.textContent, 10) : null,
      drawPile: rectOf('.sts-hud-l .bt-pile'),
    };
  }
  // 离场去处：指向敌人/自己 → 单位立绘中心；常规打出/倾倒 → 弃牌堆徽标；注能牺牲品 → 原地碎化上飘
  function exitSinkFor(ev, rect, body, ovR) {
    const centerOf = (el) => {
      const r = uiRect(el);
      return { x: r.left - ovR.left + r.width / 2, y: r.top - ovR.top + r.height / 2 };
    };
    if (ev.kind === 'play') {
      if (ev.side === 'enemy' && ev.target != null) {
        const foe = body.querySelector(`.sts-foe[data-eidx="${ev.target}"] .sts-figure`);
        if (foe) return { ...centerOf(foe), scale: 0.42, dur: 400, fade: 0.08 };
      }
      if (ev.side === 'self') {
        const me = body.querySelector('#btSelf .sts-figure');
        if (me) return { ...centerOf(me), scale: 0.42, dur: 400, fade: 0.08 };
      }
      const disc = document.querySelector('.sts-hud-r .bt-pile');
      if (disc) return { ...centerOf(disc), scale: 0.3, dur: 380, fade: 0.25 };
    }
    if (ev.kind === 'dump') {
      const disc = document.querySelector('.sts-hud-r .bt-pile');
      if (disc) return { ...centerOf(disc), scale: 0.3, dur: 380, fade: 0.25 };
    }
    return { x: rect.left + rect.width / 2, y: rect.top - 80, scale: 0.5, dur: 460, fade: 0, burn: true };
  }
  // 回合过渡横幅（批次F，STS2 Enemy Turn 式）：细带横穿战场中带，文字滑入-停留-滑出
  function showTurnBanner(text, side) {
    const ov = UI.el.overlay;
    if (!ov) return;
    SDT.Sound.sfx(side === 'foe' ? 'turnFoe' : 'turnSelf');   // 回合权交接提示音（P1#4）
    const el = document.createElement('div');
    el.className = `bt-turnbanner ${side === 'foe' ? 'foe' : 'self'}`;
    el.innerHTML = `<b>${esc(text)}</b>`;
    ov.appendChild(el);
    setTimeout(() => el.remove(), 1450);
  }
  // WAAPI 防冻保护：遮挡/后台 webview 里文档时间线可能被冻结（currentTime 恒 0），
  // 动画会永远停在第一帧（例如把手牌钉在敌方阶段的 0.08 透明度）——起跑失败就取消，
  // 让声明式 CSS 的两端状态兜底。健康环境下 currentTime 正常推进，永不触发。
  function animateSafe(el, keyframes, options) {
    if (!el.animate) return null;
    const anim = el.animate(keyframes, options);
    const delay = (options && options.delay) || 0;
    // 兜底窗口须覆盖正常播完的时间（duration 可能 > 300，如回合升回 380ms），
    // 否则正常播放中的动画会被当成「没按时启动」误杀（09-12 实机）
    const dur = (options && options.duration) || 0;
    setTimeout(() => {
      if (anim.playState === 'running' && (anim.currentTime == null || anim.currentTime < delay + 30)) {
        try { anim.cancel(); } catch (e) { /* 已被移除的元素上取消会抛，忽略 */ }
      }
    }, delay + Math.max(300, dur + 200));
    return anim;
  }
  // 手牌区沉/升动画追踪（09-12 实机 bug：下沉动画 fill:forwards 在常驻节点上永续保持，
  // 升回动画无 fill、播完效果消失，沉下终态随即复活＝「你的回合」手牌升上来又沉回去）。
  // 同刻至多一对动画：创建新动画前先 cancel 旧的；升回也用 forwards 保持终态（=CSS 默认位）。
  let handPhaseAnims = [];
  function cancelHandPhaseAnims() {
    handPhaseAnims.forEach(a => { try { a.cancel(); } catch (e) { /* 已结束动画 cancel 不抛 */ } });
    handPhaseAnims = [];
  }
  function animateBattleTransition(prev, body, events = [], extraFlightMs = 0) {
    let flightMs = extraFlightMs;
    const handEl = body.querySelector('.sts-hand');
    const stage = body.querySelector('.battle-stage');
    // —— 手牌区随回合显隐：玩家→敌人 下沉退场；敌人→玩家 升回 ——
    //    批次F：过渡同时放回合横幅（STS2 Enemy Turn 式）
    if (handEl && stage && prev && prev.phase != null && handEl.animate) {
      const ph = stage.dataset.phase;
      if (ph === 'enemy' && prev.phase !== 'enemy') {
        cancelHandPhaseAnims();
        handPhaseAnims.push(animateSafe(handEl,
          [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(72%)', opacity: 0.08 }],
          { duration: 300, easing: 'ease-in', fill: 'forwards' }));
        showTurnBanner('敌方回合', 'foe');
      } else if (ph && ph !== 'enemy' && prev.phase === 'enemy') {
        cancelHandPhaseAnims();
        handPhaseAnims.push(animateSafe(handEl,
          [{ transform: 'translateY(72%)', opacity: 0.08 }, { transform: 'translateY(0)', opacity: 1 }],
          { duration: 380, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }));
        showTurnBanner('你的回合', 'self');
      }
    }
    // —— 能量变化脉冲（花费/回复都闪一下）——
    if (stage && prev && prev.energy != null) {
      const energyEl = stage.querySelector('.sts-energy b');
      const now = energyEl ? parseInt(energyEl.textContent, 10) : NaN;
      const orb = stage.querySelector('.sts-energy');
      if (!isNaN(now) && now !== prev.energy && orb && orb.animate) {
        orb.animate(
          [{ filter: 'brightness(1)' }, { filter: 'brightness(1.9) saturate(1.3)' }, { filter: 'brightness(1)' }],
          { duration: 380, easing: 'ease-out' });
      }
    }
    if (!handEl || !events.length) return { flightMs };
    const ov = UI.el.overlay;
    const ovR = uiRect(ov);   // 布局口径：飞卡定位/目标换算
    const played = new Set(), drawn = new Set();
    const shuffles = [];   // 洗入牌动画事件（addDeckCard：「将 X 洗入牌库」）
    const surges = [];     // 法力奔涌逐发演出事件（castRandomSpells 慢动作）
    events.forEach(ev => {
      if (ev.kind === 'draw') drawn.add(ev.uid);
      else if (ev.kind === 'shuffle') shuffles.push(ev);
      else if (ev.kind === 'surge') surges.push(ev);
      else played.add(ev.uid);
    });
    drawn.forEach(u => played.delete(u));   // 打出又回手（不朽斩）：同帧两事件抵消不演
    // —— 牌库图标动画（2026-09-11 需求，约 1.5s）：抽牌脉冲 / 洗入旋光 ——
    const pileEl = body.querySelector('.sts-hud-l .bt-pile');
    if (pileEl) {
      if (drawn.size) { pileEl.classList.add('pile-pulse'); setTimeout(() => pileEl.classList.remove('pile-pulse'), 1600); }
      if (shuffles.length) {
        pileEl.classList.add('pile-shuffle');
        setTimeout(() => pileEl.classList.remove('pile-shuffle'), 1600 + shuffles.length * 250);
        // 洗入牌动画：卡背从手牌区中央飞向牌库图标，旋入消失
        const pileR = uiRect(pileEl);
        shuffles.forEach((ev, i) => {
          const fly = document.createElement('div');
          fly.className = 'sts-cardfly pile-fly';
          const startX = ovR.width / 2 - 55, startY = ovR.height * 0.72;
          fly.style.cssText = `left:${startX}px;top:${startY}px;width:110px;height:150px`;
          ov.appendChild(fly);
          const dx = (pileR.left + pileR.width / 2) - (startX + 55);
          const dy = (pileR.top + pileR.height / 2) - (startY + 75);
          const anim = fly.animate([
            { transform: 'translate(0,0) rotate(-14deg) scale(1)', opacity: 0.25 },
            { transform: `translate(${dx * 0.55}px,${dy * 0.55 - 70}px) rotate(160deg) scale(0.82)`, opacity: 1, offset: 0.55 },
            { transform: `translate(${dx}px,${dy}px) rotate(346deg) scale(0.35)`, opacity: 0.05 },
          ], { duration: 1200, delay: i * 250, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
          anim.onfinish = () => fly.remove();
          setTimeout(() => fly.remove(), 1600 + i * 250);
          flightMs = Math.max(flightMs, 1200 + i * 250);
        });
      }
    }
    // —— 法力奔涌慢动作（2026-09-16 留言「应当慢动作打出4张卡牌」）：每发一张横幅报目 +
    //    法术卡面在手牌区上方站定一拍，再飞向目标敌人；逐发错峰（发间隔 850ms），
    //    看清每一发打的是什么招式 ——
    if (surges.length) {
      const STEP = 850, FLY = 640;
      surges.forEach(ev => {
        const delay = 180 + ((ev.i || 1) - 1) * STEP;
        const wave = document.createElement('div');
        wave.className = 'surge-wave';
        wave.innerHTML = `<b>法力奔涌 · 第 ${ev.i || 1}/${ev.n || surges.length} 发</b><span>【${esc(ev.name || '?')}】→ ${esc(ev.targetName || '')}</span>`;
        wave.style.animationDelay = `${delay}ms`;
        ov.appendChild(wave);
        setTimeout(() => wave.remove(), delay + STEP + 200);
        const clone = document.createElement('div');
        clone.className = 'sts-cardfly surge-fly';
        const sx = ovR.width / 2 - 66, sy = ovR.height * 0.6;
        clone.style.cssText = `left:${sx}px;top:${sy}px;width:132px;height:180px`;
        clone.innerHTML = SDT.Cards.cardHTML ? SDT.Cards.cardHTML(ev.card || { name: ev.name }, 'sm') : esc(ev.name || '');
        ov.appendChild(clone);
        const foeEl = (ev.target != null && ev.target >= 0) ? body.querySelector(`.sts-foe[data-eidx="${ev.target}"]`) : null;
        const fr = foeEl ? uiRect(foeEl) : null;
        const dx = fr ? (fr.left + fr.width / 2) - (sx + 66) : 0;
        const dy = fr ? (fr.top + fr.height / 2) - (sy + 90) : -ovR.height * 0.32;
        const anim = clone.animate([
          { transform: 'translate(0,14px) scale(.7)', opacity: 0 },
          { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 0.16 },
          { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 0.62 },
          { transform: `translate(${dx}px,${dy}px) scale(.32)`, opacity: 0 },
        ], { duration: FLY, delay, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'both' });
        anim.onfinish = () => clone.remove();
        setTimeout(() => clone.remove(), delay + FLY + 300);
        flightMs = Math.max(flightMs, delay + FLY);
      });
    }
    // —— 出牌队列演出（批次F，STS2 NCardPlayQueue）：同一渲染帧打出多张时，克隆体先飞到
    //    手牌区上方的队列位横排站定（按结算次序错开入场），停顿一拍再依次飞向去处——
    //    单张仍直飞（保留原上弓弧线手感）。原卡节点由手牌常驻层差分移除，飞行由克隆体接管 ——
    const playedEvs = events.filter(ev => played.has(ev.uid));
    const queueIdx = new Map();
    playedEvs.forEach(ev => { if (ev.kind === 'play') queueIdx.set(ev.uid, queueIdx.size); });
    const queueN = queueIdx.size;
    playedEvs.forEach(ev => {
      // 攻击动作随卡牌起飞播（P1 时序修正）：法术=cast 施法舒展、武术=atk 起手连命中——
      // atk-wind 320ms ≈ 飞行 400ms，hit 帧正好落在伤害数字冒出瞬间（此前在命中后才播，倒挂）
      if (ev.kind === 'play' && ev.type === '法术') playUnitFrames('cast');   // 批次D：施法动作
      else if (ev.kind === 'play' && ev.type === '武术') playUnitFrames('atk');
      const old = prev && (prev.cards[ev.uid] || Object.values(prev.cards).find(c => c.name === ev.name));
      if (!old) return;
      const sink = exitSinkFor(ev, old.rect, body, ovR);
      const clone = document.createElement('div');
      clone.className = 'sts-cardfly';
      clone.style.cssText = `left:${old.rect.left}px;top:${old.rect.top}px;width:${old.rect.width}px;height:${old.rect.height}px`;
      clone.innerHTML = old.html;
      ov.appendChild(clone);
      const cx0 = old.rect.left + old.rect.width / 2, cy0 = old.rect.top + old.rect.height / 2;
      const q = queueIdx.get(ev.uid);
      if (queueN > 1 && q != null) {
        // 两段式：队列位 = 手牌上方中央横排（卡宽+18px 间距）；入场 300ms 错开 150ms/张，
        // 站定 260ms 后继续飞去处——观感上卡牌按次序「过一遍」而非同时爆开
        const qw = Math.min(120, old.rect.width);
        const step = qw + 18;
        const qx = ovR.width / 2 + (q - (queueN - 1) / 2) * step - cx0;
        const qy = ovR.height * 0.58 - cy0;
        const enter = 300, gap = 150, hold = 260;
        clone.animate([
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: `translate(${qx}px,${qy}px) scale(0.88)`, opacity: 1 },
        ], { duration: enter, delay: q * gap, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' });
        const dx2 = sink.x - (ovR.width / 2 + (q - (queueN - 1) / 2) * step);
        const dy2 = sink.y - ovR.height * 0.58;
        const t2 = enter + q * gap + hold;
        const fly2 = clone.animate([
          { transform: `translate(${qx}px,${qy}px) scale(0.88)`, opacity: 1 },
          { transform: `translate(${qx + dx2}px,${qy + dy2}px) scale(${sink.scale})`, opacity: sink.fade },
        ], { duration: sink.dur, delay: t2, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
        fly2.onfinish = () => clone.remove();
        setTimeout(() => clone.remove(), t2 + sink.dur + 300);   // 兜底清理
        flightMs = Math.max(flightMs, t2 + sink.dur);
        return;
      }
      const dx = sink.x - cx0;
      const dy = sink.y - cy0;
      const bow = -Math.min(130, Math.hypot(dx, dy) * 0.28);   // 弓背朝上
      const fly = clone.animate([
        { transform: 'translate(0px,0px) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.5}px,${dy * 0.5 + bow}px) scale(${((1 + sink.scale) / 2).toFixed(2)})`, opacity: 0.96, offset: 0.55 },
        { transform: `translate(${dx}px,${dy}px) scale(${sink.scale})`, opacity: sink.fade },
      ], { duration: sink.dur, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
      fly.onfinish = () => clone.remove();
      setTimeout(() => clone.remove(), sink.dur + 300);   // 兜底清理
      flightMs = Math.max(flightMs, sink.dur);
    });
    // 新牌飞入 / 幸存者归位已改在手牌常驻层的差分更新里做（updateHand）——
    // 常驻节点不销毁，位移直接从旧目标值补间到新目标值，不再依赖重建前取样。
    return { flightMs };
  }

export { captureBattleView, animateSafe, animateBattleTransition };
