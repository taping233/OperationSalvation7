# 素材审计排除 Git 控制文件

2026-10-13。将 `scripts/asset-audit-lib.cjs` 的共用非资产谓词加入 basename 恰为 `.gitignore` 的文件，使完整扫描和 `selectedAssetPaths` 一致排除 Git 忽略规则。`tests/asset-audit.test.js` 新增嵌套 `.gitignore` 与相邻 `new.webp` 的回归用例，确认仅图片报 `unlisted`，定向选择 `.gitignore` 不产生资产路径。未修改素材、清单及其他未登记项。

验证结果：

- `npm run assets:audit -- --check`：退出 1；全树 errors 由 276 降至 273，623 未变历史 warnings；剩余 273 项均为 `unlisted`。此命令的全局退出 1 由范围外登记缺口造成。
- `npx vitest run tests/asset-audit.test.js --reporter=dot`：沙箱内两次在读取 Vitest 自身 `node_modules/vitest/dist/spy.js` 时遇 `EPERM`，无测试执行；在获准的沙箱外运行后，15 过、1 败，退出 1。唯一失败是原有“仓库 CLI 必须 0 errors”断言，当前全树有 273 项未登记；新回归用例通过。
- `npx vitest run tests/asset-audit.test.js --testNamePattern 'ignores nested Git control files' --reporter=dot`：沙箱外退出 0，新回归用例 1 过、其余 15 跳过。
- `npx eslint scripts/asset-audit-lib.cjs tests/asset-audit.test.js`：退出 0。
- `node --check scripts/asset-audit-lib.cjs`、`node --check tests/asset-audit.test.js`：均退出 0。
- `git diff --check -- scripts/asset-audit-lib.cjs tests/asset-audit.test.js`：退出 0。
