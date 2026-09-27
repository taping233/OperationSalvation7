# M8 回迁结果（2026-09-27，Asia/Shanghai）

- 基线 HEAD：`a8e91e6`；工作区存在并行未提交改动，远端差异未核实。执行器、契约和生产接线由其他代理维护；本记录仅对应 M8 自有数据迁移与测试。
- `game/src/cards/cards.sync.m8.js` 使用 canonical 整卡深相等、既有 rules 不覆盖、schema + capability 双门通过后才保存，并在保存回读成功后写 marker；不修改 `cards-sync.json`，不接线 `cards.js`。
- M8 精确迁移 10 张：
  - `cmtn0pbkmnvc` 流光照影：starterAttack 按诅咒层数执行。
  - `cmtn1r10xnl1` 黑暗形态：discoverPlus。
  - `tt7-elementstorm` 元素风暴：doubleNextSpell。
  - `tt3-petal` 花瓣法阵：回合开始抽 1、回复 2，持续 3 次触发；空 onPlay 避免重复，描述同步为回复 2。此处按老板 2026-09-27 裁决。
  - `tt7-swordimmortal` 剑仙形态：回合开始抽 1，空 onPlay 避免重复。
  - `tt7-goldencicada` 金蝉脱壳：消耗手牌并抽 3；迁移在 ensureEffectFields 注入 draw 前运行，保持 canonical 深相等门。
  - `cmtn2jc142dj` 刀剑形态：回合开始顶层 copyRandom。
  - `tt3-grope` 摸索：抽牌范围 2–3，自身目标声明。
  - `tt7-abysscurse` 深渊诅咒：伤害、禁疗、按诅咒种类数抽牌。
  - `tt7-demonbreaker` 破甲重斩：伤害、破甲，击杀获得卡面 armor。
- 定向测试 `tests/m8-data.test.js`：32/32 通过；`tests/m5-data.test.js`：34/34 通过。后者翻转剑仙形态、花瓣法阵、discoverPlus、doubleNextSpell、onAcquire 的旧拒绝预期。
- `node --check` 已用于 M8/M11 迁移器及对应数据测试。定向数据迁移验证完成；主指挥已完成 M8/M11 生产接线，生产覆盖/实战效果由其统一检查。未 build、未跑全量测试、未做实页验收。
