# 原始启动缺陷观察（2026-10-18）

真实导入 game/src/main.js 并派发 DOMContentLoaded，实际 showTitle 已完成：game.state 为 title、标题可见、controlsBound 为 true。手动执行四次真实启动循环帧，每次等待275ms让既有250ms空闲调度继续，body.dataset.state 仍未写入；loopTicks 从0增至4。原 desktop preload 因 body state 为空而始终不发送 startup-ready。

这是只读原始缺陷观察，测试通过代表复现缺陷成功，不是候选验收。原实现字节与 SHA 见 game.boot.before.js.txt 和 observations.json；当时的独立探针、配置和命令结果同目录保留为文本。探针沿 tests/boot.test.js 的真实 main 启动夹具，只替换 canvas/audio/fetch 环境能力并手动驱动 rAF；不模拟 showTitle 或 loop。jsdom 不证明 Electron/GPU 实际首屏耗时。

复现路径是 .tmp/startup-readiness-1018/battle/，配置命令见 command-result.txt。修复后不能用原缺陷断言直接验候选；候选观察单独保存。若重放原缺陷，须在独立副本恢复保存的原 game.boot 字节，不回滚共享工作区。未修改生产或共享 tests/boot.test.js。

候选同夹具结果：1/1通过。DOMContentLoaded 结束后、loopTicks 仍为0时，body.dataset.state 已为 title；四次后续循环均保持。候选原始日志、观测 JSON、独立断言及候选源码 SHA 另存 candidate-*。与原缺陷相比，只有 body state 发布改变；title 可见、controlsBound 与 lobby 条件一致。
