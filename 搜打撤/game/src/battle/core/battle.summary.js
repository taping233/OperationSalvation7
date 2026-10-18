// 本场内存摘要；不写存档，结束时随 battle:end 的 opts 交付。
let hits = [];
export function resetBattleSummary() { hits = []; }
export function recordBattleDamage(source, damage, round) {
  if (damage > 0) hits.push(Object.freeze({ source, damage, round }));
}
export function readBattleSummary(round, foes) {
  return Object.freeze({ round, remainingFoes: Object.freeze(foes.filter(f => !f.dead && f.hp > 0)
    .map(f => Object.freeze({ name: f.name, hp: f.hp, maxHp: f.maxHp }))),
    damageTaken: Object.freeze(hits.slice()),
    damageCoverage: '记录敌方直接攻击与回合末中毒；其他卡牌或反噬伤害未归因。' });
}
