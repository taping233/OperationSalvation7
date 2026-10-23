# P1-ENTRY-01 主线集成验收

已将副本最终两文件精确合回主线，未构建、提交或推送。该记录为主线最终状态；此前 `entry-review.md` 的“未修改主线”描述对应隔离验收阶段。

## 合回核对

- 定向 handoff：HEAD `ed0cf08d3e`，相关变更 0、编辑占用 0、完成未提交 0；其他属地未触碰。
- 写入前逐一比对 `entry-before-sha.json`，主线两文件与原始 SHA 完全一致，无冲突。
- 仅复制 `game/src/run/game.run.class-choice.page.js` 与 `tests/departure-class-confirmation.test.js`；复制后源、目标 SHA256 一致。
- 选人叶页面最终 SHA256：`D2F41030CEFF61D17D18F6269A054B62B6C4F20A0A03E9686FE32D69711A2552`。
- 确认回归最终 SHA256：`65B5178F03AA0DBFD5BC93C88964069F31D29780C805A18FCA6142A7B9553F90`。
- 已核对入口门面、整备适配器、上下文守卫、公共加载与页面生命周期、人物视图、角色表、初始补给状态、架构图脚本及另三套定向测试，共 16 项相关输入；主线与已验副本哈希一致，沿用同一共享 node_modules。因此复用隔离阶段 42 个不同用例通过证据，不因文件移动重复执行。

## 主线补验

- `entry-main-static.txt`：两文件 ESLint、Node 语法检查全部通过，退出码 0。
- `entry-main-sentinels.txt`：`contracts` 18/18、`architecture-boundaries` 44/44，共 62 个哨兵用例通过，退出码 0。只执行指定测试，无 pretest、编译或构建。
- 两文件 `git diff --check` 通过。
- 他人 `game/src/generated/art-manifest.js` 在集成前后 SHA256 均为 `FCE7FF6407BE53C1D530C6DD36306D881D068232C2F9E553FE55EAE1F38D990B`，内容未变。

本项技术收口完成；台账与实页旅程由统筹及指定旅程代理负责。本项未执行全量测试或类型检查，未在浏览器注入受控写锁延迟；精确竞态有红绿定向测试证据。
