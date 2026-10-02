# 素材与历史生图文档修复验证

2026-10-02，本地 Windows / PowerShell，基线 HEAD `c6ee206840`。集成主会话已运行 handoff、保存此前工作树；本线仅修改派工属地，未覆盖此前未提交文件，没有 build、提交、推送、删除、网络或凭证读取。

产物：根 `NovelAI生图功能手册-AI接手版.md`、`scripts/asset-audit.cjs`、`scripts/asset-audit-lib.cjs`、`tests/asset-audit.test.js`、`game/assets/asset-manifest.json`、`docs/asset-audit-debt.md`、`docs/asset-audit-debt.json`。

已通过：两 CJS 脚本 `node --check`；定向 ESLint；`git diff --check`；真实 `node scripts/asset-audit.cjs --check` 返回 0，1125 unlisted + 33 ghost + 4 license-pending = 1162 未变历史警告。冻结清单 265030 字节，不含新授权结论。

回归命令：`node node_modules/vitest/vitest.mjs run tests/asset-audit.test.js --reporter=dot`，14/14 通过。初次沙盒因 esbuild spawn EPERM 无法启动，经自动审核授权运行后测试发现一处 Vite URL 重写问题，改为 cwd 文件路径后通过。覆盖新债失败、选中历史债阻断、同字节数内容变化、null/空/未登记 license、正确新登记、bytes/ext/hash、重复/归一化/大小写冲突、不安全路径、损坏 JSON、ghost 变更及真实 CLI 的只读行为。测试临时目录留在系统 temp，不删除现场文件。

manifest 核验仅刷新 87 项实际 bytes，并补 4 个已有照相馆 webp 的观察 bytes/hash 和既有文档记载的日期/model/seed；授权均明确未核实。未反推生成参数、未核验原始输出，原有 license 声明未重新确认。

集成接口：对非 skip 门调用 `node scripts/asset-audit.cjs --check --paths-json JSON.stringify(plan.paths)`，必须直接 spawn 参数数组。该检查全读 `game/assets/`（运行资产字节、manifest）和冻结债务 JSON；receipt 需锁整个资产 inventory、债清单与两个审计脚本。纯资产计划也须执行，不得仍 skip。

未运行：Linux 实机（请云端复核路径/字节指纹一致）；全量 build/游戏实页（内部工具改动，且共享树含前会话未完成改动）；商业授权核验（资料未给足）。无剩余实现阻塞。
