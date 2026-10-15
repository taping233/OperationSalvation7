# LeanToken 与 SmokingGun 游戏源码试用

结论：两款 CLI 在当前 Windows 环境可运行。LeanToken 可按预算摘取代码，但本次宽查询遗漏关键实现，暂不替代 rg；SmokingGun 可筛出复杂度候选，已抽查结果未确认值得修改的性能问题。没有测得游戏帧率、加载时间或跑局吞吐改善，不默认接入 MCP，也不改游戏源码。

## 范围与环境

- 老板授权：试用 LeanToken、SmokingGun，评估对代号柒的实际帮助。
- 日期：2026-10-14；HEAD `3d02437e4c3cf6fb4a55f8a05b409932ec35daae`；源码来自当时包含其他会话未提交内容的工作树，非纯 HEAD 基准。
- Windows x64，Node v24.13.0；LeanToken 0.1.28，SmokingGun 5.0.0。npm 临时缓存安装，后续直接运行缓存 CLI；测量不含首次下载及 npx 启动耗时。
- LeanToken 仅索引 `game/src/**`、`game/tools/**`、`tests/**`；SQLite 留在 `node_modules/.cache/agent-tools-trial/`。SmokingGun 扫描 `game/src`。没有执行游戏、构建、自动跑局或启动浏览器/端口服务。
- 未修改 package.json、锁文件、MCP/config.toml；本轮写入只有工具缓存、本证据和自有登记行。其他会话源码仅读取。

## LeanToken

首次索引 814 文件、6,827,259 字节，用时 6.952 秒；806 文件结构解析完整，8 个 JSON/TXT/PowerShell 文件无结构解析。每次 context 源码预算 1,800 tokens，完整响应上限 4,200 tokens，使用 o200k_base 与 compact 格式。

| 实际任务（原文命令见 metrics） | 用时 | 源码 / 完整响应 tokens | 核对结果 |
| --- | ---: | ---: | --- |
| 基地草稿提交、localStorage 写失败 | 1.222 秒 | 210 / 576 | 命中 base-mutation.js 与失败测试；漏 base.js 实际持久化实现 |
| 地图调度、全屏覆盖停画 | 1.380 秒 | 685 / 1,409 | 命中 render-scheduler.js 部分；漏 game.boot.js 的覆盖判定，混入测试 rAF 桩及无关 render/map 名称 |
| Agent observe、动作、settleSignature 失效 | 1.271 秒 | 1,778 / 2,642 | 命中 agent.state.js 与 agent.runner.js，含 act 后 bustSigCache；漏 agent.surface.js 动作扫描来源，存在无关片段与重复覆盖区间 |
| 指定两个基地文件后再查 | 1.271 秒 | 1,542 / 2,153 | 返回两文件；base.js 片段从 save 尾部开始，仍未包含 setItem 与并发写入基线守卫 |
| 指定 boot 与 scheduler 后再查 | 1.259 秒 | 1,764 / 2,403 | 返回 scheduler 全文和 boot 主循环前半；boot 片段止于 480 行，仍漏 518 行 covered 计算及 557 行 shouldDraw 调用 |
| 纯中文：地图被全屏页面覆盖时如何暂停绘制，关闭页面后如何恢复 | 1.106 秒 | 0 / 232 | 没有返回代码片段 |

同范围原生 rg 文件定位使用明确符号查询，不预给目标路径，用时分别 0.078、0.074、0.080 秒，返回 946、408、270 字节的文件列表；均含上述漏掉的实现文件。另记录已知文件内的定向 rg 行查询。rg 只返回路径/匹配行，LeanToken 返回源码片段，时间与输出量不代表同等完整的任务完成成本。

前三次宽查询共返回 4,627 tokens。工具 savings 自报以相关文件全文的 51,474 tokens 为基线，估算净省 46,847 tokens（约 91%）；这不是与我们现有 rg 加片段读取流程的真实节省率。它未评估片段相关性、遗漏、任务完成和原生工具费用。本轮不能据此宣称省 91% 或省某个比例的模型费用。

全部查询有工作树路径发现超 512 条的警告；索引覆盖 814 文件与 Git 变更路径发现是不同边界。不能用于本轮混合工作树的完整变更审查。英文任务也包含 commitBaseMutation/settleSignature 等已知符号，结果不代表无提示自然语言检索能力。

建议：已知目标文件时可试 outline/read 与精确范围读取；复杂链路先用 rg/impact 定位所有权，再补片段。本轮没有证明广域 context 比现有流程更快、更完整或更省成本。

## SmokingGun

CLI 端到端用时 7.452 秒（扫描内部 5.938 秒）。分析 357 文件：353 JavaScript、4 TypeScript；不同于 LeanToken 索引范围，不直接比较文件数。结构与 tree-sitter 覆盖完整，TypeScript 语义上下文达到每类上限，且未捕获完整项目配置/标准库，因此语义覆盖为 partial。共 427 条候选，本轮上限输出 80 条；80 条不是全部问题，也不是已确认缺陷。

| 抽查位置 | 工具发现 | 当前源码核对与行动判断 |
| --- | --- | --- |
| core/characters.js:23、32 | high：循环内 sort | 旧进度迁移，第一处最多两元素；第二处为五角色的有限别名集合。确有排序，但没有证据支持优化优先级 |
| run/map-generator.js:118、120、125、242 | high：循环内 sort | 每层节点目标 7/12/17/17；前三处为 fire/shop 两类保底，242 行循环有 guard<24 边界。不能因理论复杂度直接移动排序，循环中节点类型会变化 |
| core/renderer.js:196 | high：循环内 sort | 仅 `[aKey,bKey]` 两元素排序，用于无向边去重；有限输入，不是大集合排序热点 |
| agent/agent.policy.js:157 | medium：循环内 find | 选牌列表内查动作；已有 tried 跳过，首次有效动作即 return。可能有重复线性扫描，但并非每次完整笛卡尔遍历；没有运行频率与耗时证据 |
| battle/bag/battle.bag.js:188、201 | medium：嵌套循环/重复扫描 | 分别是操作内逐敌伤害、获取职业能力卡时过滤卡库；需要保持多目标效果和随机池语义，不能机械套 Set/缓存 |

本次抽查 5 组位置是为了验证告警解释，不是随机样本，不推算整体误报率。告警描述多数符合代码形态，但严重等级没有体现小集合、执行频率与业务必要性；尚未确认性能缺陷或新修复。尤其不能把 427 条候选当成 427 个 bug。

建议：作为具体性能调查的离线候选扫描器，缩小至相关模块后人工核对并结合现有 perfProbe。当前不加入日常质量门，不按 high 自动改源码。

## 复现与产物

原始输出、CLI 调用参数、退出码、耗时与字节数保存在本目录 `raw/`。`artifact-manifest.json` 记录这些文件 SHA256，以及核对源码的读取时点 SHA256；源码哈希是本次证据身份，不代表其他会话在整个试用期间未修改源码。

试用入口可用 `npx --yes leantoken@0.1.28 --help`、`npx --yes --package=smokinggun@5.0.0 -- smokinggun --help`。实际实验执行器保存在 `raw/run.mjs`，其中可执行文件从本机缓存列表选择，跨机器复现需改为本机安装路径。所有扫描和检索参数见对应 metrics；未运行 setup/remove/upgrade。

缓存、SQLite 和 npm 包留在本地供复用；没有清理其他会话资源，没有全局配置变更，没有提交或推送。后续未验证：outline/read 实际收益、真实完整任务 token 成本、长期混树新鲜度、性能实页及优化前后比较。

试验缓存文件总计约 80.3 MiB（含 SQLite 及其辅助文件，不含 npm 包缓存）；归档的 39 份原始文件合计 160,095 字节。文档检查退出码 0、无 findings；该检查跳过 evidence，证据文件另外按 manifest 核对存在性、大小与 SHA256。本轮没有游戏改动，不要求游戏实页验收。
