// One numeric combat implementation, with hooks owned by each consumer.
export function createCombatRuntime() {
/* combat.js —— 战斗公式：四类伤害 / 诅咒 / 增益 / 状态计时（纯计算，不访问 DOM） */
  const TYPES = { ATTACK: 'attack', SPELL: 'spell', FIXED: 'fixed', TRUE: 'true' };
  const TYPE_NAME = { attack: '攻击伤害', spell: '法术伤害', fixed: '固定伤害', true: '真实伤害' };

  // 诅咒状态表：bleed/poison 为叠层（无上限不衰减），其余为计时（共享回合钟：每回合结束统一递减）
  const COMBAT_HOOKS = {};   // 战斗层钩子（冰冻符文等）
const CURSES = ['bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban', 'atkDown'];
  const CURSE_META = {
    bleed:   { name: '流血', icon: '[[icon:status-bleed]]', stack: true,  desc: '每层使受到的攻击伤害 +1' },
    poison:  { name: '中毒', icon: '[[icon:status-poison]]', stack: true,  desc: '每层在回合结束时受到 1 点固定伤害' },
    freeze:  { name: '冰冻', icon: '[[icon:status-freeze]]', stack: false, desc: '1 回合无法行动' },
    silence: { name: '沉默', icon: '[[icon:status-silence]]', stack: false, desc: '1 回合技能无法生效（攻击除外）' },
    abreak:  { name: '破甲', icon: '[[icon:status-armor-break]]', stack: false, desc: '2 回合内无法减免伤害' },
    healban: { name: '禁疗', icon: '[[icon:status-heal-ban]]', stack: false, desc: '2 回合内无法回复生命' },
    // M 批（2026-09-27）：攻击降低（割蚀「降低 2 攻，持续 3 回合」）——计时型共享回合钟；
    // 扣减量由战斗层挂诅咒时记在 target._atkDownAmount，到期由回合管线归还（影噬偷取同款）
    atkDown: { name: '攻击降低', icon: '[[icon:status-atk-down]]', stack: false, desc: '持续期间攻击力降低，到期归还' },
  };

  // 祝福状态表（v0.20）：value=数值型（可叠加，本场战斗）；timed=计时型（共享回合钟递减）；
  // flag=开关型（本局对战常驻）
  const BUFFS = ['atkUp', 'spellUp', 'stealth', 'immune', 'reduce', 'dodge', 'swordForm', 'natureForm', 'cosmosForm'];
  const BUFF_META = {
    atkUp:      { name: '攻击强化', icon: '[[icon:status-atk-up]]', value: true, desc: '攻击伤害 +N（本场战斗）' },
    spellUp:    { name: '法术强化', icon: '[[icon:status-spell-up]]', value: true, desc: '法术伤害 +N（本场战斗）' },
    stealth:    { name: '潜行', icon: '[[icon:status-stealth]]', timed: true, desc: '无法成为被攻击对象；造成伤害会破除潜行' },
    immune:     { name: '免疫伤害', icon: '[[icon:status-immune]]', timed: true, desc: '不受到任何伤害' },
    reduce:     { name: '减伤', icon: '[[icon:status-reduce]]', value: true, desc: '每次受到的伤害 -N（真实伤害除外）' },
    dodge:      { name: '闪避', icon: '[[icon:status-dodge]]', value: true, desc: '避开下一段伤害（每层避开 1 段）' },
    swordForm:  { name: '剑仙形态', icon: '[[icon:status-sword-form]]', flag: true, desc: '回合开始时额外抽 1 张' },
    natureForm: { name: '满月形态', icon: '[[icon:status-moon-form]]', flag: true, desc: '回合开始时额外获得 1 点能量' }, // 2026-10-02 老板：形态更名「满月形态」（内部键 natureForm 保留）
    cosmosForm: { name: '宇宙形态', icon: '[[icon:status-cosmos-form]]', flag: true, desc: '本局对战所有卡牌变为 1 费' },
  };

  // 给任意角色对象补齐战斗字段（玩家与敌人通用）
  function ensureStatus(t) {
    if (!t.status) t.status = {};
    delete t.status.burn; // 已移除的旧状态在存档恢复/结算时清理。
    if (typeof t.status.bleed !== 'number') t.status.bleed = 0;   // 层数无上限、不衰减
    if (typeof t.status.poison !== 'number') t.status.poison = 0; // 每层回合末 1 点固定伤害，不衰减
    // 计时诅咒：剩余的游戏回合数（共享回合钟，每回合结束统一递减 1）
    CURSES.forEach(k => { if (typeof t.status[k] !== 'number') t.status[k] = 0; });
    BUFFS.forEach(k => { if (typeof t.status[k] !== 'number') t.status[k] = 0; });
    if (!t.defense) t.defense = { shield: 0, armor: 0, guard: false };
    if (typeof t.defense.guard !== 'boolean') t.defense.guard = false;
    return t;
  }

  // 卡面记号解析：'3\'' → 3 点法术伤害；'3\'\'' → 3 点真实伤害；
  // 无角标数字返回 type=null（攻击还是固定由卡牌类型/文字决定）
  function parseNotation(text) {
    const m = String(text).trim().match(/^(\d+)('')?(')?$/);
    if (!m) return null;
    if (m[2]) return { amount: +m[1], type: TYPES.TRUE };
    if (m[3]) return { amount: +m[1], type: TYPES.SPELL };
    return { amount: +m[1], type: null };
  }

  // 结算一次伤害。attacker/target 可为任意带 hp/atk/spellPower/status/defense 的对象
  function dealDamage(attacker, target, amount, type, options = {}) {
    type = type || TYPES.ATTACK;
    // 数值兜底（2026-09-28 审计）：同文件 addCurse/addBlessing 同款防线——上游未 coerce
    // 的字段传入 NaN 时按 0 结算，否则 raw/dealt 全线 NaN、浮字与日志显示「NaN 点伤害」
    if (!Number.isFinite(+amount)) amount = 0;
    ensureStatus(target);
    const r = { type, raw: amount, bonus: 0, atkPart: 0, spellPart: 0,
                bleedBonus: 0, absorbed: 0, dealt: 0, overkill: 0, log: [] };

    // 免疫伤害：不受到任何伤害（攻击/法术/固定/真实全部无效）
    if ((target.status.immune || 0) > 0) {
      r.immune = true;
      r.log.push('免疫伤害');
      return r;
    }
    // 潜行：无法成为被攻击对象（造成伤害的一方若在潜行中，由调用方破除其潜行）
    if ((target.status.stealth || 0) > 0) {
      r.stealthed = true;
      r.log.push('潜行：无法成为被攻击对象');
      return r;
    }
    let dmg = amount;
    if (type === TYPES.ATTACK) {
      const atk = ((attacker && attacker.atk) || 0) + ((attacker && attacker.status && attacker.status.atkUp) || 0);
      const bleed = target.status.bleed;
      r.atkPart = atk;
      r.bleedBonus = bleed;
      r.bonus = atk + bleed;
      dmg = amount + atk + bleed;
      if (atk) r.log.push(`攻击力 +${atk}`);
      if (bleed) r.log.push(`流血 +${bleed}`);
    } else if (type === TYPES.SPELL) {
      const sp = ((attacker && attacker.spellPower) || 0) + ((attacker && attacker.status && attacker.status.spellUp) || 0);
      r.spellPart = sp;
      r.bonus = sp;
      dmg = amount + sp;
      if (sp) r.log.push(`法伤加成 +${sp}`);
    }
    // Multipliers apply after attack/spell/bleed additions and before defenses.
    if (Number.isFinite(options.multiplier) && options.multiplier > 0 && options.multiplier !== 1) {
      dmg *= options.multiplier;
      r.log.push(`伤害 ×${options.multiplier}`);
    }
    // Negative printed values may combine with bonuses, but cannot deal negative damage.
    dmg = Math.max(0, dmg);
    // Zero damage cannot consume a layer intended to avoid an actual damage segment.
    if (dmg > 0 && (target.status.dodge || 0) > 0) {
      target.status.dodge -= 1;
      // Spend the soonest-expiring timed layer before permanent layers. A spent
      // source must not expire later and subtract a different dodge grant.
      let expiring = null;
      for (const entry of target.__timedBuffs || []) {
        if (entry.key === 'dodge' && entry.amount > 0 && (!expiring || entry.turns < expiring.turns)) expiring = entry;
      }
      if (expiring) {
        expiring.amount -= 1;
        if (expiring.amount <= 0) {
          const keep = target.__timedBuffs.filter(entry => entry !== expiring);
          target.__timedBuffs = keep.length ? keep : null;
        }
      }
      r.dodged = true;
      r.log.push('闪避：避开这段伤害');
      return r;
    }

    // 破甲（abreak > 0）：目标无法减免伤害——格挡与护盾/护甲吸收全部失效
    const broken = target.status.abreak > 0;

    // 格挡：非真实伤害每次结算降为 1 点；真实伤害无视格挡；破甲状态格挡失效
    if (target.defense.guard && type !== TYPES.TRUE && !broken && dmg > 1) {
      dmg = 1;
      r.guarded = true;
      r.log.push('格挡：伤害降为 1');
    }

    // 减伤（祝福）：每次受到的伤害 -N；真实伤害无视（同格挡/护盾/护甲）
    if ((target.status.reduce || 0) > 0 && type !== TYPES.TRUE && !broken && dmg > 0) {
      const cut = Math.min(target.status.reduce, dmg);
      dmg -= cut;
      r.reduced = cut;
      r.log.push(`减伤 -${cut}`);
    }

    if (type !== TYPES.TRUE && !broken) {
      // 防御吸收：护盾 → 护甲
      const def = target.defense;
      const useShield = Math.min(def.shield || 0, dmg);
      def.shield -= useShield; dmg -= useShield;
      const useArmor = Math.min(def.armor || 0, dmg);
      def.armor -= useArmor; dmg -= useArmor;
      r.absorbed = useShield + useArmor;
      if (r.absorbed) r.log.push(`防御吸收 ${r.absorbed}`);
    } else if (type === TYPES.TRUE) {
      r.log.push('无视防御手段');
    } else {
      r.log.push('破甲：无法减免伤害');
    }

    if (target.damageCap > 0 && type !== TYPES.TRUE && !broken && dmg > target.damageCap) {
      dmg = target.damageCap;
      r.log.push(`伤害上限 ${target.damageCap}`);
    }
    // Necromancer exposure multiplies the final result, after all reductions.
    if (target.status.necroticExposure > 1) {
      dmg *= target.status.necroticExposure;
      r.log.push(`最终承伤 ×${target.status.necroticExposure}`);
    }
    if (options.nonLethal && target.hp != null) dmg = Math.min(dmg, Math.max(0, target.hp - 1));
    r.dealt = dmg;
    if (dmg > 0 && target.hp != null) {
      target.hp -= dmg;
      if (target.hp < 0) { r.overkill = -target.hp; target.hp = 0; }
    }
    if (dmg > 0 && target.hp > 0 && target.behavior === 'witness_pope' && !(target.status.silence > 0)) {
      if (type === TYPES.ATTACK) { target.atk += 1; r.log.push('见证会教皇攻击力 +1'); }
      if (type === TYPES.SPELL && !(target.status.healban > 0)) {
        target.hp = Math.min(target.maxHp, target.hp + 1);
        r.log.push('见证会教皇回复 1 点生命');
      }
    }
    return r;
  }

  // —— 流血（叠层状态）——
  function addBleed(target, n) {
    ensureStatus(target);
    target.status.bleed += n;
    if (target.status.bleed < 0) target.status.bleed = 0;
    if (n > 0) healOnCurse(target);
    return target.status.bleed;
  }
  function clearBleed(target) { ensureStatus(target); target.status.bleed = 0; return 0; }

  // —— 诅咒状态通用（设计者 2026-09-02 定版，规则见文件头）——
  // 挂诅咒：bleed/poison 按层叠加（n≤0/NaN 经下方兜底钳为 1 层，不支持负数减层）；计时类取「剩余较大值」不叠加
  function addCurse(target, key, n) {
    if (!CURSE_META[key]) return 0;
    // 龙巢：黑暗元素的轮换诅咒免疫（noCurseKeys 由战斗层每回合重掷）
    if (target && target.noCurseKeys && target.noCurseKeys.includes(key)) return 0;
    // 层数/回合数兜底：调用方偶发传入 NaN/负值（如无层数的「附加流血」）时按 1 处理，
    // 否则状态会被写成 NaN——角标不显示、后续伤害结算全线变 NaN
    n = Number.isFinite(+n) && +n > 0 ? Math.floor(+n) : 1;
    ensureStatus(target);
    if (CURSE_META[key].stack) {
      target.status[key] = Math.max(0, target.status[key] + n);
    } else {
      target.status[key] = Math.max(target.status[key], n);
    }
    if (key === 'freeze' && COMBAT_HOOKS.onFreeze) COMBAT_HOOKS.onFreeze(target);
    healOnCurse(target);
    return target.status[key];
  }

  function healOnCurse(target) {
    if (target.eliteSkill === 'curseHeal' && !target.dead && target.hp > 0 && !(target.status.healban > 0)) {
      target.hp = Math.min(target.maxHp || target.hp, target.hp + 2);
    }
  }

  // 是否身负任意诅咒（深解印记「诅咒状态下」/ 暗影射击「若对手处于诅咒状态」判定用）
  function hasCurse(target) {
    if (!target || !target.status) return false;
    return CURSES.some(k => (target.status[k] || 0) > 0);
  }

  // 净化：清除身上所有诅咒类型与效果（叠层与计时全部归零）
  function purify(target) {
    ensureStatus(target);
    const cleared = CURSES.filter(k => (target.status[k] || 0) > 0);
    CURSES.forEach(k => { target.status[k] = 0; });
    // Removing the curse also removes its recorded attack reduction immediately.
    if (target._atkDownPending > 0) target.atk = (target.atk || 0) + target._atkDownPending;
    delete target._atkDownAmount;
    delete target._atkDownPending;
    return cleared;
  }

  // 中毒结算：每层 1 点固定伤害（不吃任何加成、不受防御影响；免疫伤害可挡下；
  // 中毒是状态伤害不是攻击——潜行不挡中毒）。层数不衰减。
  function tickPoison(target) {
    ensureStatus(target);
    const stacks = target.status.poison;
    if (stacks <= 0) return null;
    if ((target.status.immune || 0) > 0) {
      return { poisonStacks: stacks, dealt: 0, immune: true, log: ['免疫伤害'] };
    }
    const damage = (target.damageCap > 0 && !(target.status.abreak > 0) ? Math.min(stacks, target.damageCap) : stacks)
      * Math.max(1, target.status.necroticExposure || 1);
    const r = { poisonStacks: stacks, dealt: damage, log: [] };
    if (target.hp != null) {
      target.hp -= damage;
      if (target.hp < 0) { r.overkill = -target.hp; target.hp = 0; }
    }
    return r;
  }

  // 计时状态递减：battle.js 在「每回合结束」（共享回合钟，双方各行动一次）调用一次，
  // 返回本次到点解除的键（冰冻/沉默/破甲/禁疗/潜行/免疫伤害）。
  // 持续 n 回合 = 从触发当回合起覆盖 n 个完整回合（规则见文件头计时规则）
  // 数值型祝福的临时加成（__timedBuffs，见 addBlessing 第 4 参）同期递减，到点从数值中扣除
  function tickDurations(target, { preserveBlessings = false } = {}) {
    if (!target || !target.status) return [];
    const expired = [];
    const timedKeys = CURSES.filter(k => !CURSE_META[k].stack)
      .concat(preserveBlessings ? [] : BUFFS.filter(k => BUFF_META[k].timed));
    timedKeys.forEach(k => {
      if ((target.status[k] || 0) > 0) {
        target.status[k]--;
        if (target.status[k] === 0) expired.push(k);
      }
    });
    if (!preserveBlessings && target.__timedBuffs && target.__timedBuffs.length) {
      const keep = [];
      target.__timedBuffs.forEach(rec => {
        rec.turns -= 1;
        if (rec.turns <= 0) {
          target.status[rec.key] = Math.max(0, (target.status[rec.key] || 0) - rec.amount);
          expired.push(rec.key);
        } else keep.push(rec);
      });
      target.__timedBuffs = keep.length ? keep : null;
    }
    return expired;
  }

  // 能否行动：冰冻 > 0 时轮到该方行动必须跳过（跳过后照常递减计时）
  function canAct(target) {
    if (!target || !target.status) return true;
    return !((target.status.freeze || 0) > 0);
  }

  // —— 祝福（v0.20 设计者定版）——
  // 挂祝福：value 型加数值（可叠加，本场战斗）；timed 型取「剩余较大值」；
  // flag 型置 1（本局对战常驻）。第 4 参 turns>0 时 value 型临时加成在 N 回合后自动扣除
  //（「获得 2 点攻击力，持续 1 回合」类词条；见 tickDurations）。
  function addBlessing(target, key, n, turns) {
    if (!BUFF_META[key]) return 0;
    // NaN 兜底（迭代评审 09-20 G-P3）：与 addCurse 同款 Number.isFinite 防护——
    // 调用方误传 NaN 时 atkUp/spellUp 会被写成 NaN，伤害全线 NaN
    n = n == null ? 1 : (Number.isFinite(+n) ? Math.floor(+n) : 1);
    ensureStatus(target);
    if (COMBAT_HOOKS.canAddBlessing?.(target, key, n) === false) return target.status[key];
    const m = BUFF_META[key];
    if (m.value) {
      target.status[key] = Math.max(0, target.status[key] + n);
      if (turns > 0) {
        if (!target.__timedBuffs) target.__timedBuffs = [];
        // 不同来源/持续时间独立到期。此前按 key 合并并取最长持续时间，会把短时加成错误延长。
        target.__timedBuffs.push({ key, amount: n, turns });
      }
    } else if (m.timed) target.status[key] = Math.max(target.status[key], n);
    else target.status[key] = 1;
    if (COMBAT_HOOKS.onBlessing) COMBAT_HOOKS.onBlessing(target, key, n);   // 战斗层反馈钩（音频 P2#6）
    return target.status[key];
  }

  // 潜行判定与破除（造成伤害后由调用方破除攻击方的潜行）
  function isStealthed(target) {
    return !!((target && target.status && target.status.stealth) > 0);
  }
  function breakStealth(target) {
    if (!isStealthed(target)) return false;
    target.status.stealth = 0;
    return true;
  }

return Object.freeze({ COMBAT_HOOKS, TYPES, TYPE_NAME, dealDamage, addBleed, clearBleed, CURSES, CURSE_META, addCurse, hasCurse, purify, BUFFS, BUFF_META, addBlessing, isStealthed, breakStealth, tickPoison, tickDurations, canAct, parseNotation, ensureStatus });
}
