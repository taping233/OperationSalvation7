# 项目约束

- 验证与检测流程应优先使用 Codex 内置服务器或内置工具；仅当内置能力无法完成必要验证时，才尽量少量使用外部浏览器。
- Godot 版已冻结，不再作为当前开发主线；项目当前主线为 Vite 版。
- 接手本项目必读交接文档：`搜打撤/docs/NEXT-AI-HANDOFF-2026-09-20.md`（工作区未提交改动盘点、铁律、验证口径、待老板拍板清单；2026-09-20 项目移交时整理）。

## 省 token 工作口径（2026-09-22 老板令固化）

1. 读文件：>300 行禁止整读——先 grep 定位行号再 offset/limit 读片段。
   battle.view.js / cards.js / game.hub.js 等千行文件尤其如此。
2. 跑测试：默认只跑改动相关用例 `npx vitest run <关键词>`，例如：
   - 改 combat.js → `vitest run combat effect-verbs battle`
   - 改 cards.js → `vitest run cards hero-cards card-art-coverage snapshot-guard`
   - 改 CSS/纯文案/纯图片 → 不跑测试，实机截图验收
   全量 `vitest run --no-file-parallelism` 仅限：收尾落库前，或改了
   effect-steps/architecture/公共层。输出加 --reporter=dot 或 head/tail 截取，
   不吞全量堆栈。
3. git：status/diff 一律 --short；看改动用 diff --stat 或指定文件，
   禁全仓裸 diff（core.quotepath false 已配置，消中文转义）。
4. 先 grep 再读；已查证的事不重复验证；结论绑定行号/哈希不复述过程。
