# M10 Hosted 装备回迁结果

- 时间：2026-09-27 22:41（Asia/Shanghai）
- HEAD：`a8e91e6`（`docs: add parallel engineering inventory reports (card migration, type contract, regression audit)`）；工作区有并行未提交改动，本记录只覆盖 M10 数据与测试。远端 `origin` 本轮未 fetch，差异未知。
- 范围：新增 `game/src/cards/cards.sync.m10.js`、`tests/m10-data.test.js`。主指挥负责将 M10 回填接入启动链；runtime 负责 hosted 执行器、固定 id/name 注册表与消费实现。未修改 `cards-sync.json`、`cards.js` 或共享执行器。

## 已登记（11 张）

| canonical id | 固定 hosted name |
|---|---|
| `tt2-frostsword` | `frost-sword` |
| `tt3-crimson-pouch` | `crimson-pouch` |
| `tt3-fate-wheel` | `fate-wheel` |
| `tt3eq-boiler` | `boiler` |
| `tt3-azure-sword` | `azure-sword` |
| `tt3-chaos-eye` | `chaos-eye` |
| `tt3-immortal-blade` | `immortal-blade` |
| `tt3-silver-runesword` | `silver-runesword` |
| `tt3-sapper-bomb` | `sapper-bomb` |
| `tt3-wolf-bow` | `wolf-bow` |
| `tt3-reverse-bow` | `reverse-bow` |

每張僅回填 `rules: { version: 1, battle: { hosted: ['<name>'] } }`，hosted name 必須在固定 registry 內，執行端從穩定 canonical id 取只讀定版描述。回填要求存檔與運行時卡庫一致、無自有 rules、與 `TABLETOP10` canonical 整卡深相等；schema/capability 双门、保存复读成功后才写 marker。M7 已分别迁入 `tt3-master-staff` 和 `tt3-twinwater-mail`，不在本批重复登记。

## 验证边界

- `npx vitest run tests/m10-data.test.js --no-file-parallelism`：3 tests passed，覆盖 11 个 id/name 的 schema/capability、canonical 保守回填及玩家改卡/已有 rules/缺卡保护。
- 生产启动检查在 M10 接线前显示这 11 张仍缺 rules；主指挥随后负责启动接线，本记录未核实接线后的生产启动结果。
- 未做 M10 专属 BattleSession 实战流程、全量 Vitest、build 或实页验收。hosted 实际行为须结合 runtime 执行器工作及后续统一验证判断。
