# 入战首帧优先

2026-10-13，Friday / Codex，战斗重做的 entry_frames 子任务。代码与定向回归完成，未提交；当前窗口的冷加载与视觉验收由主协调继续。

入场就绪现在只等待当前角色的首个可用 idle 帧完成绘制，不再等整套 idle、攻击、受击、施法、死亡帧库。其余帧按真实帧表的原候选顺序、每批最多 3 个请求继续后台补齐。首个 idle 缺失时依序探测下一个；所有 idle 都不可用时明确返回失败，让既有入场门提供“以简化画面继续”。没有增加固定等待时间，也没有改素材或动作数值。

## 依据与实现

- 实读 `game/src/battle/view/battle.frame-catalog.js`、`battle.frame-catalog-changwuyu.js`、`battle.frame-catalog-three-role.js`，核对它们导入的已交付 `sprite-v1/animations.json`；常无语当前目录使用 `f000` 等名称，不再套用旧 neutral/frame-001 假设。
- `battle.frames.js` 将首帧 ready 与后台 complete 分开；attach 在选好首帧、定位 sprite 并调用 `renderer.render` 后兑现成功。包围盒探测失败时按真实画布尺寸定位，避免兑现空人物。
- 后台更新共享纹理/动作序列映射。已加载的部分动作按原帧槽与原时长播放，缺帧槽跳过；不再因一个缺帧拒绝整个动作。待机在下一循环读取新补齐帧，同场 rerender 保留当前攻击/受击播放状态。
- 换角色在同步段取消旧任务；旧批次已发出的请求结束后卸载，其余批次不再启动。hide 清空角色缓存、恢复静态图、隐藏 sprite 并返回释放承诺；新 attach 等旧资源释放，避免旧卸载破坏新加载。
- 同一图像槽在首帧 pending 时变更角色，不复用旧 attach。角色与图像拥有者令牌共同阻断迟到接管。减少动效沿用静态图路径，不发起纹理加载。
- 既有 `battle.presentation-ready.js` 的图片/场景依赖、缓存即时揭示、8 秒异常上限及明确简化入口保持原实现；本子任务未改节点确认链或接敌 cinematic。

## 验证

- `npx vitest run tests/battle-frames-lifecycle.test.js tests/battle-entry-readiness.test.js tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=dot`：4 文件、77 项通过（2026-10-13 13:40:56，客户端北京时间）。包括首帧绘制后仍有后台批次 pending、部分动作可播放、后台补齐后恢复完整攻击帧、首 idle 缺失、非关键缺帧、后台取消/卸载、pending 同槽换角色、减少动效以及原有死亡/切页/缓存门回归。
- `npx eslint game/src/battle/view/battle.frames.js tests/battle-frames-lifecycle.test.js`：退出码 0。
- 两个目标源码/测试的 `git diff --check`：退出码 0；只提示现有 CRLF 将由 Git 规范成 LF。
- 首次默认沙箱 Vitest 在现有 `node_modules/vitest/dist/spy.js` 的 realpath 处 EPERM，未收集测试；同命令获自动审批后成功执行。该失败不计为回归通过。
- scoped handoff 已核对目标路径，无活跃编辑冲突；共享登记由主协调负责。未启动服务、build、安装、删除、提交、推送或使用浏览器。

## 完整改动路径

1. `D:\素材\代号柒\搜打撤\game\src\battle\view\battle.frames.js`
2. `D:\素材\代号柒\搜打撤\tests\battle-frames-lifecycle.test.js`
3. `D:\素材\代号柒\搜打撤\docs\evidence\2026-10-13-WF-expedition-experience-1013\battle-entry-first-frame.md`

未核验：真实网络下首帧揭示时间、首帧与静态图交接观感、主协调 1920×1080 内置浏览器中的冷入场和后台补帧。测试使用受控纹理/DOM，不构成性能采样或视觉通过。首帧本身仍未就绪时继续由原门遮挡；取消时已发出的 Pixi 纹理请求须等结束后才能完成卸载。
