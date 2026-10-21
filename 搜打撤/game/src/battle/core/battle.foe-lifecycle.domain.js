import { STAGED_BOSS_DEFEAT, throwIfActionCancelled } from '../runtime/battle.playback.js';
import { esc } from '../../core/shared.js';

/** Instance-owned state and host services are captured explicitly. */
export function createFoeLifecycleDomain(context) {
const instanceRuntime = context.runtime;
const Combat = context.combat;
const Random = context.random;
/* battle.foe-lifecycle.js —— 敌方单位生命周期（自 battle.engine.js 逐字迁出，治理批次 3）。
 * 覆盖：击倒结算 resolveFoeDefeat / 清尸 sweepDead / 腐化之种标记爆发 / 龙巢复活与复活击杀
 * 追踪 / 远古龙尊阶段机 nestPhase。互递归件（finish / foeIdx / alive / activeActionSignal）
 * 经端口注入或 runtime 活绑定直引——本模块不回环依赖 engine。
 */

const KILL_CHEER = ['漂亮！', '好剑！', '干净利落！'];

/**
 * @param {import('./battle.core-ports.types.js').FoeLifecyclePorts} ports engine 装配端口：alive/foeIdx/finish 与执行会话（executionSession/stagedDeathFx
 *   为引擎内单一实例的内部状态）自引擎注入；其余经 runtime 活绑定直引
 * @returns {{ resolveFoeDefeat, sweepDead, transferPoisonLegacy, nestRevive, nestKillCheck, nestPhase }}
 */
function createBattleFoeLifecycle({
  alive, foeIdx, finish, executionSession, stagedDeathFx, hitFoe,
}) {
function resolveFoeDefeat(foe, cause = '被击倒') {
    if (!foe || foe.dead || foe.hp > 0) return false;
    foe.dead = true;
    instanceRuntime.G.log(`[[icon:skull]] <b>${esc(foe.name)}</b> ${cause}！（剩 ${alive().length} 个敌人）`, 'ok');
    instanceRuntime.floats.push({ unit: foeIdx(foe), text: '', cls: 'stk sticker-boom' });
    // 喝彩只改变表现，不能推进后续牌效/选靶使用的 battle 随机流。
    instanceRuntime.floats.push({ unit: 'self', text: KILL_CHEER[Math.floor(Random.random('visual') * KILL_CHEER.length)], cls: 'stk stk-late stk-cheer' });
    // 固定死亡触发顺序：复活替代死亡 → 遗产转移 → 同回合复活击杀 → 首脑胜利。
    if (nestRevive(foe)) return false;
    transferPoisonLegacy(foe);
    nestKillCheck(foe);
    if (executionSession.stagedResolutionDepth > 0) stagedDeathFx.add(foe);
    if (foe.boss) {
      // 立刻截断本卡余句，但保留致命一击的反馈，待演出后再清场胜利。
      if (executionSession.stagedResolutionDepth > 0) throw STAGED_BOSS_DEFEAT;
      const signal = instanceRuntime.activeActionSignal;
      finish(true);
      // 首脑死亡会清空动作队列；立即打断当前同步结算，避免胜利后仍继续执行卡牌余句。
      throwIfActionCancelled(signal);
    }
    return true;
  }
function sweepDead() {
    instanceRuntime.foes.forEach(f => resolveFoeDefeat(f));
  }
function transferPoisonLegacy(deadFoe) {
    if (deadFoe.deathBurst || deadFoe.rotSeedMarked) {
      const burst = deadFoe.deathBurst || { status: 'poison', multiplier: 1, dmgType: Combat.TYPES.TRUE };
      delete deadFoe.deathBurst;
      delete deadFoe.rotSeedMarked;
      const stacks = Math.max(0, Number(deadFoe.status?.[burst.status]) || 0) * burst.multiplier;
      if (stacks > 0) {
        instanceRuntime.G.log(`[[icon:skull]] <b>腐化之种</b>：<b>${esc(deadFoe.name)}</b> 的标记引爆，对所有敌人造成 <b>${stacks}</b> 点真实伤害`, 'sys');
        for (const foe of alive().filter(foe => foe.hp > 0)) {
          hitFoe(foe, { name:'死亡标记', type:'法术', desc:'' }, stacks, burst.dmgType, null, { preserveBaseDamage:true });
        }
      }
      return;
    }
    if (!instanceRuntime.poisonLegacy || !deadFoe.status || !(deadFoe.status.poison > 0)) return;
    // hp>0 过滤：AOE 双杀时 sweepDead 逐个清尸，后一个死者此刻尚未置 dead、仍在 alive() 里，
    // 遗产转给它只会随其立即倒下而湮灭
    const next = alive().filter(f => f !== deadFoe && f.hp > 0)[0];
    const stacks = deadFoe.status.poison;
    if (!next) return;
    deadFoe.status.poison = 0;
    Combat.addCurse(next, 'poison', stacks);
    instanceRuntime.G.log(`[[icon:skull]] <b>腐化之种</b>：<b>${esc(deadFoe.name)}</b> 的 ${stacks} 层中毒转移给 <b>${esc(next.name)}</b>（当前 ${next.status.poison} 层）`, 'sys');
  }
function nestRevive(foe) {
    if (!foe.revive || foe.revived) return false;
    foe.revived = true;
    foe.dead = false;
    foe.maxHp = foe.revive.hearts;
    foe.hp = foe.revive.hearts;
    foe.atk = foe.revive.atk;
    foe.status = {};
    delete foe.rotSeedMarked;
    foe.reviveTurn = instanceRuntime.turn;
    instanceRuntime.G.log('[[icon:fire]] <b>完全形态·元素领主</b>：死亡不是终结——以 8 攻 8 心复活（诅咒尽散）。借过！', 'warn');
    return true;
  }
function nestKillCheck(foe) {
    if (foe.revived && foe.reviveTurn === instanceRuntime.turn && context.track) {
      context.track('reviveKill', {});
      instanceRuntime.G.log('[[icon:trophy]] <b>借过</b>——复活体被当场送走！', 'ok');
    }
  }
function nestPhase(foe) {
    const frac = foe.hp / foe.maxHp;
    const ph = frac <= 1 / 3 ? 3 : frac <= 2 / 3 ? 2 : 1;
    if (ph === (foe.phase || 1)) return;
    foe.phase = ph;
    if (ph === 3) {
      const dumped = instanceRuntime.hand.splice(0, instanceRuntime.hand.length);
      dumped.forEach(u => instanceRuntime.discard.push(u));
      foe.stunned = true;
      instanceRuntime.G.log('[[icon:fire]] <b>远古龙尊</b> 狂怒：你的手牌全部被震落！且下个回合蓄力', 'warn');
    } else {
      instanceRuntime.G.log(`[[icon:fire]] <b>远古龙尊</b> 进入第 ${ph} 阶段`, 'warn');
    }
  }
  return { resolveFoeDefeat, sweepDead, transferPoisonLegacy, nestRevive, nestKillCheck, nestPhase };
}
return { createBattleFoeLifecycle };
}
