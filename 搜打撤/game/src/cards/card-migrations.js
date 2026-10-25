import { ensureRotSeedRevision } from './rot-seed-revision.js';
import { ensureM1OnplayRules } from './cards.sync.m1.js';
import { ensureM2OnplayRules } from './cards.sync.m2.js';
import { ensureM3OnplayRules } from './cards.sync.m3.js';
import { ensureM4EquipRules } from './cards.sync.m4.js';
import { ensureM5DelayedRules } from './cards.sync.m5.js';
import { ensureM6BagRules } from './cards.sync.m6.js';
import { ensureM7EquipRules } from './cards.sync.m7.js';
import { ensureM8RuleBackfill } from './cards.sync.m8.js';
import { ensureCanonicalFaceRefresh } from './cards.sync.face-refresh.js';
import { ensureM9HostedRules } from './cards.sync.m9.js';
import { ensureM10HostedEquipmentRules } from './cards.sync.m10.js';
import { ensureM11HostedRules } from './cards.sync.m11.js';
import { ensureBuiltinExecutionRules } from './cards.sync.builtin.js';
import { TT2_KEY_V3, TT1_KEY_V6, TT4_KEY_V2, TT3_KEY_V5, TT5_KEY, TT6_KEY, TT7_KEY, TT8_KEY, TT9_KEY, TT12_KEY } from './cards.consts.js';

/** Ordered startup migration manifest. Markers/retries remain owned by each
 * migration; replaying the manifest must never skip a failed persistence attempt.
 * Canonical synchronization precedes semantic repairs and structured rule backfills. */
export const CARD_MIGRATIONS = Object.freeze([
  { batch: 'TABLETOP', marker: TT1_KEY_V6, prefix: 'tt' }, // v6：老档重播一次，按 id 覆盖（资源类型化、木材/木化拆分、经济卡包可出售）
  { batch: 'TABLETOP2', marker: TT2_KEY_V3, prefix: 'tt2' },
  { batch: 'TABLETOP3', marker: TT3_KEY_V5, prefix: 'tt3' }, // v5：传说系列照片——升传说、unrandom 锁定、重辨修订
  { batch: 'TABLETOP4', marker: TT4_KEY_V2, prefix: 'tt4' }, // v2：补入木化
  { batch: 'TABLETOP5', marker: TT5_KEY, prefix: 'tt5' },
  { batch: 'TABLETOP6', marker: TT6_KEY, prefix: 'tt6' },
  { batch: 'TABLETOP7', marker: TT7_KEY, prefix: 'tt7' },
  { batch: 'TABLETOP8', marker: TT8_KEY, prefix: 'tt8' },
  { batch: 'BESTIARY', marker: TT9_KEY }, // 第九批：生物图鉴（全部敌人信息录入，2026-09-04 定版）
  { method: 'ensureTabletopSync' }, // 第十批：设计者实机定版同步（按 id 整卡覆盖/补种，只跑一次）
  { method: 'ensureItemRenames' }, // 指定道具定名 + 金创药/金疮药合并（按稳定 id 迁移旧卡库）
  { method: 'ensureClassRarity' }, // v2：老档第七批职业卡统一迁移为「职业」稀有度（2026-09-04 定版）
  { method: 'ensureShieldToArmor' }, // 护盾→护甲术语迁移（含老存档，2026-09-04 定版）
  { method: 'ensureShaToStarterAttack' }, // 「杀」→「初始攻击」术语迁移（含老存档，2026-09-09 定版）
  { method: 'ensureCardFixes' }, // 设计者定版数据修正（爆燃火球删注能，2026-09-05）
  { method: 'ensureClassConsolidation' }, // 职业整合：11 职业 → 5 职业，逐卡改归属（2026-09-05 定版）
  { method: 'ensureDmgValues' }, // 伤害数值回填（描述 N′ → dmg 字段，2026-09-04 新增）
  { method: 'ensureHeroFields' }, // 修复早期制作坊保存丢失的 cls/hero（专属立绘依赖）
  { method: 'ensureAbilityRename' }, // 能力卡术语迁移（原「英雄卡」类型，2026-09-08 定版）
  { method: 'ensureAbilityCards' }, // 能力卡补种：老档卡库缺失的 11 张能力卡本体自动补入（2026-09-09）
  { method: 'ensureTabletopSync11' },
  { method: 'ensureFoeRename' }, // 敌人图鉴改名同步（新世界观命名 + 五层分布，含老存档，2026-09-09 定版）
  { method: 'ensureCardsSyncLive' }, // 实机卡库同步（数据见 game/data/cards-sync.json，只跑一次）
  { method: 'ensureRandomPoolFixes' }, // 随机池防退回（石榴弹珠 unrandom，定版整卡覆盖后的幂等补回）
  { method: 'ensureDuplicateRenames' }, // 同名不同 ID/效果版本统一在后者追加「-改」（含旧卡库）
  { method: 'ensureEvents0919' }, // 0919 都市污染事件池：放在实机同步之后，以本轮定稿名与效果为准
  { batch: 'TABLETOP12', marker: TT12_KEY, prefix: 'tt12' }, // 第十二批：射线/研发系列新卡 17 张（2026-09-23）；新 KEY 老档补播，放最后以本批定稿为准
  { method: 'ensureChoiceFixes' }, // 定版同步后幂等移除神灯分支误回填的 armor:5
  { method: 'ensureTT12PreplayRules' }, // 从定版定义补齐 TT12 的出牌前规则与即时效果规则
  { method: 'ensureTT10BaseMaterialRules' }, // 从 TT10 定版定义补齐两张材料卡规则
  { method: 'ensureTT1BaseMaterialRules' }, // 从第一批定版定义补齐六张基地材料卡规则
  { method: 'ensureTT10OnPlayRules' }, // 从 TT10 定版定义补齐包扎、坚守的有序即时效果规则
  { method: 'ensureBagUseRules' }, // 从代码定版定义补齐两张背包道具的使用规则
  { method: 'ensureTT7MultiHitRules' }, // TT7 多段攻击与偷袭卡按稳定 id 补齐旧卡规则
  { method: 'ensureTT7StatusRules' }, // 冰封千里按稳定 id 补齐群体冰冻规则
  { method: 'ensureTT12DiscoverRules' }, // 高端研发按稳定 id 补齐发现与逐回合降费规则
  { method: 'ensureA3BattleRules' }, // A3 迁移第一批：B1-B3 共 23 张文本路径卡改结构化 rules（2026-09-25）
  { method: 'ensureA3CurseRules' }, // A3 第二批：B5 诅咒族 8 张改结构化（curse op 接线后）
  { method: 'ensureA3AcquireBlessingRules' }, // A3 第三/四批：B6 获取 12 张+B7 增益能量 4 张
  { method: 'ensureE8FixedHealRules' }, // E8：严格匹配的三张定版治疗卡补齐地图背包规则
  { id: 'ensureM1OnplayRules', run: ensureM1OnplayRules }, // M 批 B-M1：D1 首批 4 张（初始攻击/穿刺/青龙偃月斩/圣光之源）改结构化（2026-09-27）
  { id: 'ensureM2OnplayRules', run: ensureM2OnplayRules }, // M 批 B-M1：D3 现集 16 张（箭系/混合目标放行等）改结构化（2026-09-27）
  { id: 'ensureM3OnplayRules', run: ensureM3OnplayRules },
  { id: 'ensureM4EquipRules', run: ensureM4EquipRules },
  { id: 'ensureM5DelayedRules', run: ensureM5DelayedRules },
  { id: 'ensureM6BagRules', run: ensureM6BagRules },
  { id: 'ensureM7EquipRules', run: ensureM7EquipRules },
  { id: 'ensureM8RuleBackfill', run: ensureM8RuleBackfill },
  { id: 'ensureCanonicalFaceRefresh', run: ensureCanonicalFaceRefresh }, // 定版卡面刷新（注册表 cards.sync.face-refresh.js）：花瓣法阵 09-29 heal:3 等旧档幂等重刷
  { id: 'ensureM9HostedRules', run: ensureM9HostedRules },
  { id: 'ensureM10HostedEquipmentRules', run: ensureM10HostedEquipmentRules },
  { id: 'ensureM11HostedRules', run: ensureM11HostedRules },
  { id: 'ensureRotSeedRevision', run: ensureRotSeedRevision, withCards: true },
  { batch: 'TABLETOP13', marker: 'sdt-cards-tt13-v1-seeded', prefix: 'tt13' },
  { batch: 'TABLETOP13', marker: 'sdt-cards-poor-meal-v1-seeded', prefix: 'poor-meal', select: card => card.id === 'tt13-poor-meal' },
  { id: 'ensureBuiltinExecutionRules', run: ensureBuiltinExecutionRules, withCards: true },
].map(step => Object.freeze(step)));

export function runCardMigrations(cards) {
  for (const step of CARD_MIGRATIONS) {
    if ('batch' in step) {
      const batch = step.select ? cards[step.batch].filter(step.select) : cards[step.batch];
      if ('prefix' in step) cards.seedBatch(batch, step.marker, step.prefix);
      else cards.seedBatch(batch, step.marker);
    } else if ('method' in step) {
      cards[step.method]();
    } else if (step.withCards) {
      step.run(cards);
    } else {
      step.run();
    }
  }
}
