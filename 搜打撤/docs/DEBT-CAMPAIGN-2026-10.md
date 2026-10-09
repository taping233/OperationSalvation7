# 三笔结构性债务清偿计划（2026-10-02 立项，老板令全部改完）

文档身份：10-02 立项与进度快照。下文的分工、文件数、现场占用和状态保留记录时点；当前执行状态查[任务入口](STATUS.md)，工程选题查[现行计划](production/management/NEXT-CYCLE-TECH-PLAN.md)。历史派工与命令不作为新任务的执行指令。

> 总控页。来源：10-01 提交机制体检的评估结论——门禁 48s 全量惩罚是这些债务的利息。
> 分工（老板批准开子代理）：架构决策与核心手术 Friday 主刀；批量机械活与验证循环 GLM-5.3-Flash 子代理执行，圈死禁手清单（不碰 cards-sync.json、不顺手删疑似死代码、每任务带 doneWhen+exit code 证据）。
> 进度指针在本文末表；证据入 `docs/evidence/<日期>-<任务>/`。

## 任务一 DEBT-1 状态写入通道收敛

- **现状疑点**：PENDING #11（09-29）已删 set$×25 定义行改走"文件内赋值/引用变异"+SETTER_EXAMPT 白名单；而 10-01 F1 否决记录称"set$ 赋值与数组原位变异并存，无统一写入信号，代际缓存会漏事件"。两记录需对照源码定性——**第一步是精确定性，不是动手改**。
- **doneWhen**：①写出《状态写入通道现状定性》（共享状态清单×写入点×通道分类，机器可查证）；②按定性给出收敛方案并实施或挂老板拍板；③architecture-boundaries/contracts 守卫绿+全量绿。
- **风险**：定性不清就改=F1 同款返工；battle 域状态语义错改直接毁结算。

## 任务二 DEBT-2 类型 strict 扩面（渐进）

- **现状**：6 个 strict 配置共 38 文件局部覆盖（settlement/snapshot/card-rules/foundations/hand-selection/selection）；jsconfig.json 9 文件 loose；battle/runtime 13 文件、hub、run、ui 等 200+ 文件无 strict 覆盖。
- **路线**：按依赖图从叶子往上逐域建 strict 配置（新配置=新 jsconfig.strict-<域>.json+check-types 挂载+WORKFLOW_TESTS 无需动）；每域 doneWhen=该域 tsc strict 零错误+全量绿。先试点 1-2 个低风险域（battle/view、experience 类叶子），验证流程后再批量派 flash。
- **分工**：Flash 主力（补 @typedef、修类型错、跑 tsc 循环）；Friday 定域边界+验收。
- **doneWhen**（总）：strict 覆盖文件数 38→100+，新增每配置全绿进 check-types 常驻。

## 任务三 DEBT-3 battle.engine 拆分（1408 行 83 函数无分节）

- **前置**：DEBT-1 定性完成（状态通道不明时拆引擎=双重风险）。
- **路线**：Friday 主刀。依赖图+影响面（54 邻近测试）定切分边界→分文件迁移（机械部分可派 Flash）→boot-order/契约/快照守卫全绿→全量绿。
- **doneWhen**：battle.engine ≤600 行或拆为 engine 核心+子模块；每步定向+全量证据；无行为漂移（快照/回放测试兜底）。

## 禁手与纪律（对子代理同样生效）

- 不碰 `cards-sync.json`；不改 `docs/PARALLEL-REGISTRY.md`/`PENDING.md`（Friday 统一登记）；不顺手删"疑似死代码"（判伪纪律）；不 build 不提交（集成归 Friday）；改动只限任务域文件。

## 进度

| 任务 | 状态 | 证据 |
|---|---|---|
| DEBT-1 写入通道收敛 | ✅ 定性收官（受控双轨，方案 A 采纳零改动；B 挂 PENDING #30） | evidence/2026-10-02-DEBT-1/characterization.md |
| DEBT-2 strict 扩面 | 🟡 两批落地：8 文件 strict 零错（第一批 4+第二批 feedback.local/diagnostics/hud/route-overlay），jsconfig.strict-ui 统一 @ts-check 形态常驻 check-types 第 8 配置；两轮全量绿（268 文件）；flash 共 7 文件 1 轮全过+escalate 依赖先行+先例复用；剩 ui.js/game.menu/quick-nav 大件依赖闭包大待第三批 | evidence/2026-10-02-DEBT-2/；jsconfig.strict-ui.json |
| DEBT-3 engine 拆分 | 🟡 边界方案落档（定性反转：组装层非泥球，闭包耦合极低，函数天然成族）；实施待 DEBT-2 试点收尾后 | evidence/2026-10-02-DEBT-3/split-plan.md |

## 衍生任务：全量审计（10-02 老板令，flash 十域流水线）

112 条是10-02审计时点发现，不是当前待执行清单。按 [PENDING #31](PENDING.md) 已决记录，A档已执行72条、15条复验跳过（含误报），B-1 readIdentity memo已做；相关代码/记录随 `6f2cf68` / `e406955` 落库。B-2走格落盘合帧仍待专项，B-3收据修剪仍待重放契约决定；不按旧报告重复删除。原报告见 `docs/evidence/2026-10-02-code-audit/REPORT.md`。

## 现场注意（10-02）

多会话并行：WF-code-map（待验收，属地 code-map/+impact-query+gate 导出）、WF-agent-toolbox（完成未提交，属地 AGENT-TOOLBOX.md/package.json/iab-drive/README）。DEBT 属地与两会话无代码交叉；共享台账（REGISTRY/PENDING）编辑需锚点精确追加防冲突。
