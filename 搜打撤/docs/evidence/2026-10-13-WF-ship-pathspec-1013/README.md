# workflow ship 大批路径输入修复（2026-10-13）

老板要求提交全部完成未提交成果。原 `workflow ship` 两笔候选各约 20 万字符路径参数，Windows 命令行无法安全直接传入。`scripts/workflow-ship.mjs` 现用 Git `--pathspec-from-file=- --pathspec-file-nul` 从 stdin 读取 NUL 分隔、`:(literal)` 前缀的已审路径，替换 `git add` 和 `git commit --only` 的超长 argv；计划、index 并发守卫、commit hook 和冻结 receipt 流程保持原语义。

`tests/workflow-ship.test.js` 新增 >32K 字符路径、中文/空格/`[1]` 字面路径和代码后文档两笔提交夹具；原有钩子失败保留现场与并发 index 守卫仍在。定向契约 16/16 通过；ESLint、语法、`git diff --check` 退出 0。所有提交测试在临时隔离仓库运行，本任务没有暂存或提交主仓库。原本被否决/在途/待决路径的归属仍须由打包任务审查，不因本工具修复自动进入候选。
