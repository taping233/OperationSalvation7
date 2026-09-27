/* battle.equipment.js —— 已穿戴装备、主动技能与开战被动（自 battle.engine.js 拆出）。
 * 规则数据经 battle.runtime.js 活绑定直读；引擎侧结算件由 createBattleEquipment 注入。 */
import { esc } from '../core/shared.js';
import * as Combat from './combat.js';
import { splitEffectClauses } from './battle.effects.js';
import { G, equipped, nestSyn, pstat, busy, infusing, discovering, choosing, handSelecting, hand, mode, sel } from './battle.runtime.js';
import { getHostedExecutionCard } from './battle.hosted.js';

export function createBattleEquipment({
  requestBattleRender, clearTargetSession, queueBattleAction, runStagedSteps,
  applyTextEffects, sweepDead, alive, finish, throwIfActionCancelled,
  processChoice, processDiscoverQueue, processHandSelect, randomDiscoverCard,
  addTempCard, fireCatGift, handSelectQueue,
  // M2：结构化装备域（onEquip/battleStart/passive/skill ops）经 triggers runner 的合成卡执行
  triggersM2,
}) {
  // ---------- 已穿戴装备（2026-09-09 老板 #9）----------
  // 打出装备卡即视为穿戴：角色信息区列出装备与说明；带「主动技能：」的装备额外提供一个
  // 可点击技能（每场一次），技能文本交真实执行器结算（各装备句式早已实装）。
  // 2026-09-16 留言「将装备的限定技能改成主动技能」：措辞改主动技能，兼容旧档快照里的「限定技能」
  const EQUIP_SKILL_PATTERN = /(?:主动技能|限定技能)[：:]\s*([^。]*(?:。|$))/;
  function equipSkillText(card) {
    card = getHostedExecutionCard(card);
    // M3 收编：卡已迁 rules.equip.skill 时文本技能句不再参与（runner 单路径，防双结算/死数据）
    if (card && card.rules && card.rules.equip && Array.isArray(card.rules.equip.skill && card.rules.equip.skill.ops)) return '';
    const m = EQUIP_SKILL_PATTERN.exec(String(card && card.desc || ''));
    return m ? m[1].trim() : '';
  }
  function registerEquip(uid, card) {
    if (!card || card.type !== '装备') return;
    card = getHostedExecutionCard(card);
    if (equipped.some(e => e.uid === uid)) return;
    equipped.push({ uid, card, used: false });
    G.log(`[[icon:tools]] 装配【<b>${esc(card.name)}</b>】（${equipped.filter(e => !e.passive).length}/${equipCap()} 件）${equipSkillText(card) ? '——主动技能已就绪' : ''}`, 'ok');
    // M2：结构化装备域——rules.equip 键位消费（G5 落地）
    const rules = card.rules && card.rules.equip;
    if (rules) {
      // onEquip：穿戴时立即结算（草甲「装备时获得 5 点护甲」）
      if (Array.isArray(rules.onEquip) && rules.onEquip.length && triggersM2) {
        triggersM2.resolveEquipOps(card, rules.onEquip);
      }
      // battleStart：战斗中穿戴时立即补发（迎战装备的开战路径走 applyBattleStartPassives 既有通道）
      if (Array.isArray(rules.battleStart) && rules.battleStart.length && triggersM2) {
        triggersM2.resolveEquipOps(card, rules.battleStart);
        G.log(`[[icon:sparkles]] 【${esc(card.name)}】开战效果在穿戴时补发（战斗中装配）`, 'sys');
      }
      // passive.aura 静态数值光环（atk/spellPower 穿戴即结算；focus 每回合能量由回合管线读 equipped）
      const aura = rules.passive && rules.passive.aura;
      if (aura && !rules.passive.cond) {
        if (aura.atk) Combat.addBlessing(pstat, 'atkUp', aura.atk);
        if (aura.spellPower) Combat.addBlessing(pstat, 'spellUp', aura.spellPower);
        if (aura.atk || aura.spellPower) {
          G.log(`[[icon:crystal]] 【${esc(card.name)}】光环生效：${aura.atk ? `攻 +${aura.atk} ` : ''}${aura.spellPower ? `法伤 +${aura.spellPower}` : ''}`, 'ok');
        }
      }
    }
    syncCurseCondEquips();   // 条件装备（深海印记类）穿上时即按当前诅咒状态核算
  }
  // 需求 #18（2026-09-09）：装备最多同时装配 2 件；圣剑化身「装备上限 +1」生效
  function equipCap() {
    let bonus = 0;
    (G.ownedCards || []).forEach(o => {
      const m = o.card && String(o.card.desc || '').match(/装备上限\s*\+\s*(\d+)/);
      if (m) bonus += +m[1];
    });
    if (nestSyn.grass3) return 99;            // 3 草：装备栏无上限
    return 2 + bonus + (nestSyn.grass1 ? 1 : 0);   // 1 草：装备上限 +1
  }

  // ---------- 条件装备「诅咒状态下，攻 +N，法伤 +M」（深海印记/深海咒印）----------
  // 2026-09-09 留言 #2：按一次性结算时「未诅咒时穿=永不生效、诅咒后穿=永久增益」都与卡面
  // 「诅咒状态下」语义不符。改为穿戴期间动态核算：身负诅咒 → 加成生效，解除 → 自动扣除。
  const CURSE_COND_EQUIP = /诅咒状态[下时]/;
  function syncCurseCondEquips() {
    if (!equipped || !equipped.length) return;
    const cursed = Combat.hasCurse(pstat);
    equipped.forEach(e => {
      const desc = String(e.card && e.card.desc || '');
      if (e.card.type !== '装备' || equipSkillText(e.card)) return;
      // M2：结构化条件被动（rules.equip.passive.cond + aura）——与文本版同一动态核算模式
      const sr = e.card.rules && e.card.rules.equip && e.card.rules.equip.passive;
      if (sr && sr.cond && sr.cond.hasCurse) {
        const aura = sr.aura || {};
        const want = cursed ? { atk: aura.atk || 0, sp: aura.spellPower || 0 } : { atk: 0, sp: 0 };
        const had = e._condApplied || { atk: 0, sp: 0 };
        const dAtk = want.atk - had.atk, dSp = want.sp - had.sp;
        if (dAtk || dSp) {
          if (dAtk) Combat.addBlessing(pstat, 'atkUp', dAtk);
          if (dSp) Combat.addBlessing(pstat, 'spellUp', dSp);
          e._condApplied = want;
          G.log((want.atk || want.sp)
            ? `[[icon:crystal]] <b>${esc(e.card.name)}</b>：身负诅咒，条件加成生效（攻 +${want.atk}${want.sp ? `，法伤 +${want.sp}` : ''}）`
            : `[[icon:cross]] <b>${esc(e.card.name)}</b>：诅咒解除，条件加成收回`, want.atk || want.sp ? 'ok' : 'dim');
        }
        return;
      }
      if (!CURSE_COND_EQUIP.test(desc)) return;
      const atkM = desc.match(/攻\s*\+\s*(\d+)/) || desc.match(/攻击\s*\+\s*(\d+)/);
      const spM = desc.match(/法伤\s*\+\s*(\d+)/);
      const want = cursed ? { atk: atkM ? +atkM[1] : 0, sp: spM ? +spM[1] : 0 } : { atk: 0, sp: 0 };
      const had = e._condApplied || { atk: 0, sp: 0 };
      const dAtk = want.atk - had.atk, dSp = want.sp - had.sp;
      if (!dAtk && !dSp) return;
      if (dAtk) Combat.addBlessing(pstat, 'atkUp', dAtk);
      if (dSp) Combat.addBlessing(pstat, 'spellUp', dSp);
      e._condApplied = want;
      G.log(want.atk || want.sp
        ? `[[icon:crystal]] <b>${esc(e.card.name)}</b>：身负诅咒，条件加成生效（攻 +${want.atk}${want.sp ? `，法伤 +${want.sp}` : ''}）`
        : `[[icon:cross]] <b>${esc(e.card.name)}</b>：诅咒解除，条件加成收回`, want.atk || want.sp ? 'ok' : 'dim');
    });
  }
  function useEquipSkill(uid) {
    if (busy || infusing || discovering || choosing || handSelecting) return;
    const e = equipped.find(x => x.uid === uid);
    if (!e) return;
    const executionCard = getHostedExecutionCard(e.card);
    const text = equipSkillText(executionCard);
    // M2：结构化主动技能——无「主动技能：」文本时读 rules.equip.skill（oncePerBattle + ops）
    const structuredSkill = !text && executionCard.rules && executionCard.rules.equip && executionCard.rules.equip.skill;
    if (!text && !structuredSkill) return;
    if (e.used) { G.log(`[[icon:cross]] 【${esc(e.card.name)}】的主动技能本场已经用过了`, 'warn'); return; }
    if (structuredSkill) {
      const once = structuredSkill.oncePerBattle !== false;
      if (once && e.used) { G.log(`[[icon:cross]] 【${esc(e.card.name)}】的主动技能本场已经用过了`, 'warn'); return; }
      if (once) e.used = true;
      G.log(`[[icon:sparkles]] <b>${esc(e.card.name)}</b> 主动技能发动`, 'ok');
      if (triggersM2) triggersM2.resolveEquipOps(executionCard, structuredSkill.ops || []);
      requestBattleRender();
      return;
    }
    if ((e.card.id === 'tt3-crimson-pouch' || e.card.id === 'tt7-naturestaff') && !hand.length) {
      G.log(`[[icon:cards]] 【${esc(e.card.name)}】需要先有一张手牌可选，技能次数未消耗`, 'warn');
      return;
    }
    // 魔法锅炉的「注能」是装备技能代价：先强制消耗 2 张手牌，完成后随机入手 3 张，
    // 不走「发现」面板。燃料不足时不消耗本场唯一一次技能。
    if (e.card.id === 'tt3eq-boiler') {
      const need = 2;
      if (hand.length < need) {
        G.log(`[[icon:flask]] 【${esc(e.card.name)}】注能(${need}) 需要消耗 ${need} 张手牌，当前只有 ${hand.length} 张`, 'warn');
        return;
      }
      clearTargetSession();
      e.used = true;
      G.log(`[[icon:sparkles]] <b>${esc(e.card.name)}</b> 主动技能：注能(${need})，随机获取 3 张卡牌`, 'ok');
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
          G.log(`[[icon:cards]] <b>${esc(e.card.name)}</b>：随机获取 ${got.length} 张卡牌${got.length ? `（${got.map(esc).join('、')}）` : ''}`, 'loot');
        },
      });
      processHandSelect();
      requestBattleRender();
      return;
    }
    clearTargetSession();
    queueBattleAction(async signal => {
      throwIfActionCancelled(signal);
      if (!equipped.includes(e) || e.used) return;
      e.used = true;
      G.log(`[[icon:sparkles]] <b>${esc(e.card.name)}</b> 主动技能：${esc(text)}`, 'ok');
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
    return !!card && card.type === '装备' &&
    (!!card.rules?.equip?.battleStart?.length || /对战开始时/.test(String(card.desc || '')));
  };
  function applyBattleStartPassives() {
    // 对战开始时的装备只能在 BOSS 战中使用（2026-09-10 需求）：普通战斗不再自动生效
    if (mode !== 'boss') return;
    const chosen = (G.ownedCards || []).filter(o => o.card && isBattleStartEquip(o.card) && sel.has(o.uid))
      .map(o => ({ ...o, card: getHostedExecutionCard(o.card) }));
    // 开战被动同样算「已穿戴」——角色信息区一并列出（老板 #9）；
    // passive=true：不占用 #18 的 2 件装配上限（勾选即生效，未经打出装配）
    chosen.forEach(o => {
      if (!equipped.some(e => e.uid === o.uid)) equipped.push({ uid: o.uid, card: o.card, used: false, passive: true });
    });
    if (!chosen.length) return;
    G.log(`[[icon:bolt]] 开战被动：${chosen.map(o => esc(o.card.name)).join('、')} 自动生效`, 'ok');
    chosen.forEach(o => {
      // M3 收编：rules.equip.battleStart 单路径（runner 合成卡结算）；仅未迁卡走 desc 文本
      if (o.card.rules?.equip?.battleStart?.length && triggersM2) {
        triggersM2.resolveEquipOps(o.card, o.card.rules.equip.battleStart);
        return;
      }
      const parts = splitEffectClauses(String(o.card.desc || ''));
      const text = parts.immediate.join('，');
      if (text) applyTextEffects(o.card, text, alive()[0] || null, {});
    });
  }

  return {
    equipSkillText, registerEquip, equipCap, syncCurseCondEquips, useEquipSkill,
    isBattleStartEquip, applyBattleStartPassives,
  };
}
