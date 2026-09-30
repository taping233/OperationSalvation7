# 动态记忆入口子任务

2026-09-30，归属 WF-workflow-completion。只改 `scripts/workflow-memory.mjs`、`tests/workflow-memory.test.js` 和本记录；共享命令/台账/路由由主会话集成。未修改全局配置、记忆正文、游戏、提交或构建产物。

## 实现

- `discoverMemory(root, options)` 只读返回入口与路径匹配证据，选项为 `home`、`codexHome`、`zcodeHome`、`repositoryRoot`、`env`。
- 默认当前仓库由 root 向上找 `.git`；Codex 来源为显式 codexHome / CODEX_HOME / USERPROFILE（或 HOME）下 `.codex`。显式 home 表示换机根，覆盖环境的默认 home 和 CODEX_HOME；另传 codexHome 可覆盖。
- Codex 只读 `memory_summary.md` 前 16KiB，输出同目录 MEMORY.md 指针，不自动读取详细正文或注入记忆。
- ZCode 枚举当前 `.zcode/cli/memories/projects/` 最多 100 个目录，每个只读 `memory/MEMORY.md` 前 16KiB 和已知 `project.json`/`metadata.json` 的 cwd/projectPath/workspacePath/repositoryRoot/rootPath 标识。精确仓库路径按目录边界匹配；名称与哈希不作为匹配事实。
- 多个匹配为 ambiguous；扫描截断、目录上限、索引不可读为 review-required；这两类都不自动选中。没有匹配返回候选路径与原因。
- 不沿符号链接读取项目外的记忆。旧 `.zcode/memories/` 仅返回历史入口，usableAsCurrent 固定 false。输出没有索引/主题正文。

## 验证

- `node --check scripts/workflow-memory.mjs` 通过。
- `node node_modules/vitest/vitest.mjs run tests/workflow-memory.test.js --reporter=dot`：最终 9/9 通过（1.39s）。默认沙箱启动 esbuild 返回 spawn EPERM，限定该定向测试提权后执行通过。
- `node node_modules/eslint/bin/eslint.js scripts/workflow-memory.mjs tests/workflow-memory.test.js` 通过。
- 测试包含换机 USERPROFILE、显式 home/CODEX_HOME、哈希变化、Windows 大小写/分隔符、代号柒与代号柒2边界、重复候选、无候选、旧迁移库不可替代、元数据匹配、上层仓库识别、限长不读取主题、目录上限与不可读索引。
- 本机只读调用确认仓库 D:\素材\代号柒，Codex summary 可达且含精确项目路径；ZCode 唯一匹配当前 project-9f3e184c77472436。该哈希仅为本机执行结果，未写入发现算法；旧库存在但不可代替。

## 限制

索引提到精确路径不证明该库就是唯一正确的语义归属，输出仍是按需检索入口。扫描上限用于避免全盘读取其他项目；限长/不可读时明确需要人工确认。换机后索引仍写旧工作路径时不会凭名称猜测新项目，要通过可验证路径标识明确迁移或人工确认。记忆中的旧授权和旧状态不成为当前许可或项目实况。
