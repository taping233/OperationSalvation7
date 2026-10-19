# Stryker 查询依赖最小安全修补

新增 Stryker 10 引入 typed-rest-client 2.3.1，其精确锁定 qs 6.15.1；顶层 qs 6.16.0 一直存在，但不能保护嵌套旧副本。采用仅限 @stryker-mutator/core 的 overrides，将 client 固定为其声明 ~2.3.0 范围内的 2.3.0；该版允许 qs ^6.14.1，锁实际复用 6.16.0。官方 npm 两版包逐文件比较只有 package.json 不同，运行 JS 与类型源码完全一致。未使用 audit fix 或整体升级。

官方公告：
- https://github.com/advisories/GHSA-q8mj-m7cp-5q26 ：逗号序列化 null，6.15.2 修复。
- https://github.com/advisories/GHSA-x5fp-wj9c-mxmx ：数组限制绕过，6.16.0 修复。
- https://github.com/advisories/GHSA-4mjr-xmp4-gh2g ：isBuffer 拒绝服务，6.16.0 修复。

新 Node 回归通过实际 Stryker→client 解析 qs，验证版本、null/undefined、数组限制、恶意 isBuffer、正常查询及 REST client getUrl；6 项通过，与现有工具测试合并 13 项通过。npm ci、types、lint 通过；stylelint 0 错误、5 个既存原始字号 token 审查警告。

npm audit 从 11 项降至 9 项，qs 与 typed-rest-client 告警移除。仍有 1 moderate / 6 high / 2 critical：直接开发依赖 vitest、stylelint；传递开发依赖 @vitest/mocker、tinypool、source-map-js、braces、micromatch、fast-glob、globby。全部属开发工具链，不等于没有开发/CI 风险。braces 官方公告 https://github.com/advisories/GHSA-vfj7-8cjw-p6xm 在核查时没有修复版本，stylelint 链不能靠兼容补丁消除；未采用 audit 建议的跨大版本回退。剩余问题未宣称已修复。

本目录保存真实修补后 audit、锁变更与执行日志；Node 24.19/npm 11.9，远端 CI Node 22 结果另验。
