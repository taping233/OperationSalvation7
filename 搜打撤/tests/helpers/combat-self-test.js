/** Existing combat self-check cases live only in the test tree.
 * @param {typeof import('../../game/src/battle/core/combat.js')} combat */
export function runCombatSelfTest(combat) {
  const { TYPES, dealDamage, addBleed, clearBleed, addCurse, hasCurse, purify, addBlessing, isStealthed, breakStealth, tickPoison, tickDurations, canAct, parseNotation } = combat;
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
  /** @type {import('../../game/src/battle/core/battle.core-ports.types.js').CombatCaster} */
  let A = { atk: 4 }, B = { hp: 30 };
  /** @type {ReturnType<typeof dealDamage> | ReturnType<typeof tickPoison>} */
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

  // 20b 闪避：每层完整避开下一段伤害，包含法术、固定与真实伤害。
  B = { hp: 30 };
  addBlessing(B, 'dodge', 1, 1);
  eq('闪避 1：攻击 12 完整避开', dealDamage({ atk: 12 }, B, 1, TYPES.ATTACK).dealt, 0);
  eq('  闪避后不扣血', B.hp, 30);
  eq('  闪避消耗 1 层', B.status.dodge, 0);
  eq('  层数用尽后恢复受伤', dealDamage({ atk: 2 }, B, 1, TYPES.ATTACK).dealt, 3);
  B = { hp: 30 };
  addBlessing(B, 'dodge', 2, 1);
  dealDamage({ atk: 9 }, B, 1, TYPES.ATTACK);
  eq('  2 层闪避挡 1 次剩 1 层', B.status.dodge, 1);
  eq('  闪避挡法术', dealDamage({ spellPower: 4 }, B, 3, TYPES.SPELL).dealt, 0);
  eq('    法术后层数用尽', B.status.dodge, 0);
  addBlessing(B, 'dodge', 2, 1);
  eq('  闪避挡固定伤害', dealDamage({ atk: 0 }, B, 5, TYPES.FIXED).dealt, 0);
  eq('  闪避挡真实伤害', dealDamage({}, B, 5, TYPES.TRUE).dealt, 0);
  addBlessing(B, 'dodge', 1, 1);
  tickDurations(B);
  eq('  「本回合」1 回合后过期', B.status.dodge, 0);

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
