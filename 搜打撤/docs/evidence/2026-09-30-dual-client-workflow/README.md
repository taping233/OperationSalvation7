# 双端流程规范化证据 · 2026-09-30

## 授权与基线

- 老板先指定 Codex / ZCode 同时支持、统一仅内置浏览器、先修流程不改代码，随后批准五步计划「执行」，中断后指示「继续」。
- 基线 HEAD=`fd38468`；本地缓存 origin/master 对比 ahead 24 / behind 0，远端未联网核实。本轮不提交/推送/发布，不改 config、游戏或脚本，不删除产物。
- 初始无主/外部现场：package-lock.json（M）、.codex/、.photolib-acc/、.ui-art-loop-0925/、scripts/iab-drive.mjs、项目近况-2026-09-29/；不修改或认领。
- 本轮没有创建工作树、端口服务或后台进程；未操作历史无主进程。

## 改动与依据

- 根 AGENTS 与 docs/README：按任务接手、事实分层、平台记忆路由、证据复用、授权沿用与收官。
- 质量门/开发/派工：两端各用内置浏览器与当前窗口，停用外部 headless/CDP 验收入口；历史工具不删除，适配归后续。保留 A/B 分级，不修改实际门禁算法。
- STATUS/REGISTRY：用提交核实 U16/U18、CSS、验收分级已入 HEAD，释放过时编辑占用；历史全量结论保留为时点证据。STATUS 原长记录留在历史节，不抹除。
- PENDING：已决条目移已决区；原 #18 未排期 P3 移 roadmap 并回链；#19/#20 保留待决；#21 来源记录对齐，未跟踪脚本仍待处置，不宣称验收完成。
- 真正的 ZCode 项目记忆是 `.zcode/cli/memories/projects/project-9f3e184c77472436/memory/`；`.zcode/memories/` 为历史迁移库。两端只修入口/摘要，近期经验正文保留原路径。
- 六条相关经验以当前口径置顶，旧内容明确标记历史，不执行旧的自动提交、git checkout、headless 或输入域假设。

## 四类场景的双端规范推演

| 场景 | Codex / ZCode 共同行为 | 验收 |
| --- | --- | --- |
| 单问/只读审查 | 定向查证，不自动实施、不全仓扫描、不默认登记短审查 | 来源与结论范围 |
| 小工程文档修改 | Git + 目标归属 + 对应规范；共享文档须登记，免登限既定 ≤10 行条件 | diff/指针/事实/相关守卫；免游戏全量与 build |
| 语义 UI 修改 | 按页读取、登记必要资源、当前平台内置浏览器与当前窗口 | 定向 + 实页；代码收尾落库前全量；合成事件不当 hover 证明 |
| 公共架构修改 | 完整接手、明确属地与依赖、稳定验证环境 | 定向/架构守卫 + 全量 + 实页；提交仍需授权 |

这是规则与入口的文档推演，不是四次真实修改。Codex 项目 AGENTS 在老板「继续」消息前已重新注入，全局规则也在 11 文件更新后收到新的 AGENTS 注入，均与本轮修改一致；已注入内容以当次消息为准。ZCode 新会话的实际注入/真实浏览器演练未执行，不能据文件更新宣称通过。

## 验证与限制

- 文档守卫：`node node_modules/vitest/vitest.mjs run tests/docs-consistency.test.js --reporter=dot`，1 文件 / 2 例通过，EXIT=0；运行于搜打撤目录，没有触发 pretest。
- 记忆与规则：11 文件唯一定位预览、时间戳备份、写后回读通过；[修改清单](memory-changes.json) 记录前后 SHA256 与备份路径，[回读核对](memory-verification.json) 11 文件 / 0 不一致。项目记忆索引 11,554 bytes，低于原 13KiB 改造阈值。
- handoff：`npm run handoff` EXIT=0；收官后以其同一底层入口 `node scripts/handoff-brief.mjs` 再核对，活跃 2 条 / 无主 2 条 / 活账 15 条。本轮编辑占用已释放、未提交归属留在已释放表，U16/U18/CSS 原占用不再列活跃；见 [handoff](handoff.txt)。
- 门禁计划：`node scripts/acceptance-gate.mjs --paths docs/README.md docs/quality-gates.md docs/PENDING.md --plan` 返回 skip / 没有验收门路径变更；仅确认工程文档路径不触发游戏验收门，未修改脚本，也不把 skip 当游戏测试通过。
- 沙箱环境初跑 handoff 的 git 子进程被 EPERM 阻断，经已有任务范围内的权限复跑通过；未改变项目环境或配置。一次门禁计划从父目录误调用后改为搜打撤目录运行，无文件副作用。
- 不复跑游戏全量或 build；本轮只改工程流程文档/记忆。上一轮架构边界、契约、文档守卫 3 文件/39 例仅作为当时旁证。
- 内置浏览器此前库存没有游戏标签页；本轮不为工程文档验收启动游戏服务或干扰其他会话。游戏实页/留言未核验。
- 后续工具工作：内置浏览器快照/驱动适配、handoff 滞后条目/失效指针提示、证据复用辅助；见 roadmap，本轮不实现。
- 最终 `git diff --check` EXIT=0；现有 tracked 改动中本轮范围为根 AGENTS + 8 个 docs 文件，新增证据仅在本目录。HEAD 仍为 fd38468；游戏/脚本/package.json/config 无本轮写入，无主现场保留。全局规则/记忆备份在各源文件同目录，未把含个人历史的备份正文放入项目证据。
