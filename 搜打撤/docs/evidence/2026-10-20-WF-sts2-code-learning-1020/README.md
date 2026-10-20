# 尖塔代码借鉴实施

2026-10-20，Friday / WF-sts2-code-learning-1020。老板授权派子代理实施；三条线完成，主会话集成验收，完成未提交。

## 本轮结果

- 随机隔离：击杀喝彩改用 `visual`，记录 ID 用 `recording`，默认随机策略用 `agent-policy`。不改随机算法、地图流或存档结构；外部随机函数接口及贪心策略保持原行为。
- 战斗命令复现：`SDT.Agent.replay.capture/play` 接入真实 `Agent.step`，记录目标选择、命令、回执、随机状态及逐步诊断，首次可诊断分歧立即停。两者必须由可信本地 `prepare` 重建受控第 1 回合；包与指纹先校验，不执行包内代码，不写回私有战斗状态。
- 描述同源：包扎（治疗+护甲）、坚守（护甲+抽牌）从已有完整结构化效果读数值，接入卡面与照相馆引用渲染器。当前卡文逐字保持；自定义、未知、复杂或不完整声明整段回退。卡面缓存纳入最终描述，字段原地变化可更新。

现行接口见 [Agent 协议](../../agent-protocol.md#战斗命令复现)，分层见[架构](../../architecture.md)。精确路径与 SHA 见 [implementation-inputs.json](implementation-inputs.json)；本轮包含 11 份运行源码、3 份专属测试和 2 份现行说明，台账与证据另计。

## 验证

| 检查 | 结果与证据 |
| --- | --- |
| 集中定向回归 | 11 文件、161 项通过，[原始输出](integration-tests.log)；含三份新回归、随机服务、记录器、Agent 命令/取消、描述、战斗门面、contracts 和 architecture-boundaries。命令中的 `tests/hotpaths.test.js` 无匹配，不计入已执行文件。 |
| 回放独立复核 | 修正异常回执继续执行、隐藏费用状态漏检两项；负例及原有真实选靶/敌方回合复现通过，见 [review-replay.md](review-replay.md)。其中测试与集中回归重叠，不累加计数。 |
| 描述与缓存 | 两文件 28 项通过，[日志](description-target-tests.log)；早期既有描述测试两项一度缺 TT12，原失败保留。后续原套件单跑 18 项及原组合 46 项通过，集中回归亦通过，见[定向诊断](description-diagnostic.md)；失败同刻未采集卡库 SHA，无法断言具体原因。 |
| 静态 | [语法扫描](syntax.log) 534 文件通过；最终 11 份运行源码另逐一 `node --check` 通过。[数据校验](data.log)、[10 组类型检查](types.log)、14 份源码/测试的定向 [ESLint](lint.log) 通过。 |
| 文档与差异 | 文档守卫 findings 为空；自有路径 diff 空白检查通过。收官补齐本轮事实、覆盖边界与销账后，另保存最终文档检查。 |
| 内置实页 | Codex 当前 1280×720 窗口，无尺寸覆盖；真实照相馆搜索包扎/坚守、空档 01 新建、人物/携牌/出征、补给、三敌首战、领奖回图。流星箭雨击倒两敌、初始攻击击倒最后一敌；领冷冻射线和 1 币，回图 35/35 生命、6/16 格、消耗区 2 张。最终页面 error 为空，见 [browser.json](browser.json)。 |

实页使用 22:22 后冻结的独立副本 `搜打撤/.tmp/sts2-code-learning-preview-1020`。2948 份输入 SHA 见 [preview-inputs.json](preview-inputs.json)，本轮 11 份运行源码与副本逐字一致。截图为 [包扎](library-bandage.png)、[坚守](library-holdfast.png)、[首战胜利](first-battle-victory.png)，回图状态见 [AX 记录](browser-final-ax.txt)。浏览器未注入状态、未调用回放 API；回放与 RNG 序列由自动测试证明，实页结果不替代这些证明。

## 边界与现场

- 回放只支持本地适配器可重建的战斗场景，不支持任意整局/中途快照恢复。版本与代码指纹由宿主显式提供并标注 `caller-provided`。
- 只读诊断覆盖公共快照、piles/effects/interaction 状态和生成卡序号。触发器闭包登记表的剩余次数等未纳入投影，只能在后续可观察结果分歧时发现；不能宣称全部内部状态等价。回调源码字符串仅供诊断，不执行、不恢复闭包。
- `visual/recording/agent-policy` 从规则随机比较中排除，其他流不被重设以掩盖差异。换流会改变旧实现同种子的后续规则序列和默认随机策略动作序列；旧存档直接继承已保存位置，不追溯补偿。
- 描述覆盖仅两种已审阅完整句式，没有批量迁牌、修改牌效/数值、改 schema 或手改 cards-sync。
- core 的其他会话端口装配段已协调保留；本轮只添加诊断 imports、函数及门面方法。未触碰其他会话的 UI、战斗 view/runtime、启动、出征事务与动效代码。编辑前字节和本轮增量 diff 在本目录，描述旧字节另留 `.tmp/sts2-description-before/`。
- 自建 5341/PID18600 已核对命令行与监听归属后停止，端口和进程均不存在，见 [服务回执](service-closed.json)。临时标签已关闭，隔离副本与该 origin 测试档 01 留本地；其他服务与玩家档位未动。
- 未运行全量测试、混合工作树构建、提交、推送或发布。

## 联合全量后的性能夹具补齐

22:37，框架会话的全量检查发现 `tests/page-perf-shared.test.js` 截取 `cardHTML` 到 VM 执行，却没有注入本轮新增使用的 `displayCardDescription`，导致 ReferenceError。对方明确移交该测试后，本会话仅增加真实纯函数的 import 与 VM 上下文注入；没有修改生产实现或性能断言。

`page-perf-shared`、`sts2-structured-description`、`card-description-text` 三文件 43 项通过，原始输出见 [vm-fixture-tests.log](vm-fixture-tests.log)；该测试的 ESLint 与 diff 检查通过。1024 种动态选项输出一致、缓存上限 32 条和重复命中复用等断言均保持。测试最终输入 SHA 见 [vm-fixture-input.json](vm-fixture-input.json)。结果已回告框架会话，其他全量失败由其按既定属地处理；本会话没有宣称联合全量已通过。此补齐仅测试夹具，无需重复游戏实页。
