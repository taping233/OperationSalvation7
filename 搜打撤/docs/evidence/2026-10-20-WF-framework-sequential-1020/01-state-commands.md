# 局内领域命令与 flow 用例拆分

商店买入、初始攻击补充、出售和委托优惠已由显式状态与服务端口的命令承接。事件支付、选择卡牌领取、批量重编、碎片和生命上限变化及节点结算预留已收进事件命令；控制器保留页面身份、呈现和流程承接。业务源码于 2026-10-20 20:25（Asia/Shanghai）冻结，随后命令 JSDoc 与类型由第四代理接续。

## 本轮增量

对比来源从项目根计算为 `../.tmp/framework-sequential-1020/baseline/`；初始 SHA 以本证据目录 `baseline.json` 为准。工作树原有完成未提交改动未回滚。文件对比及本次读取时 SHA 见 `01-state-commands-files.json`，该清单不是第四代理后续类型增量的最终冻结凭据。

| 文件（相对项目根） | 本轮变化 |
| --- | --- |
| `game/src/run/shop-commands.js` | 新增买、补、卖命令；报价/owned/UID/容量/资源复检；重入锁；检查点保存回执；委托免单草稿整批应用 |
| `game/src/run/event-commands.js` | 新增支付与确定性收据、发牌及选择预留、整批重编、资源与生命命令、事件节点预留及承接核验 |
| `game/src/run/run-domain-commands.types.d.ts` | 新增显式状态、报价、服务端口与结果类型，随后交第四代理收口 |
| `game/src/run/game.run.shop.js` | 买、补、卖接入命令，现有页面与会话/报价守卫保留 |
| `game/src/run/shop-commission.js` | 委托商品价格与优惠标记改由领域命令整批应用，保留原草稿失败回退协议 |
| `game/src/run/event-card-choice.js` | 普通选择领取由事件命令预留并发牌；特殊阿猫奖励页承接保持现行协议 |
| `game/src/run/game.run.flow.js` | 1352 行降为 377 行，保留移动、落脚路由及懒装配，原导出保持 |
| `game/src/run/game.run.events.js` | 新增完整事件生命周期工厂：抽取、页面/请求身份、故事、投骰、中间状态、奖励承接与保存重试 |
| `game/src/run/game.run.resources.js` | 新增完整物资二选一工厂：冻结候选、详情/整理返回、领取、放弃、检查点重试 |
| `tests/run-domain-commands.test.js` | 新增 11 个独立领域测试，覆盖 UID 准备后资源/容量/报价失效、完整内存成交、重入、出售身份、支付收据与批量拒绝 |
| `tests/run-event-controller-ownership.test.js` | 新增 2 个工厂隔离测试：不同实例互不取消，同一实例的新请求压制迟到前驱 |
| `tests/events-0919.test.js` | 原结算源码守卫定向读取新事件属地，业务断言未削弱 |

## 保持的行为边界

- 商店命令在生成 UID 之后再次检查容量、余额、报价及页面会话；在内存中完整提交币、卡、货架后才保存。明确 `false` 或保存异常产生未保存回执，完整成交保留，重试仅保存。
- 委托免单处于领取前草稿阶段，继续保留既有保存失败整批恢复价格/标记/status 的协议，投骰结果保留。该协议与已成交商品失败不回滚的协议分别沿用，未新增玩法。
- 事件批量重编先验证全部原卡与候选，再准备全部替换卡，最后统一更新；旧节点已授予资源/卡或建立奖励快照后，即使呈现异常也不还原为可重领。
- 金币倍率、治疗和伤害终局行为仍由现行服务端口执行，未复制其规则。新事件/资源工厂显式注入 game、UI、卡库、场景、保存和 dom 端口，不捕获 `SDT`/`window`/`document`，不引入第二份全局状态。
- 阿猫主卡及附赠仍统一交接固定待领奖页；满牌盒换牌未实施。PENDING43 未新增规则。

## 验证

本项使用现有依赖，未运行 build、提交、推送或修改全局配置。首次受限 Vitest 启动遇到 `spawn EPERM`；对同一必要测试命令使用已授权的沙箱外子进程后执行成功。

1. 命令首次接线：`run-domain-commands`、`shop-settlement-unification`、`event-settlement-unification`、`event-callback-lifecycle-audit`、`sys03-loot-shop-txn`，5 文件 139 测试通过。
2. flow 拆分后：上述测试加所有相关事件恢复、阿猫附赠、重编、节点、谜题、四玩家回归，以及 `events-0919`、`run-architecture`、`contracts`、`architecture-boundaries`，15 文件 261 测试通过。
3. 再补地图/故事/节点/资源范围共 22 文件：291 测试通过、11 失败。失败包括装配提前读取未使用的局部 mock 场景端口及新架构守卫发现工厂隐式 document；已将场景适配改为懒调用、DOM 改显式注入。没有把失败算作通过。
4. 修复后的实际闭包补验：`r6-story-flow.repro`、`map-travel-motion`、`run-event-controller-ownership`，3 文件 15 测试通过；`event-callback-lifecycle-audit`、`node-retrigger`、`architecture-boundaries`，3 文件 89 测试通过。复用其余代码与环境未变化的结果，最终集成全量由主代理统一执行。
5. 11 个本项源码/测试文件定向 ESLint 通过（退出码 0）。命令 strict 试跑已定位传递依赖现有 JSDoc 缺口，交第四代理统一覆盖，不将此试跑记为类型全绿。

jsdom 资源重入测试存在音频无 codec、美术预取桩缺少 `arrayBuffer` 和测试职业缺图警告，断言通过；它们不提供真实页面视觉证据。

## 交接与未核项

当前内置窗口的游戏实页验收、最终全量测试和统一类型/架构门由主代理及第四代理接续。本项未操作浏览器，未宣称实页通过。无剩余本项业务实现阻塞；现有特殊奖励承接、骰子与候选快照的页面元数据仍随原协议维护，没有扩展到全部 SDT 消费者迁移。

## 集成后源码守卫位置补正（20:42）

主代理全量报告 `../.tmp/framework-sequential-1020/full-vitest.json` 发现四处测试入口仍按拆分前位置扫描事件源码。本次只修正扫描属地，未改运行时业务和语义断言：

- `tests/message-batch-0920-late.test.js` 改读 `game.run.events.js`，同组事件背景、空投药水投骰和投骰前说明三个锚点一起沿真实属地验证。
- `tests/pocket-restore-interface.test.js` 从 `game.run.events.js` 提取修鞋铺入口说明，公共复原界面操作及次数断言保留。
- `tests/r6-story.test.js` 从 `game.run.events.js` 检查先提交故事再承接节点、身份核验、保存失败恢复和结果页语义，原全部断言保留。
- `game/selftest.js` 的局内源码扫描集合加入事件与资源用例模块；未知事件旧效果兼容断言原样保留，`tests/selftest-paths.test.js` 继续执行真实零依赖自测入口。

已检查以上守卫内其他 flow 拆片锚点，无剩余旧事件源位置。本次四组定向回归 4 文件 40 测试通过（20:42:05）；上述源码及四组测试共 5 文件 ESLint 退出码 0。该补正不改变 20:25 运行时业务冻结版本，可复用正在进行的实页行为证据。
