# 单张美术接入流程改进

老板授权实现复盘结论：参数化皮肤导入、分开目标/全局资产结果、保留子命令退出码、当前内置浏览器一次取证，并回填上轮皮肤收官与平台记忆。现行使用方式唯一入口为[美术接入工具](../../art-workflow-tools.md)。没有修改皮肤画面或存档业务规则，不安装依赖、不改全局配置、不提交。

已实现：`tools/skin-import.py`、`tools/art-check.mjs`、`tools/browser-evidence.mjs`及`asset-audit --scope selected`；旧全局审计默认行为保留。导入前预检，阶段回执支持同请求续跑；冲突拒绝覆盖，文本备份仅在项目`.tmp/skin-import/`。命令链无shell，逐步保留退出码，失败不执行后续测试。浏览器助手仅接收当前CUA tab，不创建浏览器、不改变页面或视口，先保存截图，采集失败记inconclusive。

验证：Vitest两个专属文件24项通过，Python导入契约5项通过，覆盖全局门不被弱化、空/缺失目标拒绝、失败退出码与后续不执行、截图先保存及断连保留、路径逃逸拒绝、导入预览无写入、同请求幂等、中途续跑和冲突保护。ESLint通过；文档守卫563条相对链接通过。真实源图从项目外cwd运行导入预览通过，没有新建候选或修改运行图。

实际皮肤目标检查见[skin-check.json](skin-check.json)，目标通过、全局95项范围外错误及617项历史警告分开记录；此为检查时点，不代表现行全局状态。取证助手在当前Codex内置浏览器直接查看已接入WebP，单次保存[截图](capture-smoke.png)及[来源与加载记录](capture-smoke.json)，图片1659×948加载完整、error空；此为静态素材页取证工具实测，不冒充人物操作路径验证。人物页面沿用上轮真实输入证据，不重复进入游戏。未build、未全量测试、未提交，未创建服务。

记忆正文见[memory-entry.md](memory-entry.md)，已获执行权限后写入Codex的MEMORY.md与memory_summary.md，原文件各有时间戳备份；`workflow memory --source codex --query "皮肤接入 退出码" --limit 1 --json`成功命中本主题。项目现行状态仍归docs，未写入AGENTS或增加规则预算。
