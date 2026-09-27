# M11 剩余普通卡迁移结果（2026-09-27，Asia/Shanghai）

- 基线 HEAD：`a8e91e6`；工作区存在并行未提交改动，远端差异未核实。M11 数据迁移采用 canonical 整卡深相等、既有 rules 不覆盖、schema 与 capability 双门、保存回读后写 marker；生产接线由主指挥处理。
- 本批覆盖主指挥指定 M8/M11 普通卡范围的剩余 22 张：21 张使用 runtime 固定 ID→name canonical hosted adapter 保持现有语义，员工通行证 A 使用已接线的结构化地图背包规则。
- M11 ID 清单：`cmtn1wnhhym`、`cmtn233trmeg`、`tt3-fatal-pierce`、`tt3-frostfall`、`tt3-qi-wave`、`tt7-bloodpoison`、`tt7-ghostblade`、`tt7-marchrush`、`cc-poison-burst`、`tt12-felguard`、`tt12-freezeray`、`tt12-raydragon`、`tt3-magic-lamp`、`tt7-holyheal`、`tt7-meteorstrong`、`tt7-provoke`、`tt3sp-bloodstorm`、`tt3sp-flowerzhen`、`tt3sp-silverthorn`、`tt-token-color`、`tt-medneedle`、`tt7-arcanebolt`。
- `tt-token-color` 使用真实地图背包消费者 `bag.use.acquire(pool.classAbility)`；runtime 确认地图侧可消费。它是唯一未使用 battle hosted 的卡。`tt7-provoke` 由固定 canonical hosted 适配保留既有选择语义；未在数据层改动目标交互。
- 21 张 hosted 名称见 `game/src/cards/cards.sync.m11.js` 的 `M11_HOSTED_BY_ID`；宿主映射与执行行为由 runtime 负责。本代理未验证实战执行。
- 定向验证：`tests/m11-data.test.js` 24/24 通过（包含 `tt-token-color` 结构化背包规则及其余 21 张 hosted）。主指挥已完成 M8/M11 生产接线并负责生产覆盖检查；未 build、未跑全量测试、未做实页验收。
