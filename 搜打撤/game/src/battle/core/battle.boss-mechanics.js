import mapData from '../../../data/map.json' with { type: 'json' };
import { initializeEliteEnemies, syncEliteAuras } from './battle.elite-mechanics.js';
import { esc } from '../../core/shared.js';
import { scaleEnemyForMode } from '../../core/enemy-mode-scaling.js';

// Summons use the current layer 2–4 encounter catalogue, including its elite entries.
export const BOSS_SUMMON_POOL = Object.freeze([...new Set(mapData.encounters.slice(1, 4)
  .flatMap(enc => [...enc.entries.map(entry => entry.id), ...(enc.guaranteedElite || []),
    ...(enc.groups || []).flatMap(group => group.enemyIds)]))]);

export function applyBossOpening({ runtime, combat, engine }) {
  const source = runtime.foes.find(foe => !foe.dead && foe.behavior === 'mysterious_blocker');
  if (!source) return;
  for (const key of ['bleed', 'poison', 'abreak', 'healban']) {
    engine.addPlayerCurse(key, 1, source);
    for (const unit of [...runtime.foes, ...runtime.allies]) {
      if (!unit.dead && !unit.statless) combat.addCurse(unit, key, 1);
    }
  }
  runtime.G.log('[[icon:skull]] <b>神秘拦路人</b>：所有角色获得流血、中毒各 1 层，破甲、禁疗各 1 回合', 'warn');
}

export function applyBossTurnStart({ runtime, combat, random, engine }) {
  const turn = runtime.turn;
  for (const foe of [...runtime.foes]) {
    if (foe.dead || foe.hp <= 0 || foe.status.silence > 0 || foe.status.bossLastTrigger === turn) continue;
    if (foe.behavior === 'mutation_mother' && [2, 4, 6].includes(turn)) {
      foe.status.bossLastTrigger = turn;
      const id = BOSS_SUMMON_POOL[Math.floor(random.random('battle', 'enemy') * BOSS_SUMMON_POOL.length)];
      const template = scaleEnemyForMode(mapData.monsters[id], runtime.G.mode);
      const { hp, atk } = template;
      const summoned = combat.ensureStatus({ ...template, id, hp, maxHp: hp, atk,
        boss: false, controlBoss: false, dead: false, status: {}, defense: { shield: 0, armor: 0, guard: false } });
      initializeEliteEnemies([summoned]);
      runtime.foes.push(summoned);
      syncEliteAuras(runtime.foes);
      summoned.intent = engine.intentFor(summoned, turn);
      runtime.G.log(`[[icon:skull]] <b>畸变母体</b>召唤了 <b>${esc(summoned.name)}</b>`, 'warn');
    }
    if (foe.behavior === 'necromancer' && [3, 6, 9].includes(turn)) {
      foe.status.bossLastTrigger = turn;
      const torn = runtime.drawPile.splice(Math.max(0, runtime.drawPile.length - 2));
      // Exile for this battle: no discard recycling, consume trigger or permanent ownership deletion.
      runtime.grave.push(...torn);
      runtime.cardAnims.push(...torn.map(uid => ({ kind: 'burn', uid, name: engine.findCard(uid)?.card.name || '?' })));
      foe.status.necroticExposure = (foe.status.necroticExposure || 1) * 2;
      runtime.G.log(`[[icon:skull]] <b>死灵能力者</b>撕掉牌库顶 ${torn.length} 张牌；其最终承伤永久变为 ×${foe.status.necroticExposure}`, 'warn');
    }
  }
}

export function cleanseBlockerAfterAttack(foe, combat, random, restoreAtkDown) {
  if (foe.dead || foe.hp <= 0 || foe.behavior !== 'mysterious_blocker' || foe.status.silence > 0) return;
  const keys = combat.CURSES.filter(key => foe.status[key] > 0);
  if (!keys.length) return;
  const key = keys[Math.floor(random.random('battle', 'enemy') * keys.length)];
  foe.status[key] = Math.max(0, foe.status[key] - 1);
  restoreAtkDown(foe);
  return combat.CURSE_META[key].name;
}
