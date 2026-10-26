# 满月形态修正与卡名核对

2026-10-26，Friday；按老板授权完成未提交。

「满月形态」（`tt3-nature-form`）只提高本场战斗能量上限1点；施放时删除额外获得能量的效果及自动拼接文案。卡牌能量策略由 `cards/card-energy-policy.js` 统一维护，结构化结算、旧文本结算和展示共用；文本与结构化结算共用能量上限命令，其他卡沿原补能行为。卡名已是满月形态，内部ID保留。`natureForm` 祝福的回合开始效果与这张卡的即时效果分别结算。

## 已验证

- `battle-equipment-skill-synthesis.test.js`、`card-description-text.test.js`、`sts2-structured-description.test.js` 共83项通过。新增真实 BattleSession 场景验证：扣除2费后当前能量不额外返还、能量上限增加1点、下一回合按新上限恢复；原先自然形态文案断言失败已消除。报告 `node_modules/.cache/test-reports/2026-10-26T15-49-32.406Z-79df9229.json`。
- 原全书生成及一致性13项通过，满月形态描述已更新。报告 `node_modules/.cache/test-reports/2026-10-26T15-50-48.107Z-8ab5bb9b.json`。
- 目标源码与新增测试断言lint、目标diff空白检查通过。
- 本轮未补浏览器实页、未执行全量测试或build；玩家存档未写入，未提交推送。

## 卡名检查

依据当前有效卡库291张与65个已知旧别名，只读核对源码/现行文档。复核40处命中：31处现行引用仍用旧称，涉及20个旧名；9处为历史说明或旧召唤名兼容，不计作当前错误。结论与具体位置见 [卡名核对清单](name-audit.md)，原始证据见 `name-audit.json`。其他卡名与文档问题本轮仅记录；保留原有改动和归属。

范围：`game/src/cards/{card-energy-policy,structured-card-description}.js`、`game/src/battle/core/{battle.effect-assembly.domain,battle.resolution.domain}.js`、`battle.core-ports.types.d.ts`、`game/src/battle/effects/effect-steps.tail.js`、`tests/battle-equipment-skill-synthesis.test.js`对应满月用例、`docs/rules.md`对应条目、生成全书及本证据目录。
