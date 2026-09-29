/* battle.foe-lifecycle.js —— 敌方单位生命周期（自 battle.engine.js 逐字迁出，治理批次 3）。
 * 覆盖：击倒结算 resolveFoeDefeat / 清尸 sweepDead / 腐化之种遗产转移 / 龙巢复活与复活击杀
 * 追踪 / 远古龙尊阶段机 nestPhase。互递归件（finish / foeIdx / alive / activeActionSignal）
 * 经端口注入或 runtime 活绑定直引——本模块不回环依赖 engine。
 */
import { STAGED_BOSS_DEFEAT, throwIfActionCancelled } from '../runtime/battle.staged-playback.js';
import { G, foes, hand, discard, turn, activeActionSignal } from '../runtime/battle.runtime.js';
import { floats } from '../runtime/battle.runtime.presentation.js';
import { poisonLegacy } from '../runtime/battle.runtime.effects.js';
import * as Combat from './combat.js';
import { esc } from '../../core/shared.js';
import { Random } from '../../core/random.js';
import SDT from '../../core/sdt-facade.js';

const KILL_CHEER = ['漂亮！', '好剑！', '干净利落！'];

/**
 * @param {object} ports engine 装配端口：alive/foeIdx/finish 与执行会话（executionSession/stagedDeathFx
 *   为引擎内单一实例的内部状态）自引擎注入；其余经 runtime 活绑定直引
 * @returns {{ resolveFoeDefeat, sweepDead, transferPoisonLegacy, nestRevive, nestKillCheck, nestPhase }}
 */
export function createBattleFoeLifecycle({
  alive, foeIdx, finish, executionSession, stagedDeathFx,
}) {
function resolveFoeDefeat(foe, cause = '被击倒') {
    if (!foe || foe.dead || foe.hp > 0) return false;
    foe.dead = true;
    G.log(`[[icon:skull]] <b>${esc(foe.name)}</b> ${cause}！（剩 ${alive().length} 个敌人）`, 'ok');
    floats.push({ unit: foeIdx(foe), text: '', cls: 'stk sticker-boom' });
    floats.push({ unit: 'self', text: KILL_CHEER[Math.floor(Random.random('battle') * KILL_CHEER.length)], cls: 'stk stk-late stk-cheer' });
    // 固定死亡触发顺序：复活替代死亡 → 遗产转移 → 同回合复活击杀 → 首脑胜利。
    if (nestRevive(foe)) return false;
    transferPoisonLegacy(foe);
    nestKillCheck(foe);
    if (executionSession.stagedResolutionDepth > 0) stagedDeathFx.add(foe);
    if (foe.boss) {
      // 立刻截断本卡余句，但保留致命一击的反馈，待演出后再清场胜利。
      if (executionSession.stagedResolutionDepth > 0) throw STAGED_BOSS_DEFEAT;
      const signal = activeActionSignal;
      finish(true);
      // 首脑死亡会清空动作队列；立即打断当前同步结算，避免胜利后仍继续执行卡牌余句。
      throwIfActionCancelled(signal);
    }
    return true;
  }
function sweepDead() {
    foes.forEach(f => resolveFoeDefeat(f));
  }
function transferPoisonLegacy(deadFoe) {
    if (!poisonLegacy || !deadFoe.status || !(deadFoe.status.poison > 0)) return;
    // hp>0 过滤：AOE 双杀时 sweepDead 逐个清尸，后一个死者此刻尚未置 dead、仍在 alive() 里，
    // 遗产转给它只会随其立即倒下而湮灭
    const next = alive().filter(f => f !== deadFoe && f.hp > 0)[0];
    const stacks = deadFoe.status.poison;
    if (!next) return;
    deadFoe.status.poison = 0;
    Combat.addCurse(next, 'poison', stacks);
    G.log(`[[icon:skull]] <b>腐化之种</b>：<b>${esc(deadFoe.name)}</b> 的 ${stacks} 层中毒转移给 <b>${esc(next.name)}</b>（当前 ${next.status.poison} 层）`, 'sys');
  }
function nestRevive(foe) {
    if (!foe.revive || foe.revived) return false;
    foe.revived = true;
    foe.dead = false;
    foe.maxHp = foe.revive.hearts;
    foe.hp = foe.revive.hearts;
    foe.atk = foe.revive.atk;
    foe.status = {};
    foe.reviveTurn = turn;
    G.log('[[icon:fire]] <b>完全形态·元素领主</b>：死亡不是终结——以 8 攻 8 心复活（诅咒尽散）。借过！', 'warn');
    return true;
  }
function nestKillCheck(foe) {
    if (foe.revived && foe.reviveTurn === turn && SDT.Meta) {
      SDT.Meta.track('reviveKill', {});
      G.log('[[icon:trophy]] <b>借过</b>——复活体被当场送走！', 'ok');
    }
  }
function nestPhase(foe) {
    const frac = foe.hp / foe.maxHp;
    const ph = frac <= 1 / 3 ? 3 : frac <= 2 / 3 ? 2 : 1;
    if (ph === (foe.phase || 1)) return;
    foe.phase = ph;
    if (ph === 3) {
      const dumped = hand.splice(0, hand.length);
      dumped.forEach(u => discard.push(u));
      foe.stunned = true;
      G.log('[[icon:fire]] <b>远古龙尊</b> 狂怒：你的手牌全部被震落！且下个回合蓄力', 'warn');
    } else {
      G.log(`[[icon:fire]] <b>远古龙尊</b> 进入第 ${ph} 阶段`, 'warn');
    }
  }
  return { resolveFoeDefeat, sweepDead, transferPoisonLegacy, nestRevive, nestKillCheck, nestPhase };
}
