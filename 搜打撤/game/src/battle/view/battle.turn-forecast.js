import * as Combat from '../core/combat.js';
import { buildEnemyActionPlan } from '../core/battle.enemy-plan.js';

// 只读模拟当前防御；回合末触发与随机效果另有说明，不改变真实状态。
export function forecastEnemyTurn(snapshot) {
  const hp = Number(snapshot.player?.hp || 0);
  const note = '按当前状态估算；回合末触发、随从攻击与随机效果可能改变结果。';
  // 额外回合分支直接进入新玩家回合，实际管线不结算本次中毒或敌方攻击。
  if (snapshot.endTurnContext?.extraTurn) return Object.freeze({damage:0,hpAfter:hp,lethal:false,note});
  const player = { hp, status: { ...snapshot.pstat?.status }, defense: { ...snapshot.pdef } };
  const allies = (snapshot.allies || []).filter(a => !a.dead && !a.statless)
    .map(a => ({ hp:a.hp, status:{...a.status}, defense:{...a.defense} }));
  let damage = 0;
  let deathSave = snapshot.endTurnContext?.deathSave || 0;
  for (let i = 0; i < (snapshot.endTurnContext?.timeRune ? 2 : 1); i++) {
    damage += Combat.tickPoison(player)?.dealt || 0;
  }
  for (const foe of snapshot.foes || []) {
    if (player.hp <= 0) break;
    const plan = buildEnemyActionPlan(foe, snapshot.turn);
    if (!plan.canAttack) continue;
    for (let i = 0; i < plan.hits; i++) {
      if (player.hp <= 0) break;
      if (Combat.isStealthed(player)) break;
      const ally = allies.find(a => a.hp > 0);
      const hpBefore = player.hp;
      const result = Combat.dealDamage({ atk: foe.atk }, ally || player, 0, Combat.TYPES.ATTACK);
      if (!ally) {
        // 与playerTakeHit同序：防御先消耗；致命伤害被保险挡下，生命保留并获得本回合免疫。
        if (result.dealt > 0 && hpBefore - result.dealt <= 0 && deathSave > 0) {
          deathSave -= 1; player.hp = hpBefore; player.status.immune = 1;
        } else damage += result.dealt;
      }
    }
  }
  return Object.freeze({ damage, hpAfter: Math.max(0,player.hp),lethal: hp > 0 && player.hp <= 0,note });
}
