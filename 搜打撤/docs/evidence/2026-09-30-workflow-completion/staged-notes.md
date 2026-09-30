# Git index 隔离验收补齐

- 2026-09-30 18:36（UTC+8）；子任务独占 `scripts/workflow-staged.mjs`、`tests/workflow-staged.test.js`。
- 公共接口：`stagedPlan(root)` 只读；`await runStaged(root, { task, date, json?, keepSnapshot? })`。
- 计划记录暂存清单、项目外暂存路径、index SHA-256、依赖版本/锁证据、阻断原因、限制。
- 冻结 index 到本次 `sdt-staged-*` temp，按冻结记录的对象 ID 用 `git cat-file --batch` 导出原始 blob；不使用工作树字节、checkout filter、未暂存 `.gitattributes`。
- 拒绝冲突阶段、symlink/gitlink、被跟踪的 node_modules 和 NODE_OPTIONS 外部预加载环境。
- 暂存 package.json 声明须与暂存锁根一致；适用依赖逐项核对 hidden installed lock 的版本、integrity、resolved 和实际 package.json 版本；缺失、额外包、链接包、不匹配均阻断，无安装回退。
- 将已安装依赖独立复制到 temp，避免检查缓存写回共享 node_modules；配置、测试、gate 全部采用 index 版。
- 在快照 cwd 调用现有 `planForPaths`；quick 使用真实暂存路径；full/删除/重命名使用 gate 自身路径触发既有完整测试；skip 明确未执行，不称通过。
- 源 index 前后核对；暂存文件若被检查过程改写，结果 invalidated，不能冒充原 index 验收。
- 执行日志与 JSON 写入调用者 `docs/evidence/<date>-<task>/`；失败/阻断/skip 都明确保存。默认仅清理本次 temp，先核对绝对路径及父目录。
- Windows Node `rmSync` 曾静默留目录，已增加删除结果复核及同一 shell 的 PowerShell `Remove-Item -LiteralPath` 自有 temp 兜底；清理失败写报告并失败退出。

## 验证

- `node node_modules/vitest/vitest.mjs run tests/workflow-staged.test.js --reporter=dot`：9/9 通过，18:38:14 开始，16.59s。
- `node node_modules/eslint/bin/eslint.js scripts/workflow-staged.mjs tests/workflow-staged.test.js`：exit 0。
- 覆盖 staged/working 内容不同、未跟踪排除、index 无副作用、删除/重命名、链接拒绝、依赖不匹配、失败/信号终止证据、快照改写、运行中 index 改动、skip。
- 全部 Git 写操作在自有 fixture 中；未对真实仓库 add/commit/build/install。
- 真实只读计划：无暂存，mode skip；当时已安装依赖元数据与 index 锁相符；installed-lock SHA-256 `02a7c32d364d73b59736aedeef2c528962f2abdf9e68a528ce6ab22d9b43f09b`，Node v24.13.0。

## 限制

- 当前没有真实暂存内容，因此未宣称真实代码通过隔离全套；没有改动真实 index 来制造验收条件。
- deps 的匹配证明基于锁及包版本元数据，不能证明每个依赖代码字节没有本地篡改。
- 临时副本没有 `.git`，依赖真实 Git 现场的测试会保守失败；项目外暂存路径列出但不属于 Vite gate 的验收范围。
- 只提供本地 gate 结果，没有 build、浏览器或远端 CI 验收；原 gate 若有缺陷，采用其 index 版会保持失败，不能偷偷带入工作树修正。
