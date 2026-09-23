# 代码健康修改计划 · 2026-09-23

范围：Vite 主线。负责人 Friday；原子任务由 GPT-6-luna 并行执行，Friday 复核并集成。
基线：05053bc 加工作区现有修改；照相馆已单独提交 9c08255。
标题页样稿 19 个文件已按老板指令移入回收站。所有已有战斗、TT12 卡牌、效果结算和文档改动均保留。

## 本轮交付与文件所有权

| 任务 | 负责人 | 修改模块 | 明确结果 | 验收 |
| --- | --- | --- | --- | --- |
| A 备注基线 | 6-luna / notes_baseline | `game/src/card-photo-notes.js`（说明）；`tests/card-photo-notes.test.js`；`tests/card-notes-coverage.test.js` | 底稿允许为空；测试覆盖有/无底稿、手写优先、清空回落；真实数据只校验已存在条目的合法性 | 两份测试全绿；空/非空底稿使用隔离样例，不要求真实数据库永远为空，不 skip |
| B 自动质量门槛 | 6-luna / card_replay（C 完成后接手未启动的 quality_gate） | `package.json`；新增 `scripts/check-syntax.mjs`；仓库根新增 `.github/workflows/vite-quality.yml`；新增 `docs/quality-gates.md` | 复用现有 acorn 做语法检查；CI 安装锁定依赖，检查语法、数据、串行测试、构建和性能预算 | 错误退出码非零；无 continue-on-error；无新依赖；本地脚本可运行；远端 CI 未运行必须明示 |
| C 卡牌旧批次重播保护 | 6-luna / card_replay | `game/src/cards.sync.js`；按需新增 `game/src/cards.canonical.js`；新增 `tests/cards-replay.test.js` | TT10/TT11 重播写入时以 cards-sync 同 id 定版为准，保留仓库独有元数据；已退役卡不复活 | live-sync 已标记、旧批次未标记时，陈旧快照不能覆盖新描述/数值；新卡补种、元数据、幂等和玩家编辑保护均有行为测试 |
| D 战斗规则提取 | 6-luna / notes_baseline（A 后复用） | `game/src/battle.engine.js` 的费用与意图计算；新增 `game/src/battle.card-cost.js`、`game/src/battle.intent.js`；新增对应规则测试 | 费用与敌方意图成为显式输入的纯计算；引擎只传入当前状态，保持已有导出和调用方不变 | 费用优先级、零费有效期、TT12 护甲/消耗口袋折扣、蓄力回合、流血加伤、双击预告不变；既有战斗回归通过 |
| E 集成与交接 | Friday | 本文；`docs/architecture.md`；必要时 `tests/compendium.test.js` 的生成开关与 docs 脚本（先确认生成副作用） | 文档反映实际模块，测试不覆盖他人的手改文档；明确已完成与尚未完成 | 复核每个文件差异；定向检查后统一串行集成回归；不混入其他任务提交 |

## 执行顺序

1. A、B、C 并行，各自只写所列文件；不得修改同一热点文件。
2. A 通过复核后启动 D；D 必须完整保留工作区已有 TT12 等逻辑，只迁移计算，不改变规则。
3. Friday 检查接口、数据优先级与负面用例，统一测试，补架构说明和结果。
4. 本轮工程改动与照相馆提交分开。未经再次明确授权不推送；不把其他任务半成品提交进来。

## 保留模块及下一阶段边界

| 模块 | 本轮处理 | 后续明确条件与验收 |
| --- | --- | --- |
| `cards.data.js`、`cards.consts.js`、`cards.js`、`cards.rules.js`、`game/data/cards-sync.json` | 保留现有 TT12 与定版内容；C 只修写入优先级，不宣称已消除所有重复数据 | 先确认哪些字段由制作坊维护、哪些是引擎元数据，再把历史批次变为 id 清单；新档与全部旧档迁移结果一致后才能移除重复定义 |
| `battle.effects.js`、`effect-steps.js`、`effect-steps.ctx/curse/damage/kills/tail.js`、`effect-verbs.js` | 不重排、不改现有结算，保留当前未提交效果修复 | 现有引擎已支持 dmg/dmgType/heal/draw 结构化字段；后续按效果族迁移剩余文本规则，分别验证时点、目标、次数、随机源与叠加顺序，防止结构字段与文本双算。不能把“改一句文案”视为整库迁移 |
| `battle.runtime.js`、`battle.actions.js`、`battle.enemy-phase.js`、`battle.core.js` | 保持状态、队列、敌方回合及命令门面 | D 不改变生命周期；下一阶段再依据耦合与故障频率决定是否抽取其他机制 |
| `game.storage.js`、`game.store.js`、`game.session.js`、`base.js` | 保持存档协议；纳入兼容与恢复回归 | 没有数据格式变化，不升 schema 版本、不重置玩家存档 |
| `game.cardslib.js`、`cards.view.js`、`expedition-library.css`、照相馆资源 | 已按老板指令单独提交 | 浏览器已验证照相馆与下一片操作；不将此次结果当作全平台视觉验收 |
| `icons-bitmap.js`、`tools/nai_gen.py`、临时截图、Python 缓存 | 不属于本轮工程改动，原样保留 | 由对应任务决定去留 |

## 验证口径

- 单个子任务仅跑对应定向用例，使用 `--no-file-parallelism --reporter=dot`。
- 全量测试只由 Friday 集成收尾时统一运行；先确认 compendium 测试是否写文件，避免覆盖现有未提交文档。
- 当前工作区有其他任务半成品，不执行本地生产 build；CI 配置中的 build 是未来干净检出的门槛，并不代表本轮已经验证生产产物。
- 语法检查不是类型检查；本轮不整体迁移 TypeScript、不更换框架、不引入新引擎。
- 不以删断言、skip、放宽失败退出码来实现“全绿”。

## 执行记录

- 照相馆：9c08255；8 个文件；premium-ui-pages + contracts，26/26 通过；内置浏览器检查照相馆及下一片成功。
- A：完成并复核。空/非空底稿使用隔离 mock；保留真实数据质量检查，避免测试样例覆盖真实条目。两份测试 8/8 通过。
- C：完成并复核。cards.sync.js 在 TT10/TT11 写入处优先使用定版字段，并服从定版 retire；新增两个重播行为场景。cards-replay、snapshot-guard、cards、save-compat 共 29/29 通过。
- E：普通 compendium 测试不再写文件；只有 `npm run docs:compendium` 生成落盘。与备注测试联合验证 12/12 通过，运行前后已有全书内容相同。
- 数据校验：通过（宠物 6、成就 23、怪物 15、场景 12、同步定版卡 55）。同步卡数量不是全卡库数量。
- B：完成并复核。Acorn 解析 144 个项目源码文件通过；workflow YAML 解析通过，CSS、页面入口、剧情、测试路径均匹配 push/PR 触发条件。远端 CI 尚未运行，生产 build 未运行。
- D：完成并复核。提取两个纯计算模块，原接口不变；新增 8 个规则测试，定向合计 59/59 通过。
- 最终集成：`npx vitest run --no-file-parallelism --reporter=dot`，104 个文件、603 项全部通过，耗时 259.77 秒。日志：`C:\Users\太平\AppData\Local\Temp\soudache-health-20260923-vitest.log`。
- 非阻断提示：卡牌审计报告 12 张卡存在未识别句式，另有零效果人工复核提示；这不直接等于未实现，也不能因测试通过而认定全部玩法已验收。jsdom 的 Pixi renderer 警告不构成浏览器渲染验收。
- 本轮 A–E 完成；工程改动保持未提交，与已有半成品区分审阅。仅照相馆已按老板明确指令提交，未推送。整库数据归一和剩余文本效果迁移仍属于上表下一阶段。
