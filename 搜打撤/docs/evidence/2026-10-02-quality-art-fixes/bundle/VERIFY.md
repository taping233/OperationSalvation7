# 第六/七部分工程修复：仅本任务增量

基线为 2026-10-02 本地任务开始时的工作树，HEAD `c6ee20684056240fd219fe179cacf5204a6445a4`。该工作树已有其他会话未提交修改；本补丁比较任务前文件与任务后文件，不是 HEAD diff，也不包含整个工作树。原始审查快照是上海时间 14:30，应用前必须先核对 SHA256。仅用于父会话的独立复核副本，不能覆盖原始快照。

`preconditions.json` 列出前后原始/归一化 SHA256、基线来源和新增文件；跨平台仅把 CRLF 转为 LF 后比较。`workflow.mjs` 的一行 `freshness` 调用未在编辑前单独保存原始字节，已按先前工具输出还原这一处改动，明确不宣称其原始字节 SHA 已捕获；其完整归一化前置指纹和微小差异仍可核对。其余前置文件均在各自编辑前保存。`new-files.txt` 列 7 个新增源/规范文件。台账、task、其他会话证据和素材二进制不在补丁内；NAI 厚涂配方原字节保持一致。

从解压目录，在隔离副本检查（默认不写入）或明确应用：

```sh
python3 apply_to_isolated.py --root /absolute/isolated/repository
python3 apply_to_isolated.py --root /absolute/isolated/repository --apply
```

前置不符就停止，先比较已更新的文件，禁止整文件替换、重设基线或打包其他会话内容。补丁已在独立任务前文件副本通过 `git apply --check`。

Windows 本地已通过语法 296 文件、数据校验、8 组类型配置、游戏/工具/配置 lint、文档守卫（346 链接）、图鉴 11 项并按既有入口再生成。NAI 标准库离线测试 14 项通过，覆盖多个进程抢剩余额度、45 秒节流、共享 429 冷却、坏状态、请求中断、保存失败和字面 argv。最终跨线集成详情见 `evidence/final-targeted-report.json` 与日志；此前失败报告在本地保留，原因是两处旧 fixture 缺新依赖/断言，已修正。

Linux 复核在隔离副本的 `搜打撤` 目录进行，复用已安装依赖，不安装、不访问 NAI 网络或凭证：

```sh
npm run test:target -- tests/workflow-gate-receipt.test.js tests/workflow-staged.test.js tests/quality-config.test.js tests/acceptance-gate.test.js tests/asset-audit.test.js tests/workflow-scope.test.js tests/workflow-cli-integration.test.js tests/workflow-dependencies.test.js tests/compendium.test.js
python3 -B -m unittest discover -s tools/tests -p 'test_nai*.py' -v
node scripts/asset-audit.cjs --check
npm run check:syntax
npm run validate:data
npm run lint
npm run typecheck
sh -n .githooks/pre-commit
```

Windows 10 项真实文件 symlink 回归因 EPERM 跳过，Linux 必须实际执行，核对标准 `.bin` 复制摘要相等以及链接文本、目标字节、执行位变化失效，越界/悬空/循环/目录/链式拒绝。Linux 还需验证 Python `flock` 和目录 `fsync` 分支；本地没有宣称这些已通过。不要在实际仓库 stage 或运行钩子提交来复核；full/staged 执行顺序与失败阻断由临时 fixture 测试验证。

实际资产增量门为 0 errors、1162 unchanged historical warnings（1125 未登记、33 幽灵、4 授权待核实）；完整债文件在补丁里，禁止自动重新生成以接纳新债。87 条 bytes 更新和 4 个已有照相馆文件登记仅记录可见字节/hash及已有文档所述参数，未伪造授权。未运行完整游戏套件、build、游戏实页、真实 NAI API、真实 PIL 出图或远端 CI；本任务没有提交、推送、发布或删除项目文件。
