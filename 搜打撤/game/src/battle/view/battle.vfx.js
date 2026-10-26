/** @typedef {import("./battle.dom.types.js").BattleElement} BattleElement */
/* 消费既有战斗反馈队列，驱动图集、动作与血条；沿用 spawnFloats 对外接口。
 * 此处不创建飘字或贴纸，图形生命周期由 battle.fx-art.js 维护。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { rect as uiRect } from '../../ui/ui-scale.js';
import { demoMs, getPace } from '../runtime/battle.pace.js';
import { schedulePresentation, schedulePresentationMs, waitHitStop } from '../runtime/battle.clock.js';
import { FEEDBACK_DELTA_MS, enqueueFeedback, feedbackClass, feedbackDelay, feedbackShakeDuration, waitMs } from './battle.feedback.js';
import { play as playUnitFrames } from './battle.frames.js';
import { takeCardAction } from './battle.action-timing.js';
import { storeGet } from '../../core/storage.js';
import { takeFloats } from '../core/battle.core.js';
import { impactProfile } from './battle.attack-profiles.js';
import { playEnemyMotion } from './battle.enemy-motion.js';
import { battleFigureRect as feedbackRect, emitBattleArt, emitBattleTrail, damageArtKind } from './battle.fx-art.js';
const foeHurtTimers = new WeakMap();
const shakeAnimations = new WeakMap();

/* W5-01（2026-09-27 R2）：击败瞬间舞台震动+亮帧。现况只有单位本体 stsShake，
 * 舞台级 Accent 缺位=「击败最后一个敌人」与普通重击同观感（透镜 #68 时刻）。
 * 双门：设置页屏幕震动开关（sdt-reduce-shake，勾选='1'=关）+reduceMotion；
 * WAAPI transform/filter 合成器通道，一次性 220/210ms 不与卡体 fx-victory 叠。 */
function stageKillBeat() {
  if (storeGet('sdt-reduce-shake') === '1') return;
  if (SDT.Motion?.reduceMotion?.()) return;
  const stage = /** @type {BattleElement} */ (document.querySelector('#overlay .battle-stage'));
  if (!stage || typeof stage.animate !== 'function') return;
  const kf = [];
  for (let i = 0; i <= 8; i++) {
    const decay = 1 - i / 8;
    kf.push({ transform: `translate(${(Math.sin(i * 2.7) * 3 * decay).toFixed(1)}px, ${(Math.cos(i * 3.3) * 2 * decay).toFixed(1)}px)` });
  }
  stage.animate(kf, { duration: 230, easing: 'linear' });
  emitBattleArt(stage, 'pulse', { size: 360, duration: 260 });
}
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
      { transform: `translateX(${(-8 * power).toFixed(1)}px)`, filter: 'brightness(1.08)', offset: lead + 0.25 * (1 - lead) },
      { transform: `translateX(${(-3 * power).toFixed(1)}px)`, filter: 'brightness(1.15)', offset: lead + 0.6 * (1 - lead) },
      { transform: 'translateX(0)', filter: 'none', offset: 1 },
    ];
    figEl.animate(kf, { duration: total, easing: 'ease-out' });
  }
  function playFoeHurtFrame(figEl) {
    const unit = figEl.closest('.sts-foe');
    const img = /** @type {HTMLImageElement} */ (figEl.querySelector('img'));
    if (!unit || !img) return;
    foeHurtTimers.get(unit)?.();
    unit.classList.remove('fx-hit');
    void img.offsetWidth;
    unit.classList.add('fx-hit');
    const finish = event => {
      if (event && event.animationName !== 'btFoeHurt') return;
      unit.classList.remove('fx-hit');
      img.removeEventListener('animationend', finish);
      foeHurtTimers.get(unit)?.();
      foeHurtTimers.delete(unit);
    };
    img.addEventListener('animationend', finish);
    foeHurtTimers.set(unit, schedulePresentation(() => finish(), 900));
  }
  // 敌方攻击前摇（P1）：立绘向玩家方向突进再回弹——敌人面向左，突进=负 X
  function foeLunge(figEl) {
    if (!figEl || !figEl.animate) return;
    if (playEnemyMotion(figEl, 'attack')) return;
    figEl.animate([
      { transform: 'translateX(0)' },
      { transform: 'translateX(-14px) scale(1.04)', offset: 0.45 },
      { transform: 'translateX(0)' },
    ], { duration: demoMs(260), easing: 'cubic-bezier(.3,.7,.4,1)' });
  }
  const CUE_ATTACKER_ACTION = Object.freeze({ 'player-attack': 'atk', 'player-spell': 'cast' });
  const CUE_HIT_SOUND = Object.freeze({ hit: 'hit', strike: 'strike',
    ...Object.fromEntries(['attackSlash', 'attackArrow', 'attackBlunt', 'attackBossHeavy', 'attackFire',
      'attackIce', 'attackLightning', 'attackPierce', 'attackPoison', 'attackPsychic'].map(id => [id, id])) });
  function curseFlash(fig, cls) {
    const key = (String(cls).match(/curse-(\w+)/) || [])[1];
    const kind = { freeze: 'ice', poison: 'poison', abreak: 'debuff', bleed: 'debuff', healban: 'debuff' }[key] || 'curse';
    emitBattleArt(fig.closest('.battle-stage'), kind, { anchor: fig, size: 160, duration: 680 });
  }
  function foeAttackLine(body, fig) {
    const stage = body.querySelector('.battle-stage'), me = body.querySelector('#btSelf .sts-figure');
    if (!stage || !me) return;
    const origin = uiRect(UI.el.overlay), a = feedbackRect(fig), b = feedbackRect(me);
    emitBattleTrail(stage, { x: a.left - origin.left + a.width / 2, y: a.top - origin.top + a.height * .42 },
      { x: b.left - origin.left + b.width / 2, y: b.top - origin.top + b.height * .42 }, { duration: demoMs(300), size: 130 });
  }
  async function globalHitStop(ms, signal) {
    if (!(ms > 0) || SDT.Motion?.reduceMotion() || signal?.aborted) return;
    await waitHitStop(ms, signal);
  }
  function presentHitHealth(body, unit, hp, maxHp, instant = false) {
    if (unit == null || !(maxHp > 0) || !Number.isFinite(Number(hp))) return;
    const target = body.querySelector(`.sts-foe[data-eidx="${unit}"]`);
    const wrap = target && /** @type {BattleElement} */ (target.querySelector('.bt-hpwrap'));
    if (!wrap) return;
    const pct = `${Math.max(0, Math.min(100, Number(hp) / maxHp * 100)).toFixed(1)}%`;
    const bars = [/** @type {BattleElement} */ (wrap.querySelector('.sts-hp-main')), /** @type {BattleElement} */ (wrap.querySelector('.sts-hp-ghost'))].filter(Boolean);
    for (const bar of bars) {
      if (instant) {
        bar.style.transition = 'none';
        bar.style.width = pct;
        void bar.offsetWidth;
        bar.style.transition = '';
      } else bar.style.width = pct;
    }
    const text = /** @type {BattleElement} */ (wrap.querySelector('span'));
    if (text) text.textContent = `${Math.max(0, hp)}/${maxHp}`;
  }
  function spawnFloats(body, baseDelay = 0) {
    const list = takeFloats();
    const supportAction = takeCardAction(body, list);
    if (supportAction) playUnitFrames(supportAction);
    if (!list.length) return;
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
      const fire = async signal => {
      const isSelf = f.unit === 'self';
      const allyI = isSelf ? null : (/^ally:(\d+)$/.exec(String(f.unit)) || [])[1];   // 随从替伤：battle.core 推 'ally:N'
      const figEl = isSelf
        ? /** @type {BattleElement} */ (body.querySelector('#btSelf .sts-figure'))
        : allyI != null
          ? body.querySelector(`.sts-ally[data-ally-i="${allyI}"] .sts-figure`)
          : body.querySelector(`.sts-foe[data-eidx="${f.unit}"] .sts-figure`);
      if (!figEl) return;
      // 纯演出指令（无文字）：敌方攻击前摇+弹道 / 诅咒施加彩闪
      if ((f.cls || '').includes('windupfx')) {
        if (!SDT.Motion?.reduceMotion()) {
          figEl.classList.add('bt-hit-anticipate');
          schedulePresentation(() => figEl.classList.remove('bt-hit-anticipate'), 130);
          const attackerAction = CUE_ATTACKER_ACTION[f.cue?.attacker];
          // A combo can continue the same live action without resetting its frames.
          if (attackerAction) {
            playUnitFrames(attackerAction, { continueActive: !!f.cue?.replayAttacker });
            const caster = body.querySelector('#btSelf .sts-figure');
            if (caster) emitBattleArt(caster.closest('.battle-stage'), attackerAction === 'cast' ? 'magic' : 'buff', { anchor: caster, size: 110, duration: 260 });
          }
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
      const amt = Math.abs(parseInt(String(f.text).replace(/[^\d-]/g, ''), 10) || 0);
      const heavy = damage && amt >= 10;   // 重击：≥10 点——更大命中贴图 + 更猛抖动 + 顿帧
      const finisher = damage && feedbackClass(f).includes('fx-finisher');
      // 击杀保留独立停顿；普通连击不逐击暂停，避免多段伤害被拉长。
      const killBoom = (f.cls || '').includes('sticker-boom');
      const cue = f.cue;
      const impact = impactProfile(cue, amt, { kill: killBoom, critical: f.critical, reduced });
      const stopMs = damage || killBoom ? impact.stopMs : 0;
      const elementSound = { fire: 'attackFire', poison: 'attackPoison',
        ice: 'attackIce', lightning: 'attackLightning', arrow: 'attackArrow', blunt: 'attackBlunt',
        pierce: 'attackPierce', psychic: 'attackPsychic' }[f.tintKey || f.type];
      const cueSound = isSelf ? 'hurt' : elementSound || CUE_HIT_SOUND[cue?.hitSound]
        || (cue?.hit === 'target-magic' ? 'attackPsychic' : null);
      if (damage && cueSound) SDT.Sound.sfx(cueSound, cueSound === 'hit'
        ? { rateScale: heavy ? 1.18 : amt >= 5 ? 1.08 : 0.96 } : undefined);
      else if (damage) SDT.Sound.sfx('hit', { rateScale: heavy ? 1.18 : amt >= 5 ? 1.08 : 0.96 });
      if (f.shieldBreak) SDT.Sound.sfx('shieldBreak');
      if ((finisher || killBoom) && !reduced) stageKillBeat();   // W5-01：击败瞬间舞台震动+亮帧（#68 时刻 Accent）
      // STS2 口径：hurt 骨骼/序列帧动画与抖动互斥——帧播上了就不抖；随从无帧集，不代播玩家动作。
      // The windup owns actor frames; hit feedback never restarts that action.
      const framesPlayed = damage && !reduced && isSelf && playUnitFrames('hurt');
      if (damage && !reduced && !framesPlayed) {
        if (isSelf) stsSelfHit(figEl, heavy ? 1.35 : 1);   // 自己：后仰+红染
        else {
          const enemySample = allyI == null && playEnemyMotion(figEl, 'hurt');
          if (!enemySample) {
            if (allyI == null) playFoeHurtFrame(figEl);
            stsShake(figEl, impact.recoil, 0, feedbackShakeDuration(damageBeatCounts.get(String(f.unit)) || 1));
          }
        }
      }
      if (damage && !isSelf && allyI == null && heavy && !reduced) screenShake(body);
      const stage = figEl.closest('.battle-stage');
      // Consume the existing settled feedback queue without constructing floating text or stickers.
      // Damage values remain in health bars and the combat log.
      if (!String(f.cls || '').includes('sticker-hurt')) {
        const kind = f.warm ? 'heal' : isBlock ? 'block' : killBoom ? 'death'
          : stk ? 'buff' : damageArtKind(f);
        emitBattleArt(stage, kind, { anchor: figEl,
          size: Math.round((killBoom ? 210 : f.warm ? 170 : 145) * impact.impactScale),
          duration: demoMs(killBoom ? 780 : f.warm ? 760 : 440),
          angle: isSelf && kind === 'slash' ? 180 : 0,
          tint: f.type === 'true' ? 'saturate(0) brightness(1.2)' : undefined });
      }
      await globalHitStop(stopMs, signal);
      };
      const due = baseDelay + (f.delay || 0) + feedbackDelay(f.unit, perUnit, demoMs(FEEDBACK_DELTA_MS));   // 同单位多段按节拍错开
      const gap = Math.max(0, due - previousDue);
      previousDue = Math.max(previousDue, due);
      enqueueFeedback(async signal => {
        if (!body.isConnected) return;   // 弹层重建已换 ovBody：旧节点全零矩形，残余反馈直接丢弃（防错位闪现在左上角）
        const isSelf = f.unit === 'self';
        const allyI = isSelf ? null : (/^ally:(\d+)$/.exec(String(f.unit)) || [])[1];
        const fig = isSelf
          ? /** @type {BattleElement} */ (body.querySelector('#btSelf .sts-figure'))
          : allyI != null
            ? body.querySelector(`.sts-ally[data-ally-i="${allyI}"] .sts-figure`)
            : body.querySelector(`.sts-foe[data-eidx="${f.unit}"] .sts-figure`);
        const damage = !f.warm && !(f.cls || '').includes('stk') && !(f.cls || '').includes('block') && !(f.cls || '').includes('windupfx');
        if (fig && damage && !f.cue?.frameSynced && !SDT.Motion?.reduceMotion()) {
          fig.classList.add('bt-hit-anticipate');
          try { await waitMs(demoMs(85), signal); } finally { fig.classList.remove('bt-hit-anticipate'); }
        }
        if (f.hpAfter != null) presentHitHealth(body, f.unit, f.hpAfter, f.maxHp);
        await fire(signal);
      }, gap);
    });
  }
  // 轻微抖屏（2026-09-13 老板：自己攻击或造成伤害时）——战斗内容层小幅位移 240ms，抖动中不叠层
  function screenShake(body) {
    if (!body || body.classList.contains('sts-screenshake')) return;
    body.classList.add('sts-screenshake');
    const clear = () => body.classList.remove('sts-screenshake');
    body.addEventListener('animationend', clear, { once: true });
    schedulePresentationMs(clear, 400);   // CSS 动画保持原时长
  }

export { spawnFloats };
