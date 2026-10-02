# 规则文档重复口径扫描清单（scan-dup-rules）

- 扫描日期：2026-10-02；执行：WF-process-refine 会话（Flash 子代理「口径扫描员」）。
- 扫描范围：`AGENTS.md`（根）、`搜打撤/README.md`、`搜打撤/docs/README.md`、`WORKFLOW-TOOLS.md`、`quality-gates.md`、`QUICKSTART.md`、`SPEC-PROCESS.md`、`PARALLEL-DISPATCH-PLAYBOOK.md`、`AGENT-TOOLBOX.md`、`roadmap.md`、`PENDING.md`（仅 L1–8，即「## 活账」之前的规则节）、`PARALLEL-REGISTRY.md`（仅 L1–8，即「## 活跃登记」之前的规则节）。
- 路径说明：任务所列 `搜打撤/AGENTS.md` 在工作区不存在；各文档所称「根 AGENTS.md」为仓库根级 `AGENTS.md`，按其扫描，位置记作 `AGENTS.md:<行号>`。
- 类型：full＝完整规则表述（含约束细节）；pointer＝指针式引用（说「见某文档」，无细节或仅摘要）。
- 摘录均逐字取自原文（表格行内竖线以 `\|` 转义）；同一条原文覆盖多个主题时在各主题下分别立条。

| 主题 | 位置 | 类型 | 摘录 |
| --- | --- | --- | --- |
| 内置浏览器边界 | AGENTS.md:23 | full | 浏览器操作/游戏验收仅用当前平台内置浏览器（Codex 或 ZCode），只验当前窗口，多尺寸须明确要求；不可用就记录阻塞，不改用外部 Edge/CDP/headless。 |
| 内置浏览器边界 | 搜打撤/docs/README.md:11 | full | 2026-09-30 老板批准：项目规则与事实共用，Codex / ZCode 各自适配入口；仅用当前平台内置浏览器。 |
| 内置浏览器边界 | 搜打撤/docs/README.md:41 | full | 留言按内置浏览器 + 来源地址核验；localStorage 隔离于浏览器配置和 origin。没有可读入口记录未核验，不推断没有留言。 |
| 内置浏览器边界 | 搜打撤/docs/README.md:49 | full | 两端浏览器能力入口见质量门；仅用当前平台内置浏览器和当前窗口。不可用时记阻塞，继续独立工作，不切外部浏览器。 |
| 内置浏览器边界 | 搜打撤/docs/WORKFLOW-TOOLS.md:3 | pointer | 授权、属地与当前平台内置浏览器边界沿用根 AGENTS。 |
| 内置浏览器边界 | 搜打撤/docs/WORKFLOW-TOOLS.md:49 | full | 玩家可见变化｜当前平台内置浏览器、当前窗口真实路径｜按质量门保存实际证据。 |
| 内置浏览器边界 | 搜打撤/docs/WORKFLOW-TOOLS.md:66 | full | 内置浏览器采集函数在 `scripts/workflow-browser.mjs`；……旧page-snapshot命令只作同一安全入口，不启动外部浏览器。 |
| 内置浏览器边界 | 搜打撤/docs/quality-gates.md:61 | full | Codex 与 ZCode 都只能使用当前平台内置浏览器访问 Vite dev server；默认只验当前窗口，多尺寸须老板明确要求。不要用外部 Edge/CDP/headless 或 `python http.server` 替代。 |
| 内置浏览器边界 | 搜打撤/docs/quality-gates.md:62 | full | Codex：使用当次可用的内置浏览器工具入口……ZCode：使用当次内置浏览器工具说明与已授权桥接入口；方法名、返回值与点击能力先核实，历史经验不代表当前能力。 |
| 内置浏览器边界 | 搜打撤/docs/quality-gates.md:63 | full | 内置浏览器不可用、没有来源页或服务不可安全启动时，记录平台、来源地址、时间、错误和未核验场景；继续独立工作，不换外部浏览器，不宣称实页通过。 |
| 内置浏览器边界 | 搜打撤/docs/quality-gates.md:68 | full | `scripts/page-snapshot.mjs` 已改为导入/对比当前平台内置浏览器证据……采集由当次内置工具完成，平台/操作声明须核对；窗口/origin/身份不一致记 inconclusive。 |
| 内置浏览器边界 | 搜打撤/docs/quality-gates.md:69 | full | B 档实页验收可用固定剧本……剧本断言 JSON 当逻辑证据 + 当次内置浏览器关键页截图 1–2 张当视觉证据，两者合并构成实页证据。 |
| 内置浏览器边界 | 搜打撤/docs/QUICKSTART.md:9 | full | 游戏验收只用当前平台内置浏览器（当前窗口）；主线 dev 端口 5200，产物 preview 8139。 |
| 内置浏览器边界 | 搜打撤/docs/PARALLEL-DISPATCH-PLAYBOOK.md:17 | full | 两端仅用各自内置浏览器与当前窗口，入口及证据口径见质量门；内置桥故障不得切外部 Edge/CDP/headless。 |
| 内置浏览器边界 | 搜打撤/docs/AGENT-TOOLBOX.md:15 | pointer | 玩家可见变化 → 内置浏览器跑 SDT.Agent.scenes 剧本 |
| 内置浏览器边界 | 搜打撤/docs/AGENT-TOOLBOX.md:29 | pointer | 跑固定验收剧本……内置浏览器 console：`await SDT.Agent.scenes.run('battle')` |
| 内置浏览器边界 | 搜打撤/docs/AGENT-TOOLBOX.md:30 | pointer | ZCode 内置浏览器专用；`openGame()`/`clickDevButton()`/`evalRaw()`；默认主线 5200 |
| 验收分级与质量门 | AGENTS.md:22 | full | 默认定向验证；A 档删除三证据与 B 档全套沿用老板拍板口径……全量以 CI 为准、本地阶段收尾可选，「落库」不自动触发本地全量。 |
| 验收分级与质量门 | 搜打撤/README.md:22 | full | 默认只运行相关检查；全量测试用于收尾落库或公共架构改动。下面是命令入口，不要求每次全部执行。 |
| 验收分级与质量门 | 搜打撤/docs/README.md:48 | full | 按质量门选择文档、A 档删除或 B 档语义验收；记录定向/全量/实页各自范围。生成、构建、脚本输出均不能单独宣称完整验收。 |
| 验收分级与质量门 | 搜打撤/docs/WORKFLOW-TOOLS.md:47 | full | 工程说明、状态、归档导航｜docs:check，必要时文档守卫｜不跑游戏全量/build |
| 验收分级与质量门 | 搜打撤/docs/WORKFLOW-TOOLS.md:48 | full | 有直接测试的代码/流程脚本｜相关测试与现有门选择｜公共边界/阶段收尾按质量门完整验收 |
| 验收分级与质量门 | 搜打撤/docs/WORKFLOW-TOOLS.md:49 | full | 玩家可见变化｜当前平台内置浏览器、当前窗口真实路径｜按质量门保存实际证据 |
| 验收分级与质量门 | 搜打撤/docs/WORKFLOW-TOOLS.md:50 | full | 数据 / 剧情 / fixture / 纯删除｜依赖图或引用定向（提交门自动选择）｜复用有效结果，范围或源码/环境改变再验 |
| 验收分级与质量门 | 搜打撤/docs/WORKFLOW-TOOLS.md:51 | full | 包配置、未知脚本、公共状态/存档边界｜保守回退完整检查（全量以 CI 为准） |
| 验收分级与质量门 | 搜打撤/docs/WORKFLOW-TOOLS.md:64 | full | 定向报告保存测试与关联静态输入的依赖闭包……无法证明时保守回退项目范围；full/suite保持项目范围。 |
| 验收分级与质量门 | 搜打撤/docs/WORKFLOW-TOOLS.md:84 | pointer | 保留短反馈与集成验证，具体门槛按本项目质量门，不照搬引擎工具。 |
| 验收分级与质量门 | 搜打撤/docs/quality-gates.md:3 | full | 仓库根目录的 `.github/workflows/ci.yml` 在发往 `master` 的 PR 和 `master` push 上运行静态检查与完整测试。 |
| 验收分级与质量门 | 搜打撤/docs/quality-gates.md:19 | full | 提交钩子调用 `scripts/acceptance-gate.mjs`，根据暂存路径先打印选择理由……再执行语法、数据、七配置类型、lint 和定向 Vitest。 |
| 验收分级与质量门 | 搜打撤/docs/quality-gates.md:21 | full | 快速门是局部反馈，不表示整项目通过。全量以 CI（master push/PR）为准……"落库"不自动触发本地全量。 |
| 验收分级与质量门 | 搜打撤/docs/quality-gates.md:27 | full | 纯工程说明/流程文档｜自有 diff、事实/指针核对、相关文档守卫；不跑游戏全量或 build |
| 验收分级与质量门 | 搜打撤/docs/quality-gates.md:28 | full | A 档删除｜删除先获批；静态三证据 + 定向验证，免实页 A/B、免全量 Vitest｜三证据不全或分类不确定，一律 B 档 |
| 验收分级与质量门 | 搜打撤/docs/quality-gates.md:29 | full | B 档语义 CSS/逻辑/共享架构｜定向验证 + 当前窗口内置浏览器实页；全量以 CI 为准，公共架构改动在 CI 或阶段收尾跑全量 |
| 验收分级与质量门 | 搜打撤/docs/quality-gates.md:33 | full | 本矩阵描述人工验收，不修改 `acceptance-gate.mjs` 的选择算法或提交钩子……其他会话半成品在共享树时不 build，定向结果注明混树边界。 |
| 验收分级与质量门 | 搜打撤/docs/quality-gates.md:39 | full | 可用 `npm run check:quality` 按语法、数据、类型、lint、测试、构建顺序执行完整本地质量门……有其他会话半成品时，不运行包含 build 的组合入口。 |
| 验收分级与质量门 | 搜打撤/docs/quality-gates.md:41 | full | 混合工作树可先用 `npm run check:staged:isolate -- --plan` 核对……没有暂存或纯说明未运行测试时标 skip，不能宣称全量通过。 |
| 验收分级与质量门 | 搜打撤/docs/quality-gates.md:73 | pointer | 文档只描述配置，远端 GitHub Actions 是否实际运行及结果以对应提交或 PR 的记录为准。 |
| 验收分级与质量门 | 搜打撤/docs/QUICKSTART.md:8 | full | 提交门挂载：`git config core.hooksPath` 应指向 `搜打撤/.githooks`……不挂=提交没有门，红灯用例会直接进主干。 |
| 验收分级与质量门 | 搜打撤/docs/QUICKSTART.md:32 | full | 混树提醒：……`check:staged:plan` 会拒绝并列出来源（设计内保护）；此时用 `npm run check:staged:isolate -- --plan` 冻结 index 单独验证。 |
| 验收分级与质量门 | 搜打撤/docs/QUICKSTART.md:34 | full | 提交钩子按暂存路径自动选定向测试并打印理由；数据/剧情/fixture/纯删除走定向，包配置/公共状态边界回退全量。 |
| 验收分级与质量门 | 搜打撤/docs/QUICKSTART.md:35 | full | 全量以 CI 为准；本地全量 `npm test`（并行约 1.5 分钟）只在阶段收尾且 CI 不可用时跑。全量红灯先查 PENDING 是否已知，不冒充全绿。 |
| 验收分级与质量门 | 搜打撤/docs/QUICKSTART.md:36 | pointer | 验收分级（纯文档 / A 档删除 / B 档语义各自怎么验）：质量门一张表。 |
| 验收分级与质量门 | 搜打撤/docs/QUICKSTART.md:40 | full | `git commit` 触发门：过了就是 PASS，红灯看门打印的理由，按理由处理，不 `--no-verify` 绕过。 |
| 验收分级与质量门 | 搜打撤/docs/SPEC-PROCESS.md:19 | pointer | 根 AGENTS.md + `docs/quality-gates.md`（验收门）+ 性能三铁律 + 直写红线。 |
| 验收分级与质量门 | 搜打撤/docs/SPEC-PROCESS.md:63 | full | 按质量门选择与改动相称的验收……验收与提交分开，提交须老板明确授权。 |
| 验收分级与质量门 | 搜打撤/docs/SPEC-PROCESS.md:81 | full | 最终判定只能写 `verified / partial / failed`——缺验证不算修好（与 verification 口径一致）。 |
| 验收分级与质量门 | 搜打撤/docs/PARALLEL-DISPATCH-PLAYBOOK.md:31 | full | 改共享文件 / 开长任务动作先行……收官销账；对方半成品在场绝不 build。 |
| 验收分级与质量门 | 搜打撤/docs/AGENT-TOOLBOX.md:3 | pointer | 流程纪律（授权边界、登记、验收分级）以根 AGENTS.md 与 WORKFLOW-TOOLS 为准，不在此重复。 |
| 验收分级与质量门 | 搜打撤/docs/AGENT-TOOLBOX.md:49 | pointer | 新脚本进 `scripts/` 时：在 acceptance-gate `WORKFLOW_TESTS`……或 `EXEMPT_SCRIPTS` 登记，否则 scripts-contract 守卫红。 |
| 验收分级与质量门 | 搜打撤/docs/roadmap.md:9 | full | 以定向测试、类型契约、存档故障样本及当前窗口的实页证据验收改动；公共架构和候选版本按项目质量门做全量检查。 |
| 验收分级与质量门 | 搜打撤/docs/README.md:64 | pointer | 战斗逻辑 / 数值 / 牌效……再看：质量门（验收与全量口径）。 |
| 验收分级与质量门 | 搜打撤/docs/README.md:68 | pointer | 测试 / 验收门｜先看：质量门、开发指南。 |
| 验收分级与质量门 | 搜打撤/docs/README.md:83 | pointer | 工程与质量入口表含：架构、开发指南、存档契约、质量门、性能方法与历史基准、音频系统。 |
| 提交授权 | AGENTS.md:20 | full | 其他会话有未提交改动时不覆盖共享文件、不 build、不顺手提交。 |
| 提交授权 | AGENTS.md:25 | full | 回滚、提交、推送、发布、外部写入须明确指示。……任务完成不自动提交。 |
| 提交授权 | AGENTS.md:26 | full | 打包提交默认（10-01 老板拍板）：老板向任一会话授权提交时，该会话默认负责打包落库当时工作树的全部完成未提交改动。 |
| 提交授权 | 搜打撤/docs/README.md:42 | full | 审查不授权实施……回滚/提交/推送/发布/外部写入仍需明确指示。 |
| 提交授权 | 搜打撤/docs/README.md:50 | full | 收官核对自有 diff……完成未提交时标记归属与未提交路径；禁止顺手提交或清理别人现场。 |
| 提交授权 | 搜打撤/docs/README.md:56 | full | 实际平台可用性、依赖与待验内容仍需当次核对……本入口不构成启服或提交授权。 |
| 提交授权 | 搜打撤/docs/WORKFLOW-TOOLS.md:78 | full | 提交/推送/发布仍需明确授权。……打包提交默认（10-01）：老板授权提交时，受理会话打包落库全部完成未提交改动。 |
| 提交授权 | 搜打撤/docs/quality-gates.md:31 | full | 证据照常落档；删除获批不代表自动提交获批。 |
| 提交授权 | 搜打撤/docs/QUICKSTART.md:41 | full | 提交/推送/发布须老板明确授权；任务完成不自动提交。 |
| 提交授权 | 搜打撤/docs/QUICKSTART.md:42 | full | 打包提交默认：老板授权提交后，受理会话负责打包落库工作树全部完成未提交改动（分组提交、代写缺失文档、台账销账）。 |
| 提交授权 | 搜打撤/docs/SPEC-PROCESS.md:63 | full | 验收与提交分开，提交须老板明确授权，不要求固定"双提交"。 |
| 提交授权 | 搜打撤/docs/PARALLEL-DISPATCH-PLAYBOOK.md:30 | full | 外部属地文件绝不混提（先例：M 批期间 onetake 会话 10 文件绝不代提交）。 |
| 提交授权 | 搜打撤/docs/PARALLEL-DISPATCH-PLAYBOOK.md:33 | full | 提交须老板明确授权。……获得授权后提交前核对整个 index，绝不夹带别人的 staged 内容。 |
| 提交授权 | 搜打撤/docs/AGENT-TOOLBOX.md:43 | full | 硬门只有三处：提交门（staged 检查）、并行属地（他人未提交内容不覆盖）、删除/回滚/发布授权。 |
| 提交授权 | 搜打撤/docs/PENDING.md:6 | full | 提交/回滚/发布等授权仍独立。 |
| 提交授权 | 搜打撤/docs/PARALLEL-REGISTRY.md:6 | full | 完成未提交必须列路径、归属和证据，编辑结束不等于提交获批，其他会话不能覆盖未提交内容。 |
| 删除与回滚报批 | AGENTS.md:24 | full | HEAD 对比优先另读或隔离副本，不擅自回滚共享现场。 |
| 删除与回滚报批 | AGENTS.md:25 | full | 任何删除先列具体路径获同意，清单已获批且范围未变沿用授权……禁用 `git clean`/`git checkout` 清理。 |
| 删除与回滚报批 | 搜打撤/docs/README.md:42 | full | 删除先列具体路径清单，已批清单不重复确认；回滚/提交/推送/发布/外部写入仍需明确指示。 |
| 删除与回滚报批 | 搜打撤/docs/README.md:76 | pointer | 文档增删 / 归档……归档审阅与执行记录（移动或删除前必读）。 |
| 删除与回滚报批 | 搜打撤/docs/README.md:96 | full | 归档审阅与执行记录记录迁移、固定路径和待处理临时资料。移动或删除前复核文件归属与引用。 |
| 删除与回滚报批 | 搜打撤/docs/WORKFLOW-TOOLS.md:82 | full | 现行规范只保留有效办法，日期报告保留来源与未核项；实际移动/删除仍沿项目授权规则。 |
| 删除与回滚报批 | 搜打撤/docs/quality-gates.md:28 | full | A 档删除｜删除先获批；静态三证据 + 定向验证……三证据不全或分类不确定，一律 B 档。 |
| 删除与回滚报批 | 搜打撤/docs/quality-gates.md:31 | full | A 档三证据：①与幸存正本逐字相同或全库零引用……删除获批不代表自动提交获批。 |
| 删除与回滚报批 | 搜打撤/docs/PARALLEL-DISPATCH-PLAYBOOK.md:15 | full | 历史中文路径移除失败不构成手动删除授权，工作树处置先列具体路径获批。 |
| 删除与回滚报批 | 搜打撤/docs/AGENT-TOOLBOX.md:43 | full | 硬门只有三处：……删除/回滚/发布授权。这是并行开发的底线。 |
| 删除与回滚报批 | 搜打撤/docs/AGENT-TOOLBOX.md:45 | full | 低效工具可重写/合并/删除（删除报批清单见 PENDING），不将就。 |
| 删除与回滚报批 | 搜打撤/docs/PENDING.md:6 | full | 删除先列具体路径清单获批；台账仅批准方向而未给清单时补清单，清单已获批且范围未变沿用授权，不重复确认。 |
| 登记与销账 | AGENTS.md:5 | full | 收到任务先做主动作，前置核对不得阻塞启动；核对与登记在主动作后同轮补齐。 |
| 登记与销账 | AGENTS.md:12 | full | 改共享文件/开长任务……动作先行，登记 `搜打撤/docs/PARALLEL-REGISTRY.md` 同轮紧随补齐……收官销账；发现无主改动只记录勿动。 |
| 登记与销账 | AGENTS.md:13 | full | 产生确需老板决策/处置的事项即时登记 `搜打撤/docs/PENDING.md`……拍板结果回写来源。 |
| 登记与销账 | AGENTS.md:17 | full | 免登与免仪式（10-01 合并版）：……占用仅本会话时纯说明类小修与共享台账小额修改一律直接编辑+收官核对，免热点登记、免预览-应用两段式。 |
| 登记与销账 | 搜打撤/docs/README.md:21 | full | PARALLEL-REGISTRY.md｜唯一占用与归属记录；编辑/验收/完成未提交/已交付分开。 |
| 登记与销账 | 搜打撤/docs/README.md:22 | full | PENDING.md｜唯一待决策台账；backlog 归 roadmap，已决记录回写来源。 |
| 登记与销账 | 搜打撤/docs/README.md:43 | full | 共享文件或工作树/端口/后台任务动作先行、登记同轮紧随（10-01 精简）；普通只读短审查免登记。 |
| 登记与销账 | 搜打撤/docs/README.md:44 | full | 免登与免仪式（10-01 合并版，条件见根 AGENTS.md）：……免登记免两段式；多会话并发或长任务照常全套。 |
| 登记与销账 | 搜打撤/docs/README.md:50 | full | 收官核对自有 diff、测试结果、未核实项与服务身份；只停本会话创建的服务，再核对端口。 |
| 登记与销账 | 搜打撤/docs/README.md:52 | full | 自有记录即时更新；已决事项回写来源并移至已决区，编辑占用释放，仍需处置的工作树保留登记。来源不明只记录不动。 |
| 登记与销账 | 搜打撤/docs/README.md:72 | pointer | 并行会话 / 派工｜热点登记、待拍板台账、派工手册。 |
| 登记与销账 | 搜打撤/docs/README.md:85 | pointer | 协作流程｜热点登记（改共享文件/长任务动作先行、登记同轮紧随）、待拍板台账（挂账唯一真源）。 |
| 登记与销账 | 搜打撤/docs/WORKFLOW-TOOLS.md:10 | full | 资源占用与未提交归属｜REGISTRY：开工、释放时各登记一次，进度用任务指针。 |
| 登记与销账 | 搜打撤/docs/WORKFLOW-TOOLS.md:11 | full | 老板尚需拍板的事项｜PENDING；已经授权的不重复挂账。 |
| 登记与销账 | 搜打撤/docs/WORKFLOW-TOOLS.md:16 | full | 旧任务记录保留原位，不批量迁移或补造task.json。 |
| 登记与销账 | 搜打撤/docs/WORKFLOW-TOOLS.md:20 | full | 共享文件或长任务动作先行、登记同轮紧随；需要跨会话跟踪时才创建持久任务。单问与说明小修沿原免登规则。 |
| 登记与销账 | 搜打撤/docs/WORKFLOW-TOOLS.md:33 | full | 只改任务范围；并行任务不交叉……进度变化只更新task.json，更新与关闭需预览时的SHA256。 |
| 登记与销账 | 搜打撤/docs/WORKFLOW-TOOLS.md:70 | full | 对doneWhen逐项确认，在关闭输入里给终态 complete-uncommitted 或 partial、checks、unverified；完成须 doneWhenConfirmed:true。 |
| 登记与销账 | 搜打撤/docs/WORKFLOW-TOOLS.md:78 | full | 只释放自有资源登记，任务记录与验收指针保留。 |
| 登记与销账 | 搜打撤/docs/QUICKSTART.md:17 | full | 多会话在场（占用>1）时改共享文件动作先行、登记 `docs/PARALLEL-REGISTRY.md` 同轮紧随……单会话占用时说明类小修免登记直改。 |
| 登记与销账 | 搜打撤/docs/QUICKSTART.md:23 | full | 确需老板拍板的进 PENDING，不阻塞手头其他事。 |
| 登记与销账 | 搜打撤/docs/QUICKSTART.md:43 | full | 收官：handoff 复核 → 登记行销账（`workflow -- ledger registry close`）→ 证据入 `docs/evidence/<日期>-<任务>/`。 |
| 登记与销账 | 搜打撤/docs/SPEC-PROCESS.md:45 | pointer | 假设与待拍板：<不确定项 → 同步登记 docs/PENDING.md，链接回来> |
| 登记与销账 | 搜打撤/docs/SPEC-PROCESS.md:48 | full | 纪律：确需拍板的事项即时进PENDING，已授权的不重复挂账；规格被老板确认后需求状态改「已确认」。 |
| 登记与销账 | 搜打撤/docs/SPEC-PROCESS.md:63 | full | 共享文件/长任务登记 REGISTRY，实施偏离规格须留 Ruling。 |
| 登记与销账 | 搜打撤/docs/SPEC-PROCESS.md:68 | full | REGISTRY维护占用，PENDING维护待拍板，STATUS和记忆不抄进度。 |
| 登记与销账 | 搜打撤/docs/PARALLEL-DISPATCH-PLAYBOOK.md:13 | full | ZCode 使用当前已授权工作树入口；需要新建时明确基线与属地并登记。 |
| 登记与销账 | 搜打撤/docs/PARALLEL-DISPATCH-PLAYBOOK.md:31 | full | 改共享文件 / 开长任务动作先行，登记 `docs/PARALLEL-REGISTRY.md` 同轮紧随（10-01 精简），收官销账。 |
| 登记与销账 | 搜打撤/docs/PARALLEL-DISPATCH-PLAYBOOK.md:33 | full | 完成未提交时在 REGISTRY 标注具体路径/归属与证据，不在记忆复制占用。 |
| 登记与销账 | 搜打撤/docs/AGENT-TOOLBOX.md:3 | pointer | 流程纪律（授权边界、登记、验收分级）以根 AGENTS.md 与 WORKFLOW-TOOLS 为准。 |
| 登记与销账 | 搜打撤/docs/AGENT-TOOLBOX.md:17 | pointer | 收官 ── workflow task close（需跨会话跟踪时才建任务）；登记销账 |
| 登记与销账 | 搜打撤/docs/AGENT-TOOLBOX.md:34 | pointer | 建跨会话任务台账｜task start/update/close｜单会话小修不需要，见免登规则。 |
| 登记与销账 | 搜打撤/docs/AGENT-TOOLBOX.md:35 | pointer | 老板拍板事项｜PENDING｜唯一真源，拍板即销账。 |
| 登记与销账 | 搜打撤/docs/AGENT-TOOLBOX.md:42 | full | 自助查询类（handoff/impact/code-map/status/memory:discover）：只读、不登记、不阻断，随便用。 |
| 登记与销账 | 搜打撤/docs/AGENT-TOOLBOX.md:44 | full | 免仪式范围：单会话活跃时小额共享台账修改与说明类小修直接做（详见根 AGENTS 10-01 合并版），不必走 task/SHA 两段式。 |
| 登记与销账 | 搜打撤/docs/PENDING.md:4 | full | 任何会话产生「等老板拍板/处置」的事项，即时登记一行（一事一行，注明来源与需要的决定）；拍板后回写来源，将记录移至「已决记录」。 |
| 登记与销账 | 搜打撤/docs/PENDING.md:5 | full | 台账只收等决策/等处置的活账；未排期 backlog、需求想法不入（各归 roadmap / 战役文件）。 |
| 登记与销账 | 搜打撤/docs/PENDING.md:7 | full | 记忆只放指针。事项识别来源/对象/需要的决定以避免重复登记。 |
| 登记与销账 | 搜打撤/docs/PARALLEL-REGISTRY.md:4 | full | 会话改共享文件或开长任务：动作先行，登记行同轮紧随补齐——不缺席、不阻塞启动……单会话活跃时小额共享台账修改可直接编辑+收官核对，免登记免两段式。 |
| 登记与销账 | 搜打撤/docs/PARALLEL-REGISTRY.md:5 | full | 发现无主改动/文件登记到「无主物品」，只记录勿动，等认领或老板处置；认领者把行移入活跃登记。 |
| 登记与销账 | 搜打撤/docs/PARALLEL-REGISTRY.md:6 | full | 本文件是占用登记的唯一真源；记忆只放指针。状态用「编辑中 / 待验收 / 完成未提交 / 已交付」。 |
| 登记与销账 | 搜打撤/docs/PARALLEL-REGISTRY.md:7 | full | 服务登记工作目录/端口/PID/创建会话；收官只停本会话创建且身份确认的服务。完成事项移至已释放。 |
| 端口约定 | AGENTS.md:15 | full | 端口约定：主线 Vite 5200、隔离副本 53xx、产物 preview 8139；记录工作目录/端口/PID/会话，收官只停本会话创建且身份确认的进程，再复核端口；无主进程勿杀。 |
| 端口约定 | 搜打撤/docs/README.md:50 | full | 只停本会话创建的服务，再核对端口。 |
| 端口约定 | 搜打撤/docs/QUICKSTART.md:9 | full | 主线 dev 端口 5200，产物 preview 8139。 |
| 端口约定 | 搜打撤/docs/PARALLEL-REGISTRY.md:7 | full | 服务登记工作目录/端口/PID/创建会话；收官只停本会话创建且身份确认的服务。日期/PID 是记录时点，使用前核实身份。 |
| 端口约定 | 搜打撤/docs/AGENT-TOOLBOX.md:26 | pointer | `code-map/index.html`（5301 端口，可视化）……code-map 为在途会话产物，状态见 REGISTRY。 |
| 端口约定 | 搜打撤/docs/AGENT-TOOLBOX.md:28 | full | 起服（主线 5200 幂等复用）｜`npm run web`｜「拉起网页版」固定指令；详细口径见根 AGENTS。 |
| 端口约定 | 搜打撤/docs/AGENT-TOOLBOX.md:30 | pointer | `scripts/iab-drive.mjs`……默认主线 5200。 |
| 冻结引擎 | AGENTS.md:19 | full | 只开发 `搜打撤` Vite；Godot/Unity/EXE 冻结。 |
| 冻结引擎 | 搜打撤/README.md:3 | full | 开发范围仅为 Vite 网页版，Godot、Unity 和桌面 EXE 冻结。 |
| 冻结引擎 | 搜打撤/docs/WORKFLOW-TOOLS.md:3 | full | 当前只开发搜打撤 Vite。 |
| 冻结引擎 | 搜打撤/docs/QUICKSTART.md:9 | full | 只开发 Vite 版；Godot/Unity/EXE 冻结。 |
| 冻结引擎 | 搜打撤/docs/PARALLEL-DISPATCH-PLAYBOOK.md:13 | pointer | `搜打撤/desktop-app/*` 是打包副本，不是工作树。 |
| 冻结引擎 | 搜打撤/docs/roadmap.md:31 | full | 桌面封装目前冻结；解冻后再为打包增加干净环境验证与发布检查表。 |
| 证据目录 | AGENTS.md:7 | full | 验证优先用 workflow verify 留证，混树暂存先 staged --plan。 |
| 证据目录 | AGENTS.md:8 | full | 同会话复用有效证据；目标文件内容、工作区/属地、任务范围或相关环境变化时重新核对。 |
| 证据目录 | AGENTS.md:14 | full | 验收证据入 `搜打撤/docs/evidence/<日期>-<任务>/`，不散放。 |
| 证据目录 | 搜打撤/docs/README.md:9 | pointer | 流程工具与归档办法统一接手提示、复用检索、台账更新、验收记录、记忆发现、内置浏览器证据和暂存隔离。 |
| 证据目录 | 搜打撤/docs/README.md:40 | full | 同会话记录命令、目标文件状态与环境，内容/属地/范围/环境未变时复用证据；文档提交改变 HEAD 不自动使相同源码的定向证据失效。 |
| 证据目录 | 搜打撤/docs/README.md:51 | full | 验收证据集中 `docs/evidence/<日期>-<任务>/`，记录时间、代码/文档基线、文件状态、命令与结果……历史证据只证明当时范围。 |
| 证据目录 | 搜打撤/docs/README.md:95 | pointer | 验收证据（evidence/README.md）保存报告和测试引用的数据。 |
| 证据目录 | 搜打撤/docs/WORKFLOW-TOOLS.md:9 | full | 任务目标、负责人、涉及路径、完成标准、执行状态、检查指针｜`docs/evidence/<日期>-<任务>/task.json`。 |
| 证据目录 | 搜打撤/docs/WORKFLOW-TOOLS.md:14 | full | 历史与原始证据｜`docs/archive/`、任务证据目录；不抄入当前状态。 |
| 证据目录 | 搜打撤/docs/WORKFLOW-TOOLS.md:62 | full | 代码或环境变化、失败、中断、检查期间代码变化仍使代码证据失效。候选不代替负责人对范围和真实行为的判断。 |
| 证据目录 | 搜打撤/docs/quality-gates.md:29 | full | 相同源码与相关环境已有有效证据可复用，范围/内容/环境变化再验。 |
| 证据目录 | 搜打撤/docs/quality-gates.md:69 | full | 场景报告与过程坑记录落 `docs/evidence/<日期>-<任务>/`；长场景（>60s）在共享树受并行会话 HMR 重载限制。 |
| 证据目录 | 搜打撤/docs/QUICKSTART.md:43 | full | 证据入 `docs/evidence/<日期>-<任务>/`。 |
| 证据目录 | 搜打撤/docs/SPEC-PROCESS.md:67 | full | 特性收官：对照「成功标准」逐条打勾；验收证据入 `docs/evidence/<日期>-<任务>/`。 |
| 证据目录 | 搜打撤/docs/SPEC-PROCESS.md:68 | full | 持久任务执行状态只维护在 `docs/evidence/<日期>-<任务>/task.json`，规格仅保留需求/方案/拆分。 |
| 证据目录 | 搜打撤/docs/PARALLEL-DISPATCH-PLAYBOOK.md:25 | full | 全仓打包前先剔除 evidence/报告类目录（`--ignore`），避免把带日期记录喂进上下文。 |
| 证据目录 | 搜打撤/docs/AGENT-TOOLBOX.md:32 | pointer | 留验证证据（自动报告）｜workflow verify｜详见 WORKFLOW-TOOLS。 |
| 证据目录 | 搜打撤/docs/roadmap.md:13 | full | 按文件内容与环境复用验收证据；先验证规范再立工具任务。 |

## 统计：八个主题 full 表述数

| 主题 | full | pointer | 合计 |
| --- | --- | --- | --- |
| 内置浏览器边界 | 13 | 4 | 17 |
| 验收分级与质量门 | 27 | 9 | 36 |
| 提交授权 | 16 | 0 | 16 |
| 删除与回滚报批 | 11 | 1 | 12 |
| 登记与销账 | 35 | 7 | 42 |
| 端口约定 | 5 | 2 | 7 |
| 冻结引擎 | 5 | 1 | 6 |
| 证据目录 | 15 | 3 | 18 |
| **合计** | **127** | **27** | **154** |

## 扫描判定备注

- `搜打撤/AGENTS.md` 不存在（`ls` 验证：`No such file or directory`）；仓库根级 `AGENTS.md` 存在且被 docs/README.md:18 称为「根 AGENTS.md」，按其扫描。
- `搜打撤/README.md:18` 的「Chromium 105+ / Edge 常青版 / Firefox 121+」是网页版运行环境兼容性要求，非验收工具的内置浏览器边界口径，未录入。
- `AGENT-TOOLBOX.md:26` 的 5301 与 `:30` 的「默认主线 5200」是工具表正文的端口表述（非台账行顺带提及），按「宁可多录」以 pointer 录入。
- `roadmap.md` 与 `PENDING.md`/`PARALLEL-REGISTRY.md` 台账行内的偶然端口/证据提及（5391、8137、5345 等）属会话记录，不在扫描范围或未录入。
