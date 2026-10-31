import { GUN_POOL_IDS } from '../effects/requested-card-batch.js';
import { createRequestedDomain } from '../effects/requested-card-runtime.domain.js';
import { esc } from '../../core/shared.js';
import { splitEffectClauses } from '../effects/battle.effects.js';
import { assertCardRulesExecutable, createCardRuleExecution, rejectUnsupportedCard } from '../effects/battle.rule-guard.js';
import { hasStructuredEquipField, hasStructuredTrigger } from '../../cards/card-trigger-contract.js';
import { equipmentExecutionPlan } from '../../cards/card-execution-plan.js';
import { inspectCardRuleCapability } from '../../cards/card-rules.capability.js';
import { matchesHandSelectKey } from '../core/battle.hand-selection.js';
import { matchesHandReleaseCard } from '../core/battle.draw.domain.js';

/** Instance-owned state and host services are captured explicitly. */
export function createEquipmentDomain(context) {
const instanceRuntime = context.runtime;
const { requestedBattleState } = createRequestedDomain(context);
const Combat = context.combat;
const getHostedExecutionCard = context.normalizeCard;
/* battle.equipment.js —— 已穿戴装备、主动技能与开战被动（自 battle.engine.js 拆出）。
 * 规则数据经 battle.runtime.js 活绑定直读；引擎侧结算件由 createBattleEquipment 注入。 */

function createBattleEquipment({ cards = context.cards,
  findCard = uid => instanceRuntime.G?.ownedCards?.find(entry => entry.uid === uid) || null,
  hasPendingEndTurn = () => false,
  requestBattleRender, clearTargetSession, queueBattleAction, runStagedSteps,
  applyTextEffects, sweepDead, alive, finish, throwIfActionCancelled,
  processChoice, processDiscoverQueue, processHandSelect, randomDiscoverCard,
  addTempCard, fireCatGift, handSelectQueue,
  // M2：结构化装备域（onEquip/battleStart/passive/skill ops）经 triggers runner 的合成卡执行
  triggersM2, resolveCardSteps,
}) {
  // ---------- 已穿戴装备（2026-09-09 老板 #9）----------
  // 打出装备卡即视为穿戴：角色信息区列出装备与说明；带「主动技能：」的装备额外提供一个
  // 可点击技能（每场一次），技能文本交真实执行器结算（各装备句式早已实装）。
  // 2026-09-16 留言「将装备的限定技能改成主动技能」：措辞改主动技能，兼容旧档快照里的「限定技能」
  const EQUIP_SKILL_PATTERN = /(?:主动技能|限定技能)[：:]\s*([^。]*(?:。|$))/;
  function equipSkillText(card) {
    card = getHostedExecutionCard(card);
    // 文字只用于展示；结构化主动技能仍由 ops 单路径执行。
    const structured = hasStructuredEquipField(card, 'skill');
    if (structured && !card.rules.equip?.skill?.ops?.length) return '';
    const m = EQUIP_SKILL_PATTERN.exec(String(card && card.desc || ''));
    return m ? m[1].trim() : structured ? '发动装备主动技能' : '';
  }
  function registerEquip(uid, card) {
    if (!card || card.type !== '装备') return;
    card = getHostedExecutionCard(card);
    if (instanceRuntime.equipped.some(e => e.uid === uid)) return;
    assertCardRulesExecutable(card);
    const entry = { uid, card, used: false };
    instanceRuntime.equipped.push(entry);
    context.equipmentSemantics?.registerEquipment(entry);
    if (!hasStructuredEquipField(card, 'passive') && card.id === 'tt13-astrolabe') requestedBattleState().astrolabes[uid] = { firstTurn:instanceRuntime.turn };
    instanceRuntime.G.log(`[[icon:tools]] 装配【<b>${esc(card.name)}</b>】（${instanceRuntime.equipped.length}/${equipCap()} 件）${equipSkillText(card) ? '——主动技能已就绪' : ''}`, 'ok');
    // M2：结构化装备域——rules.equip 键位消费（G5 落地）
    const rules = card.rules && card.rules.equip;
    if (rules) {
      // onEquip：穿戴时立即结算（草甲「装备时获得 5 点护甲」）
      const onEquip = equipmentExecutionPlan(card, 'onEquip');
      if (onEquip.ops?.length && triggersM2) {
        triggersM2.resolveEquipOps(card, onEquip.ops);
      }
      // battleStart：战斗中穿戴时立即补发（迎战装备的开战路径走 applyBattleStartPassives 既有通道）
      const battleStart = equipmentExecutionPlan(card, 'battleStart');
      if (battleStart.ops?.length && triggersM2) {
        triggersM2.resolveEquipOps(card, battleStart.ops);
        instanceRuntime.G.log(`[[icon:sparkles]] 【${esc(card.name)}】开战效果在穿戴时补发（战斗中装配）`, 'sys');
      }
      // passive.aura 静态数值光环（atk/spellPower 穿戴即结算；focus 每回合能量由回合管线读 equipped）
      applyStaticAura(card);
    }
    syncCurseCondEquips();   // 条件装备（深海印记类）穿上时即按当前诅咒状态核算
  }
  function applyStaticAura(card) {
    const passive = card.rules?.equip?.passive;
    const aura = passive?.aura;
    if (!aura || passive.cond) return;
    if (aura.atk) Combat.addBlessing(instanceRuntime.pstat, 'atkUp', aura.atk);
    if (aura.spellPower) Combat.addBlessing(instanceRuntime.pstat, 'spellUp', aura.spellPower);
    if (aura.atk || aura.spellPower) {
      instanceRuntime.G.log(`[[icon:crystal]] 【${esc(card.name)}】光环生效：${aura.atk ? `攻 +${aura.atk} ` : ''}${aura.spellPower ? `法伤 +${aura.spellPower}` : ''}`, 'ok');
    }
  }
  // 需求 #18（2026-09-09）：装备最多同时装配 2 件；圣剑化身「装备上限 +1」生效
  function equipCap() {
    let bonus = instanceRuntime.pstat?.status?.equipCapacityBonus || 0;
    (instanceRuntime.G.ownedCards || []).forEach(o => {
      bonus += Number(o.card?.rules?.battle?.ownedEquipCapacity) || 0;
      const m = o.card && !hasStructuredTrigger(o.card, 'onPlay') && String(o.card.desc || '').match(/装备上限\s*\+\s*(\d+)/);
      if (m) bonus += +m[1];
    });
    if (instanceRuntime.nestSyn.grass3) return 99;            // 3 草：装备栏无上限
    return 2 + bonus + (instanceRuntime.nestSyn.grass1 ? 1 : 0);   // 1 草：装备上限 +1
  }

  // ---------- 条件装备「诅咒状态下，攻 +N，法伤 +M」（深海印记/深海咒印）----------
  // 2026-09-09 留言 #2：按一次性结算时「未诅咒时穿=永不生效、诅咒后穿=永久增益」都与卡面
  // 「诅咒状态下」语义不符。改为穿戴期间动态核算：身负诅咒 → 加成生效，解除 → 自动扣除。
  const CURSE_COND_EQUIP = /诅咒状态[下时]/;
  function syncCurseCondEquips() {
    if (!instanceRuntime.equipped || !instanceRuntime.equipped.length) return;
    const cursed = Combat.hasCurse(instanceRuntime.pstat);
    instanceRuntime.equipped.forEach(e => {
      if (e.card.type !== '装备') return;
      // 结构化声明优先；两种来源共用同一差量结算，解除诅咒时收回已加数值。
      const sr = e.card.rules && e.card.rules.equip && e.card.rules.equip.passive;
      let atk, sp;
      if (sr && sr.cond && sr.cond.hasCurse) {
        const aura = sr.aura || {};
        atk = aura.atk || 0; sp = aura.spellPower || 0;
      } else {
        if (hasStructuredEquipField(e.card, 'passive')) return;
        const desc = String(e.card.desc || '');
        if (equipSkillText(e.card) || !CURSE_COND_EQUIP.test(desc)) return;
        const atkM = desc.match(/攻\s*\+\s*(\d+)/) || desc.match(/攻击\s*\+\s*(\d+)/);
        const spM = desc.match(/法伤\s*\+\s*(\d+)/);
        atk = atkM ? +atkM[1] : 0; sp = spM ? +spM[1] : 0;
      }
      const want = cursed ? { atk, sp } : { atk: 0, sp: 0 };
      const had = e._condApplied || { atk: 0, sp: 0 };
      const dAtk = want.atk - had.atk, dSp = want.sp - had.sp;
      if (!dAtk && !dSp) return;
      if (dAtk) Combat.addBlessing(instanceRuntime.pstat, 'atkUp', dAtk);
      if (dSp) Combat.addBlessing(instanceRuntime.pstat, 'spellUp', dSp);
      e._condApplied = want;
      instanceRuntime.G.log(want.atk || want.sp
        ? `[[icon:crystal]] <b>${esc(e.card.name)}</b>：身负诅咒，条件加成生效（攻 +${want.atk}${want.sp ? `，法伤 +${want.sp}` : ''}）`
        : `[[icon:cross]] <b>${esc(e.card.name)}</b>：诅咒解除，条件加成收回`, want.atk || want.sp ? 'ok' : 'dim');
    });
  }
  /** Read-only authority for both skill input and its displayed availability.
   * @returns {{usable:boolean,state:'ready'|'passive'|'used'|'busy'|'unavailable',why:string}} */
  function getEquipSkillAvailability(uid) {
    const entry = instanceRuntime.equipped.find(item => item.uid === uid);
    if (!entry) return { usable:false, state:'unavailable', why:'装备已不在穿戴栏中' };
    const card = getHostedExecutionCard(entry.card);
    const capability = inspectCardRuleCapability(card);
    if (!capability.ok) return { usable:false, state:'unavailable', why:'装备规则暂不可执行' };
    const structured = hasStructuredEquipField(card, 'skill');
    const skill = structured ? card.rules.equip?.skill : null;
    if (structured ? !skill?.ops?.length : !equipSkillText(card)) {
      return { usable:false, state:'passive', why:'此装备没有主动技能' };
    }
    if (entry.used && skill?.oncePerBattle !== false) {
      return { usable:false, state:'used', why:'主动技能本场已经用过了' };
    }
    if (instanceRuntime.busy || instanceRuntime.infusing || instanceRuntime.discovering ||
        instanceRuntime.choosing || instanceRuntime.handSelecting || hasPendingEndTurn()) {
      return { usable:false, state:'busy', why:'请先完成当前动作或选择' };
    }
    // Only the first operation requires existing input; later operations may use cards drawn earlier.
    const first = skill?.ops[0];
    if (first?.op === 'handSelect') {
      const matched = instanceRuntime.hand.some(handUid => {
        const candidate = findCard(handUid);
        return candidate && matchesHandSelectKey(candidate.card, first.type);
      });
      if (!matched) return { usable:false, state:'unavailable', why:'先取得一张符合条件的手牌再发动' };
    }
    if (first?.op === 'release' && first.source === 'hand') {
      const key = first.key === '初始攻击' ? '杀' : first.key;
      if (!instanceRuntime.hand.some(handUid => matchesHandReleaseCard(findCard(handUid)?.card, key))) {
        return { usable:false, state:'unavailable', why:'先取得可施放的匹配手牌再发动' };
      }
    }
    if (!structured && (card.id === 'tt3-crimson-pouch' || card.id === 'tt7-naturestaff') && !instanceRuntime.hand.length) {
      return { usable:false, state:'unavailable', why:'先取得一张手牌再发动' };
    }
    if (!structured && card.id === 'tt3eq-boiler' && instanceRuntime.hand.length < 2) {
      return { usable:false, state:'unavailable', why:`注能(2) 需要消耗 2 张手牌，当前只有 ${instanceRuntime.hand.length} 张` };
    }
    return { usable:true, state:'ready', why:'主动技能已就绪' };
  }
  function useEquipSkill(uid) {
    const e = instanceRuntime.equipped.find(x => x.uid === uid);
    if (!e) return;
    const executionCard = getHostedExecutionCard(e.card);
    if (rejectUnsupportedCard(executionCard, { warn: message => instanceRuntime.G.log(message, 'warn') })) return;
    const availability = getEquipSkillAvailability(uid);
    if (!availability.usable) {
      if (availability.state === 'used' || availability.state === 'unavailable') {
        instanceRuntime.G.log(`[[icon:cross]] 【${esc(e.card.name)}】${esc(availability.why)}`, 'warn');
      }
      return;
    }
    const text = equipSkillText(executionCard);
    // 结构化技能优先于展示文字，避免同一主动技能双结算。
    const structuredSkill = hasStructuredEquipField(executionCard, 'skill') ? executionCard.rules.equip?.skill : null;
    if (!structuredSkill && e.card.id === 'tt13-magazine') {
      clearTargetSession();
      const pool = cards.all().filter(card => GUN_POOL_IDS.includes(card.id));
      if (!pool.length) return;
      e.used = true;
      for (let i = 0; i < 2; i++) {
        const card = randomDiscoverCard(candidate => GUN_POOL_IDS.includes(candidate.id));
        if (card) addTempCard(card);
      }
      requestBattleRender();
      return;
    }
    if (structuredSkill) {
      const once = structuredSkill.oncePerBattle !== false;
      const battleToken = instanceRuntime.battleState.token, ownerGame = instanceRuntime.G;
      clearTargetSession();
      queueBattleAction(async signal => {
        throwIfActionCancelled(signal);
        if (!instanceRuntime.equipped.includes(e) || (once && e.used)) return;
        // 复用真实分段执行器，异步伤害、发现与后续选择都属于同一动作。
        try {
          const currentCard = getHostedExecutionCard(e.card);
          assertCardRulesExecutable(currentCard);
          const currentSkill = currentCard.rules?.equip?.skill;
          if (!currentSkill || !currentSkill.ops.length) return;
          const handSelectionOnly = currentSkill.ops.length === 1 && currentSkill.ops[0].op === 'handSelect';
          const onHandSelectDone = handSelectionOnly && once ? () => {
            if (instanceRuntime.G === ownerGame && ownerGame?.battleActive
                && instanceRuntime.battleState.token === battleToken && instanceRuntime.equipped.includes(e)) e.used = true;
          } : undefined;
          const synthetic = createCardRuleExecution(currentCard, currentSkill.ops);
          instanceRuntime.G.log(`[[icon:sparkles]] <b>${esc(e.card.name)}</b> ${handSelectionOnly ? '准备发动主动技能，选择手牌后生效' : '主动技能发动'}`, 'ok');
          await runStagedSteps(resolveCardSteps(synthetic, alive()[0] || null, { onHandSelectDone }), signal);
          throwIfActionCancelled(signal);
          if (once && !handSelectionOnly) e.used = true;
        } catch (error) {
          if (error?.name !== 'BattleActionCancelledError') {
            instanceRuntime.G.log(`[[icon:cross]] 【${esc(e.card.name)}】主动技能未完成，本场次数未消耗`, 'warn');
          }
          throw error;
        }
        sweepDead();
        if (!alive().length) { finish(true); return; }
        processChoice(); processDiscoverQueue(); processHandSelect();
        requestBattleRender();
      }, '装备技能');
      return;
    }
    // 魔法锅炉的「注能」是装备技能代价：先强制消耗 2 张手牌，完成后随机入手 3 张，
    // 不走「发现」面板。燃料不足时不消耗本场唯一一次技能。
    if (e.card.id === 'tt3eq-boiler') {
      const need = 2;
      clearTargetSession();
      e.used = true;
      instanceRuntime.G.log(`[[icon:sparkles]] <b>${esc(e.card.name)}</b> 主动技能：注能(${need})，随机获取 3 张卡牌`, 'ok');
      handSelectQueue.push({
        n: need, act: 'consume', mandatory: true, srcCard: e.card,
        onDone: () => {
          const got = [];
          for (let i = 0; i < 3; i++) {
            const card = randomDiscoverCard(null);
            if (!card) break;
            addTempCard(card);
            fireCatGift(card);
            got.push(card.name);
          }
          instanceRuntime.G.log(`[[icon:cards]] <b>${esc(e.card.name)}</b>：随机获取 ${got.length} 张卡牌${got.length ? `（${got.map(esc).join('、')}）` : ''}`, 'loot');
        },
      });
      processHandSelect();
      requestBattleRender();
      return;
    }
    clearTargetSession();
    queueBattleAction(async signal => {
      throwIfActionCancelled(signal);
      if (!instanceRuntime.equipped.includes(e) || e.used) return;
      e.used = true;
      instanceRuntime.G.log(`[[icon:sparkles]] <b>${esc(e.card.name)}</b> 主动技能：${esc(text)}`, 'ok');
      const target = alive()[0] || null;
      if (applyTextEffects.steps) await runStagedSteps(applyTextEffects.steps(executionCard, text, target, {}), signal);
      else applyTextEffects(executionCard, text, target, {});
      throwIfActionCancelled(signal);
      sweepDead();
      if (!alive().length) { finish(true); return; }
      processChoice();
      processDiscoverQueue();
      requestBattleRender();
    }, '装备技能');
  }
  // ---------- 开战被动（2026-09-09 老板定向 Q1）：描述带「对战开始时」的装备卡，持有即自动生效 ----------
  // 2026-09-10 留言 #35 定版改为「勾选生效」：编组时玩家勾选哪些开战装备，战斗开始才装配哪些。
  // M3 收编：rules.equip.battleStart 声明同样构成开战装备（结构化单源，desc 判定保留给未迁卡）
  const isBattleStartEquip = (card) => {
    card = getHostedExecutionCard(card);
    const source = equipmentExecutionPlan(card, 'battleStart');
    return !!card && card.type === '装备' && (source.kind === 'structured'
      ? Array.isArray(source.ops) && source.ops.length > 0
      : /对战开始时/.test(String(card.desc || '')));
  };
  function applyBattleStartPassives() {
    // 对战开始时的装备只能在 BOSS 战中使用（2026-09-10 需求）：普通战斗不再自动生效
    if (instanceRuntime.mode !== 'boss') return;
    const chosen = (instanceRuntime.G.ownedCards || []).filter(o => o.card && isBattleStartEquip(o.card) && instanceRuntime.sel.has(o.uid))
      .map(o => ({ ...o, card: getHostedExecutionCard(o.card) }))
      .filter(o => !rejectUnsupportedCard(o.card, { warn: message => instanceRuntime.G.log(message, 'warn') }))
      .filter(o => !(o.uid != null && instanceRuntime.consumed.includes(o.uid)))
      .slice(0, Math.max(0, equipCap() - instanceRuntime.equipped.length));
    // 自动装配与手动穿戴共用装备栏位。
    chosen.forEach(o => {
      if (!instanceRuntime.equipped.some(e => e.uid === o.uid)) instanceRuntime.equipped.push({ uid: o.uid, card: o.card, used: false });
      triggersM2?.registerCard?.(o.card, o.uid, { battleStarted: false });
    });
    if (!chosen.length) return;
    instanceRuntime.G.log(`[[icon:bolt]] 开战被动：${chosen.map(o => esc(o.card.name)).join('、')} 自动生效`, 'ok');
    chosen.forEach(o => {
      // 开战装配即消耗；全部先退出可用牌区，避免抽牌效果再次抽到待装配的装备。
      // 旧档缺少 UID 时不写消耗记录，避免结算误删其他缺 UID 卡。
      if (o.uid != null) {
        instanceRuntime.consumed.push(o.uid);
        if (!instanceRuntime.grave.includes(o.uid)) instanceRuntime.grave.push(o.uid);
        for (const pile of [instanceRuntime.hand, instanceRuntime.drawPile, instanceRuntime.discard]) {
          for (let i = pile.length - 1; i >= 0; i--) {
            if (pile[i] === o.uid) pile.splice(i, 1);
          }
        }
      }
    });
    chosen.forEach(o => {
      applyStaticAura(o.card);
      const onEquip = equipmentExecutionPlan(o.card, 'onEquip');
      if (onEquip.ops?.length && triggersM2) {
        triggersM2.resolveEquipOps(o.card, onEquip.ops);
      }
      // M3 收编：rules.equip.battleStart 单路径（runner 合成卡结算）；仅未迁卡走 desc 文本
      const battleStart = equipmentExecutionPlan(o.card, 'battleStart');
      if (battleStart.kind === 'structured') {
        if (battleStart.ops.length && triggersM2) triggersM2.resolveEquipOps(o.card, battleStart.ops);
        return;
      }
      const parts = splitEffectClauses(String(o.card.desc || ''));
      const text = parts.immediate.join('，');
      if (text) applyTextEffects(o.card, text, alive()[0] || null, {});
    });
    syncCurseCondEquips();
  }

  return {
    equipSkillText, registerEquip, equipCap, syncCurseCondEquips, useEquipSkill, getEquipSkillAvailability,
    isBattleStartEquip, applyBattleStartPassives,
  };
}
return { createBattleEquipment };
}
