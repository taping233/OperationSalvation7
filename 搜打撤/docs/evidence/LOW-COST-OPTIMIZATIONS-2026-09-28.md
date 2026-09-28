# 低成本优化与验证 · 2026-09-28

记录时间：2026-09-28 19:53 +08:00。范围仅为 `搜打撤` Vite。实时本地 `master` HEAD `2cef754`（16:39 +08:00），相对本地 `origin/master` ahead 14 / behind 0；未 fetch，远端实时状态未核实。共享工作树仍有其他会话的未提交源码、测试与文档；本轮未提交、推送或在共享工作树构建。

## 照相馆选片台

- `game/src/hub/game.cardslib.page.js` 的筛选/排序重绘现在要求刷新选片台，即使选中卡 ID 不变，也重算位置和上一片/下一片状态。一般焦点切换仍只在选中卡变化时重建预览；懒挂载范围不变。
- `tests/boot.test.js` 增加同卡换序、搜索后位置及导航禁用态断言。定向 `npx vitest run tests/boot.test.js --no-file-parallelism`：14 项通过；目标 ESLint、`node --check` 与 `git diff --check` 通过。首次沙箱测试因 esbuild `spawn EPERM` 未进入测试，获准对同一命令重试后通过。
- 隔离生产产物在 Codex 内置浏览器当前窗口、`127.0.0.1:5311` 验证：同一张“禁咒I”改按名称排序后位置为 108/271；搜索后为 1/4，上一片禁用、下一片可用；下一片到“禁咒II”2/4，再返回“禁咒I”1/4，位置和按钮态正确。此轮为当前窗口实页观察，未保存截图，未做多尺寸或长局验收。

## 字体候选

两份 HarmonyOS Sans TTF 共 16,420,124 字节，Regular 仍在首屏 preload。项目随附 `game/assets/fonts/LICENSE-HarmonyOS-Sans.txt` 第 2 条明确禁止修改字体及其组件；TTF 转 WOFF2 因此未执行，也未替换、删除原字体或改 CSS/HTML。若后续优化首屏字体，须先找到许可覆盖的官方替代格式，或重新决定采用其他有完整字形覆盖且视觉可接受的字体。旧资源审计中的 6–9 MB 是转换前的字节推算，不是本轮实测收益。

## 隔离构建与未验证边界

- 在 `D:\素材\代号柒\_tmp-round6-validation-snapshot\搜打撤` 复制当前必要 Vite 源码、资产、配置和依赖，输出仅到快照中的 `desktop-app/game-round6-validation`。快照时照相馆源码和测试与共享源 SHA-256 一致；未复制旧构建、Agent `output/`、备份或文档目录。
- 沙箱内首次构建因 esbuild `spawn EPERM` 未进入 Vite；对同一隔离快照获准重试后 `npm run build` 成功。前置 narrative/data 校验通过，Vite 转换 988 模块；postbuild 预算 PASS：startup 6/40、package 85.52 MiB、duplicates 0.62 MiB、entry gzip 260.1 KiB、initial JS gzip 303.5 KiB、battle gzip 34.4 KiB、narrative gzip 31.0 KiB、CSS gzip 125.5 KiB。Vite 报告压缩前入口 chunk 800.66 KiB 超过通用 500 KiB 提示线，预算仍通过。[完整构建日志](refactor-2026-09-28/round6-isolated-build.log)已复制到证据目录，SHA-256 `15c89dc32e19c4b3214f3f3fdf1582b4b4cf9f30e1be5776f9db1bc7d9f38fa2`。
- 老板随后明确“研究所不用验证”；研究所实页操作立即停止，未建立结题结论。20:17 收尾时预览服务已停止，隔离快照在日志留证后清理；没有继续检查研究所。

本页只记录本轮结果；历史重构轮次的测试数字和已归档产物不代表当前源码的其他未测路径。
