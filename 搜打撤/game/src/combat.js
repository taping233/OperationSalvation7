/* combat.js —— 战斗公式：四类伤害 / 诅咒 / 增益 / 状态计时（纯计算，不访问 DOM） */
  const TYPES = { ATTACK: 'attack', SPELL: 'spell', FIXED: 'fixed', TRUE: 'true' };
  const TYPE_NAME = { attack: '攻击伤害', spell: '法术伤害', fixed: '固定伤害', true: '真实伤害' };

  // 诅咒状态表：bleed/poison 为叠层（无上限不衰减），其余为计时（共享回合钟：每回合结束统一递减）
  // burn（灼烧）2026-09-08 定版：独立于中毒的计时诅咒——不叠加（重复施加只刷新剩余回合）、
  // 每回合结束时受到 1 点固定伤害（tickBurn 结算）
  const CURSES = ['bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban', 'burn'];
  const CURSE_META = {
    bleed:   { name: '流血', icon: '[[icon:blood]]', stack: true,  desc: '每层使受到的攻击伤害 +1' },
    poison:  { name: '中毒', icon: '[[icon:skull]]', stack: true,  desc: '每层在回合结束时受到 1 点固定伤害' },
    freeze:  { name: '冰冻', icon: '[[icon:crystal]]', stack: false, desc: '1 回合无法行动' },
    silence: { name: '沉默', icon: '[[icon:cross]]', stack: false, desc: '1 回合技能无法生效（攻击除外）' },
    abreak:  { name: '破甲', icon: '[[icon:tools]]', stack: false, desc: '2 回合内无法减免伤害' },
    healban: { name: '禁疗', icon: '[[icon:heart]]', stack: false, desc: '2 回合内无法回复生命' },
    burn:    { name: '灼烧', icon: '[[icon:fire]]', stack: false, desc: '每回合结束时受到 1 点固定伤害（不叠加，重复施加刷新持续时间）' },
  };

  // 祝福状态表（v0.20）：value=数值型（可叠加，本场战斗）；timed=计时型（共享回合钟递减）；
  // flag=开关型（本局对战常驻）
  const BUFFS = ['atkUp', 'spellUp', 'stealth', 'immune', 'reduce', 'swordForm', 'natureForm', 'cosmosForm'];
  const BUFF_META = {
    atkUp:      { name: '攻击强化', icon: '[[icon:swords]]', value: true, desc: '攻击伤害 +N（本场战斗）' },
    spellUp:    { name: '法术强化', icon: '[[icon:crystal]]', value: true, desc: '法术伤害 +N（本场战斗）' },
    stealth:    { name: '潜行', icon: '[[icon:runner]]', timed: true, desc: '无法成为被攻击对象；造成伤害会破除潜行' },
    immune:     { name: '免疫伤害', icon: '[[icon:sparkles]]', timed: true, desc: '不受到任何伤害' },
    reduce:     { name: '减伤', icon: '[[icon:plate]]', value: true, desc: '每次受到的伤害 -N（真实伤害除外）' },
    swordForm:  { name: '剑仙形态', icon: '[[icon:sword]]', flag: true, desc: '回合开始时额外抽 1 张' },
    natureForm: { name: '自然形态', icon: '[[icon:wood]]', flag: true, desc: '回合开始时额外获得 1 点能量' },
    cosmosForm: { name: '宇宙形态', icon: '[[icon:sparkles]]', flag: true, desc: '本局对战所有卡牌变为 1 费' },
  };

  // 给任意角色对象补齐战斗字段（玩家与敌人通用）
  function ensureStatus(t) {
    if (!t.status) t.status = {};
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

  // 预览结算结果（不修改任何状态），战斗界面显示最终数字时用
  function previewDamage(attacker, target, amount, type) {
    const st = (target && target.status) || {};
    const status = {};
    CURSES.concat(BUFFS).forEach(k => { status[k] = st[k] || 0; });
    const clone = { status,
      defense: { shield: (target && target.defense && target.defense.shield) || 0,
                 armor:  (target && target.defense && target.defense.armor)  || 0,
                 guard:  !!((target && target.defense) && target.defense.guard) },
      hp: (target && target.hp) || 0 };
    return dealDamage(attacker, clone, amount, type);
  }

  // 结算一次伤害。attacker/target 可为任意带 hp/atk/spellPower/status/defense 的对象
  function dealDamage(attacker, target, amount, type) {
    type = type || TYPES.ATTACK;
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
    // 固定/真实伤害：无任何加成

    // 破甲（abreak > 0）：目标无法减免伤害——格挡与护盾/护甲吸收全部失效
    const broken = target.status.abreak > 0;

    // 格挡：非真实伤害每次结算降为 1 点；真实伤害无视格挡；破甲状态格挡失效
    if (target.defense.guard && type !== TYPES.TRUE && !broken && dmg > 1) {
      dmg = 1;
      r.guarded = true;
      r.log.push('格挡：伤害降为 1');
    }

    // 减伤（祝福）：每次受到的伤害 -N；真实伤害无视（同格挡/护盾/护甲）
    if ((target.status.reduce || 0) > 0 && type !== TYPES.TRUE && dmg > 0) {
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

    r.dealt = dmg;
    if (dmg > 0 && target.hp != null) {
      target.hp -= dmg;
      if (target.hp < 0) { r.overkill = -target.hp; target.hp = 0; }
    }
    return r;
  }

  // —— 流血（叠层状态）——
  function addBleed(target, n) {
    ensureStatus(target);
    target.status.bleed += n;
    if (target.status.bleed < 0) target.status.bleed = 0;
    return target.status.bleed;
  }
  function clearBleed(target) { ensureStatus(target); target.status.bleed = 0; return 0; }

  // —— 诅咒状态通用（设计者 2026-09-02 定版，规则见文件头）——
  // 挂诅咒：bleed/poison 按层叠加（n 可为负做减层）；计时类取「剩余较大值」不叠加
  function addCurse(target, key, n) {
    if (!CURSE_META[key]) return 0;
    // 层数/回合数兜底：调用方偶发传入 NaN/负值（如无层数的「附加流血」）时按 1 处理，
    // 否则状态会被写成 NaN——角标不显示、后续伤害结算全线变 NaN
    n = Number.isFinite(+n) && +n > 0 ? Math.floor(+n) : 1;
    ensureStatus(target);
    if (CURSE_META[key].stack) {
      target.status[key] = Math.max(0, target.status[key] + n);
    } else {
      target.status[key] = Math.max(target.status[key], n);
    }
    return target.status[key];
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
    const r = { poisonStacks: stacks, dealt: stacks, log: [] };
    if (target.hp != null) {
      target.hp -= stacks;
      if (target.hp < 0) { r.overkill = -target.hp; target.hp = 0; }
    }
    return r;
  }

  // 灼烧结算（2026-09-08 定版）：每回合结束时 1 点固定伤害（独立于中毒；
  // 不叠加——剩余回合由共享回合钟递减，重复施加取较大值）。免疫伤害可挡下。
  function tickBurn(target) {
    ensureStatus(target);
    const turns = target.status.burn;
    if (turns <= 0) return null;
    if ((target.status.immune || 0) > 0) {
      return { burnTurns: turns, dealt: 0, immune: true, log: ['免疫伤害'] };
    }
    const r = { burnTurns: turns, dealt: 1, log: [] };
    if (target.hp != null) {
      target.hp -= 1;
      if (target.hp < 0) { r.overkill = -target.hp; target.hp = 0; }
    }
    return r;
  }

  // 计时状态递减：battle.js 在「每回合结束」（共享回合钟，双方各行动一次）调用一次，
  // 返回本次到点解除的键（冰冻/沉默/破甲/禁疗/潜行/免疫伤害）。
  // 持续 n 回合 = 从触发当回合起覆盖 n 个完整回合（规则见文件头计时规则）
  // 数值型祝福的临时加成（__timedBuffs，见 addBlessing 第 4 参）同期递减，到点从数值中扣除
  function tickDurations(target) {
    if (!target || !target.status) return [];
    const expired = [];
    const timedKeys = CURSES.filter(k => !CURSE_META[k].stack)
      .concat(BUFFS.filter(k => BUFF_META[k].timed));
    timedKeys.forEach(k => {
      if ((target.status[k] || 0) > 0) {
        target.status[k]--;
        if (target.status[k] === 0) expired.push(k);
      }
    });
    if (target.__timedBuffs && target.__timedBuffs.length) {
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
    n = n == null ? 1 : n;
    ensureStatus(target);
    const m = BUFF_META[key];
    if (m.value) {
      target.status[key] = Math.max(0, target.status[key] + n);
      if (turns > 0) {
        if (!target.__timedBuffs) target.__timedBuffs = [];
        const rec = target.__timedBuffs.find(r => r.key === key);
        if (rec) { rec.amount += n; rec.turns = Math.max(rec.turns, turns); }
        else target.__timedBuffs.push({ key, amount: n, turns });
      }
    } else if (m.timed) target.status[key] = Math.max(target.status[key], n);
    else target.status[key] = 1;
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

  // —— 自测：覆盖四类伤害 + 流血 + 防御 + 记号解析 ——
  function selfTest() {
    const lines = [];
    const failed = [];
    let total = 0;
    function eq(name, got, want) {
      total++;
      const ok = got === want;
      if (!ok) failed.push(`${name}: 期望 ${want}，得到 ${got}`);
      lines.push(`${ok ? '[[icon:check]]' : '[[icon:cross]]'} ${name} = ${got}${ok ? '' : `（应为 ${want}）`}`);
    }

    // 1 攻击伤害 = 卡面 + 攻击力（无流血）
    let A = { atk: 4 }, B = { hp: 30 };
    let r = dealDamage(A, B, 2, TYPES.ATTACK);
    eq('攻击 2 + 攻击力4', r.dealt, 6);
    eq('  目标剩余 HP', B.hp, 24);

    // 2 流血加成：每层 +1
    B = { hp: 30, status: { bleed: 2 } };
    r = dealDamage(A, B, 2, TYPES.ATTACK);
    eq('攻击 2 + 攻击力4 + 流血2层', r.dealt, 8);

    // 3 多段攻击每次分别结算流血（连射：攻 2 × 2 次，1 层流血 → 每次 +1）
    B = { hp: 30, status: { bleed: 1 } };
    const hit1 = dealDamage(A, B, 2, TYPES.ATTACK).dealt;
    const hit2 = dealDamage(A, B, 2, TYPES.ATTACK).dealt;
    eq('连射两段（各+1流血）', hit1 + hit2, 7 + 7);

    // 4 法术伤害 = 卡面 + 法伤加成；目标有流血也不加
    A = { spellPower: 1 };
    B = { hp: 30, status: { bleed: 3 } };
    r = dealDamage(A, B, 3, TYPES.SPELL);
    eq("法术 3' + 法伤1（流血不加成）", r.dealt, 4);

    // 5 固定伤害：不吃攻击力/法伤加成
    A = { atk: 4, spellPower: 2 };
    B = { hp: 30 };
    eq('固定 5 不加成', dealDamage(A, B, 5, TYPES.FIXED).dealt, 5);

    // 6 真实伤害：无视护盾+护甲
    A = {};
    B = { hp: 30, defense: { shield: 5, armor: 4 } };
    r = dealDamage(A, B, 3, TYPES.TRUE);
    eq("真实 3'' 无视防御", r.dealt, 3);
    eq('  防御值未被消耗', B.defense.shield + B.defense.armor, 9);

    // 7 非真实伤害被防御吸收：护盾 → 护甲 → 生命（固定 10 vs 盾5 甲4）
    B = { hp: 30, defense: { shield: 5, armor: 4 } };
    r = dealDamage({ atk: 0 }, B, 10, TYPES.FIXED);
    eq('固定 10：吸收 9（盾5+甲4）', r.absorbed, 9);
    eq('  穿透到生命', r.dealt, 1);
    eq('  护甲耗尽', B.defense.armor, 0);
    eq('  目标扣血', 30 - B.hp, 1);

    // 8 流血挂层 / 净化
    B = { hp: 30 };
    addBleed(B, 2); addBleed(B, 1);
    eq('叠 3 层流血', B.status.bleed, 3);
    clearBleed(B);
    eq('净化后 0 层', B.status.bleed, 0);

    // 9 设计者定版：射击 = 2 点固定伤害，纯数字不吃攻击力
    eq('射击：固定 2 不吃攻击力4', dealDamage({ atk: 4 }, { hp: 30 }, 2, TYPES.FIXED).dealt, 2);

    // 10 格挡：非真实伤害降为 1；真实伤害无视格挡
    B = { hp: 30, defense: { guard: true } };
    eq('格挡：攻（+16）合 20 降为 1', dealDamage({ atk: 4 }, B, 16, TYPES.ATTACK).dealt, 1);
    B = { hp: 30, defense: { guard: true } };
    eq("格挡不拦真实 3''", dealDamage({}, B, 3, TYPES.TRUE).dealt, 3);

    // 11 流血层数无上限、不自动衰减
    B = { hp: 30 };
    addBleed(B, 99);
    eq('流血 99 层不封顶（攻1+99）', dealDamage({ atk: 0 }, B, 1, TYPES.ATTACK).dealt, 100);
    eq('  层数仍在', B.status.bleed, 99);

    // 12 记号解析
    eq("记号 3'", parseNotation("3'").type, TYPES.SPELL);
    eq("记号 3''", parseNotation("3''").type, TYPES.TRUE);
    eq('记号 3（无角标）', parseNotation('3').type, null);

    // 13 中毒：回合结束每层 1 点固定伤害（不吃攻击力，层数不衰减）
    B = { hp: 30, status: { poison: 3 } };
    r = tickPoison(B);
    eq('中毒 3 层回合末固定伤害', r.dealt, 3);
    eq('  中毒层数不衰减', B.status.poison, 3);
    eq('  中毒不吃攻击力', tickPoison({ hp: 30, status: { poison: 2 } }).dealt, 2);

    // 13' 灼烧：独立计时诅咒，每回合 1 点固定伤害，不叠加（2026-09-08 定版）
    B = { hp: 30 };
    addCurse(B, 'burn', 2); addCurse(B, 'burn', 3);
    eq('灼烧不叠加（取较大剩余）', B.status.burn, 3);
    eq('  灼烧回合末固定 1 点', tickBurn(B).dealt, 1);
    eq('  灼烧与中毒互不影响', B.status.poison, 0);
    eq('  免疫挡灼烧', tickBurn({ hp: 30, status: { burn: 2, immune: 1 } }).dealt, 0);

    // 14 冰冻：无法行动 + 净化解除
    B = { hp: 30 };
    addCurse(B, 'freeze', 1);
    eq('冰冻后不能行动', canAct(B), false);
    eq('  冰冻 1 回合后解除', (tickDurations(B), B.status.freeze), 0);
    eq('  解冻后恢复行动', canAct(B), true);

    // 15 破甲：2 回合内格挡/护盾/护甲全部失效
    B = { hp: 30, defense: { shield: 5, armor: 4, guard: true }, status: { abreak: 2 } };
    r = dealDamage({ atk: 0 }, B, 10, TYPES.FIXED);
    eq('破甲：10 点伤害全额穿透', r.dealt, 10);
    eq('  防御值未被消耗', B.defense.shield + B.defense.armor, 9);
    eq('  破甲第 1 回合结束仍在', (tickDurations(B), B.status.abreak), 1);
    r = dealDamage({ atk: 0 }, B, 10, TYPES.FIXED);
    eq('  破甲第 2 回合仍穿透', r.dealt, 10);
    tickDurations(B);
    eq('  破甲 2 回合后解除', B.status.abreak, 0);
    B.defense.guard = false;   // 先撤掉格挡，单验护盾/护甲恢复吸收
    eq('  解除后恢复吸收', dealDamage({ atk: 0 }, B, 10, TYPES.FIXED).absorbed, 9);

    // 16 沉默 / 禁疗计时
    B = { hp: 30 };
    addCurse(B, 'silence', 1); addCurse(B, 'healban', 2);
    eq('沉默与禁疗已挂上', hasCurse(B), true);
    tickDurations(B);
    eq('  沉默 1 回合后解除', B.status.silence, 0);
    eq('  禁疗还剩 1 回合', B.status.healban, 1);

    // 17 净化：清除所有诅咒类型与效果
    B = { hp: 30 };
    addBleed(B, 3); addCurse(B, 'poison', 2); addCurse(B, 'freeze', 1);
    addCurse(B, 'silence', 1); addCurse(B, 'abreak', 2); addCurse(B, 'healban', 2);
    const cleared = purify(B);
    eq('净化清掉 6 种诅咒', cleared.length, 6);
    eq('  净化后身负 0 诅咒', hasCurse(B), false);

    // 18 潜行：无法成为被攻击对象；造成伤害后破除
    B = { hp: 30 };
    addBlessing(B, 'stealth', 2);
    eq('潜行已挂上', isStealthed(B), true);
    r = dealDamage({ atk: 4 }, B, 2, TYPES.ATTACK);
    eq('  潜行中攻击无效', r.dealt, 0);
    eq('  HP 不减', B.hp, 30);
    eq('  潜行 2 回合递减 1', (tickDurations(B), B.status.stealth), 1);
    breakStealth(B);
    eq('  破除潜行后可被攻击', dealDamage({ atk: 0 }, B, 2, TYPES.ATTACK).dealt, 2);

    // 19 免疫伤害：攻击/真实/中毒全部无效
    B = { hp: 30 };
    addBlessing(B, 'immune', 1);
    eq('免疫挡攻击', dealDamage({ atk: 4 }, B, 9, TYPES.ATTACK).dealt, 0);
    eq("  免疫挡真实 3''", dealDamage({}, B, 3, TYPES.TRUE).dealt, 0);
    const P = { hp: 30, status: { poison: 2, immune: 1 } };
    eq('  免疫挡中毒', tickPoison(P).dealt, 0);
    eq('  免疫不消耗中毒层数', P.status.poison, 2);
    eq('  免疫挡下后不扣血', P.hp, 30);
    tickDurations(B);
    eq('  免疫 1 回合后解除', B.status.immune, 0);
    eq('  解除后恢复受伤', dealDamage({ atk: 0 }, B, 3, TYPES.ATTACK).dealt, 3);

    // 20 减伤：每次受伤 -N（真实伤害无视）
    B = { hp: 30 };
    addBlessing(B, 'reduce', 3);
    eq('减伤 3：固定 10 → 7', dealDamage({ atk: 0 }, B, 10, TYPES.FIXED).dealt, 7);
    eq('  减伤后 HP 扣 7', B.hp, 23);
    eq('  真实伤害无视减伤', dealDamage({ atk: 0 }, B, 5, TYPES.TRUE).dealt, 5);

    // 21 祝福加成：攻击力增加 / 法伤增加
    A = { atk: 4, status: { atkUp: 2 } };
    eq('攻击强化 +2（攻1+4+2）', dealDamage(A, { hp: 30 }, 1, TYPES.ATTACK).dealt, 7);
    A = { spellPower: 1, status: { spellUp: 3 } };
    eq("法术强化 +3（3'+1+3）", dealDamage(A, { hp: 30 }, 3, TYPES.SPELL).dealt, 7);

    // 22 形态：flag 型本局常驻，不随回合递减
    B = { hp: 30 };
    addBlessing(B, 'swordForm'); addBlessing(B, 'natureForm'); addBlessing(B, 'cosmosForm');
    tickDurations(B);
    eq('形态不随回合递减', (B.status.swordForm + B.status.natureForm + B.status.cosmosForm), 3);

    return { pass: failed.length === 0, total, failed, lines };
  }

export { TYPES, TYPE_NAME, dealDamage, previewDamage,
         addBleed, clearBleed,
         CURSES, CURSE_META, addCurse, hasCurse, purify,
         BUFFS, BUFF_META, addBlessing, isStealthed, breakStealth,
         tickPoison, tickBurn, tickDurations, canAct,
         parseNotation, ensureStatus, selfTest };
