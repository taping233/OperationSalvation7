# R3-a 可信战斗预览契约（待 Friday 审批）

> 本文只是实施方案，未改动 runtime。上位边界见 `R3-BATTLE-DECISION-PLAN.md`。

## 1. 用户可见契约

- 多名存活敌人时，玩家点击一张对敌卡进入选择态后，每个可选敌人身边立即显示该目标的预览，不以 hover 为前提。
- 点选模式文案为「点击该敌人打出」；拖拽模式才可显示「松手打出」。取消选择后所有常驻预览清除。
- 只有完整建模并通过语义指纹的结果标记「精确」。可证明的伤害可显示而卡牌还有未建模效果时标记「部分」并列出未建模项；连伤害也无法证明时显示「无法精算」及原因。
- 单名存活敌人的指向牌继续免选直打，不为展示预览新增确认步骤。
- 预览只读：不扣费、不消耗材料/闪避/护盾，不改变 RNG，不发音效、日志、统计或任何 Combat hook。

## 2. 第一批 exact 卡型与真实 ID

exact 不只看 ID。每张卡必须同时匹配 `id + type + dmgType + dmg + 归一化 desc`；制作坊、旧档或运行时 `cardOverrides` 改写任一语义字段时立即降级，不借稳定 ID 继续报 exact。

| 卡型 | 真实 ID | 当前语义指纹 | 首批输出 |
| --- | --- | --- | --- |
| 单段攻击 | `starter-attack` | 武术 / attack / dmg 0 / `攻（+0）：造成等同于攻击力的伤害。` | exact |
| 单段攻击 | `tt7-sneak` | 武术 / attack / dmg -1 / `攻（-1）。` | exact |
| 单段攻击 | `tt3-reshot` | 武术 / attack / dmg 2 / `攻（+2）。` | exact |
| 单段固定 | `tt2-shoot` | 武术 / fixed / dmg 2 / `造成 2 点伤害。` | exact |
| 单段法术 | `tt3-fireball` | 法术 / spell / dmg 4 / `造成 4 点法术伤害。` | exact |
| 单段法术 | `cmtna0nb1yxt` | 法术 / spell / dmg 5 / `5点法术伤害` | exact |
| 三段固定 | `tt3-double-shot` | 武术 / fixed / dmg 2 / `造成2 点固定伤害，触发 3 次。` | exact，逐段推进 |
| 两段法术 | `tt3-chain-lightning` | 法术 / spell / dmg 3 / `3′，触发 2 次。` | exact，逐段推进 |
| 两段攻击 | `tt7-meteorrain` | 武术 / attack / dmg -1 / `攻（-1）；触发 2 次。` | exact，逐段推进 |

指纹归一化只允许全/半角括号、普通空白、句末标点等不改语义的差异；不做模糊包含匹配。测试从当前真实卡库取上表卡牌，不手造一套替代卡数据。

## 3. partial / unknown 边界

- 卡面基础伤害是可证明单段或多段，但还有抽牌、回复、上诅咒、获得护甲等未纳入首批预览的稳定附带效果：`partial`，伤害数字可标「精确伤害」，附注「另有未展示效果」。
- 随机敌人/随机卡、发现、释放其他卡、选手牌、迫使敌人互攻、击杀后再释放、按墓地/手牌/价格/敌人数动态定伤、注能文本改写、下一张整卡重复：没有完整上下文时 `unknown`，不猜数字。
- AOE 卡首批不标 exact；预览一个敌人不等于已证明全体结果。
- `tt7-bloodpoison` 是两次独立选目标加两种状态，首批最多显示首镖的可证明伤害并标 `partial`，不把两镖合并成一个伪精确总伤害。
- 语义指纹不匹配、没有稳定 ID、或当前有未支持的战斗层修正时：`unknown`，原因必须是具体代码，例如 `CARD_SEMANTICS_CHANGED`、`HEARTS_MODE`、`NEST_DAMAGE_MODIFIER`，而不是统一写「复杂效果」。

## 4. 伤害必须读到的真实上下文

### 玩家/攻击者

- `G.atk`、`G.spellPower`（已吸收直接改写这两个属性的成长/装备效果）。
- `pstat.status.atkUp` 与 `spellUp`；它们是 `Combat.dealDamage` 真实计算的攻击/法伤加成。
- 玩家潜行与 `stealthStrike`：若本次会触发破隐翻倍，首批不 exact，除非后续把 `hitFoe` 的翻倍前置语义独立建模。
- `nextSpellTwice`、`allSpellsInfused`、已选注能燃料与总价格：会改写整卡次数或文本伤害，未建模即降级。
- uid 对应的 `growth[uid]`、`cardOverrides.get(uid)` 有效卡快照、`zeroFeeUntil`、`spellCost1/meleeCost1`、宇宙形态：前两项影响伤害/语义，后几项影响预览费用。
- 装备与被动：饮血剑等已结算的攻击成长由 `pstat.atkUp` 反映；深海印记等未折叠进玩家数值、或「击杀后」才发动的装备规则必须通过上下文标志降级，不从装备名称猜效果。

### 敌人/目标

- `hp/maxHp`、`status` 全部诅咒与祝福，尤其是 `bleed/immune/stealth/dodge/reduce/abreak`。
- `defense.shield/armor/guard`；多段必须在同一个克隆目标上逐段消耗，禁止「首段结果 × 次数」。
- 异能领主 `affix=aegis + turn + abreak`：复用战斗层计算出的 `aegisBlocked` 布尔上下文，不在预览模块另写回合奇偶公式。
- `protected/protects` 护卫关系：真实 `hitFoe` 会在 Combat 公式前拒绝命中，上下文必须提供目标当前是否被存活护卫者保护。
- `heartsMode`：龙巢的心值折算位于 `hitFoe`，不在 Combat 通用公式内；首批直接 `unknown(HEARTS_MODE)`。
- 龙巢 `nestSyn.dark1/dark3`、冰冻目标额外伤害、流血伤害翻倍、半血加成、血量门槛、击杀连锁等都在 `hitFoe/resolveCard` 层；不在首批白名单的组合降级。

## 5. 预计接口

```js
previewAction({
  snapshot,
  action: { kind: 'play-card', uid, targetIndex },
  cardContext: {
    card,                 // core 解析 cardOverrides 后的当前有效卡快照
    effectiveCost,
    selectedFuelUids,
    damageGrowth,
    wholeCardRepeats,
    aegisBlocked,
    targetProtected,
    modifiers: { stealthStrike, nestDark1, nestDark3, allSpellsInfused },
  },
})
```

输出为可冻结纯数据：

```js
{
  legal: true,
  cost: 1,
  targetIndexes: [0, 1],
  confidence: 'exact',   // exact | partial | unknown
  damage: {
    type: 'attack', hits: [0, 5], total: 5,
    hpBefore: 12, hpAfter: 7, lethal: false,
    shieldBefore: 0, shieldAfter: 0,
    armorBefore: 2, armorAfter: 0,
    dodgeBefore: 1, dodgeAfter: 0,
  },
  knownEffects: [],
  unknownEffects: [],
  reasons: [],
}
```

- `game/src/battle.preview.js` 实现语义指纹表、分类与纯预览。它只 import `combat.js` 和必要的纯规则函数，不 import core/view/cards，不读 DOM/SDT/RNG。
- exact 多段创建一个攻击者克隆和一个目标深克隆，对每段调用 `Combat.dealDamage`。`dealDamage` 该路径不读 RNG，也不触发 `COMBAT_HOOKS`；预览模块不调用 `addCurse/addBlessing/hitFoe/resolveCard`。
- 不用现有 `previewDamage` 循环：它每次重新克隆，会让每段都重复拥有同一层闪避/同一份护盾。
- `battle.core.js` 只新增一个只读 `getPreviewContext(uid, targetIndex)` 窄口，负责从内部状态取出有效卡、费用、成长、注能材料、整卡重复和战斗层修正，返回新的冻结对象；不暴露可变 Map/Set/内部对象。
- `battle.view.js` 不再自行解析段数或计算伤害。`showFoePreview` 改为渲染 `previewAction` 输出；更新敌人常驻槽位时，对当前 `pendingTarget` 的每个活敌人主动调用并显示点选提示。hover/拖拽继续复用同一结果，只切换动作文案。

## 6. 文件范围

计划内：

- 新增 `game/src/battle.preview.js`。
- 局部修改 `game/src/battle.view.js`：删除「单段结果 × 次数」，接纯预览模块，点选状态主动挂载每目标提示。
- 局部修改 `game/src/battle.core.js`：只读预览上下文窄口与快照签名所需最小输出。
- 必要时局部修改 `game/css/battle.css`：区分常驻点选提示和拖拽 hover 气泡，保证多敌人/窄屏可读。
- 新增 `tests/r3-a-preview.test.js` 与本包 delivery 文档。

计划外：`effect-steps.js`、`cards.js/cards-sync.json`、存档、动画、R3-b 行动收据/幂等、遭遇组重构。

## 7. 验收矩阵

### 纯预览/真实结算对照

- 从实际卡库取白名单卡，通过真实 `BattleSession.commands.playCard` 结算，对照预览的每段、总伤害、HP、护盾、护甲、闪避消耗和击倒判定。
- 至少覆盖：攻击/法术/固定单段；闪避后第二段命中；首段耗尽护盾、后段扣血；护甲/格挡/减伤/破甲/免伤/潜行；异能领主庇幕开/关。
- 对每个 exact 字段做独立断言，不只比较一个 total。
- 语义指纹每个字段各改一次，必须降级；随机/注能/击杀连锁/龙巢心等必须返回指定 reason code。
- 对同一输入连续调用 100 次：输出深相等，输入、`Random.snapshot()`、Combat hooks 计数和真实战斗快照都不变。

### 视图/交互

- 多敌人点击白名单指向卡：不 hover 即可在所有活敌人处读到各自预览，文案是「点击该敌人打出」。
- 取消后预览全清，能量/手牌/材料/敌方状态不变；重新选牌仍可打出。
- 拖拽路径显示「松手打出」，与点选文案不混用。
- 单敌人点指向卡仍直接结算，不出现额外确认。
- IAB 常规入口至少验收一场普通多敌战的「选目标→看预览→取消→重新出牌」，以及一条首脑庇幕差异。程序测试不代替这一步。
