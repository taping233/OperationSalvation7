# 工程自测断言更新

2026-10-13。`game/selftest.js` 的四曲静态断言从旧标题、战斗、商店文件名改为当前 `sound.music.catalog.js` 的 `01-title-frostglass-v12.ogg`、`02-explore-ashline.ogg`、`03-battle-shadowtide-full-v2.ogg`、`05-shop-lamplight-deal-v3.ogg`；对应现行说明见 `docs/audio-system.md`。Howler 导入、循环播放和 `SceneMusicPlayer` 的既有断言保持。

`tests/acceptance-gate.test.js` 的 docs-only `--run` 测试改用该文件已有的临时隔离根与子脚本 stub，确认 `--plan` 不启动检查，`--run` 依次调用素材审计和文档守卫。生产 `scripts/acceptance-gate.mjs` 未改；其先跑全树素材审计的规则保持，测试不再受共享工作树未登记素材干扰。

验证：

- `node game/selftest.js`：退出 0，全部通过。
- `npx vitest run tests/selftest-paths.test.js tests/acceptance-gate.test.js --reporter=dot`：退出 0，2 文件 43 测试通过。
- 补强 `--plan` 不调用子进程的断言后，`npx vitest run tests/acceptance-gate.test.js --reporter=dot`：退出 0，42 测试通过。Vitest 依此前依赖加载 `EPERM` 诊断，获准在沙箱外运行。
- `npx eslint game/selftest.js tests/acceptance-gate.test.js`：退出 0；补强后单独 ESLint 测试文件亦退出 0。
- `node --check game/selftest.js`、`node --check tests/acceptance-gate.test.js`：均退出 0；补强后测试文件再次语法检查退出 0。
- `git diff --check -- game/selftest.js tests/acceptance-gate.test.js`：退出 0；仅报告 `game/selftest.js` 的既有 CRLF→LF 转换提示。
