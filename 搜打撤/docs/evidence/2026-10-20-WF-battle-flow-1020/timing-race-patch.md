# RAF 渲染提交竞态：有效修复片段与并发交接

## 已核原因

factory 的 `requestBattleRender()` 仅将 `flushBattleRender` 排入 requestAnimationFrame，并非立即提交 DOM/反馈。旧 staged playback 紧接着读 `waitForFeedback()`，读到上一轮 feedbackTail，并在角色真实 windup 尚未入队时采用固定 cue 回退继续伤害。随后实际渲染又给 windup 加了飞卡 baseDelay，角色动作可能落在已经变化的可见血条之后。

主会话真实 DOM trace 证据：无的 atk 从 583754 开始，血条 32→28 在 583873.7，角色仍是 frame-037；接触姿势 frame-039 在 583921。已确认预览副本与当时主线 frames/vfx/staged-playback 文件一致。逻辑 snapshot HP 不用于单独判断表现是否同步。

## 23:19:00 通过的前版实现

以下片段原实现于 `battle.staged-playback.js`；随后框架会话拆为 facade、`battle.playback.js` 与 `battle.browser-presentation.js`。不覆盖对方属地，由框架会话迁移同一语义。

```js
function waitForRenderedFrame(signal) {
  throwIfActionCancelled(signal);
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const frame = requestAnimationFrame(done);
    function cleanup() { signal?.removeEventListener('abort', cancel); }
    function done() { cleanup(); resolve(); }
    function cancel() {
      cancelAnimationFrame(frame);
      cleanup();
      reject(actionCancellationError(signal));
    }
    signal?.addEventListener('abort', cancel, { once: true });
  });
}
```

在 runStagedSteps 捕获本场 battleToken/generation 并定义原 ensureCurrentBattle 后：

```js
const renderAndWait = async () => {
  render();
  await waitForRenderedFrame(signal);
  ensureCurrentBattle();
};
let stagedBeats = 0;
// 生成器每次 next.value（非 done）时 stagedBeats++。
```

具体调用边界：

1. `windup`：写入 windupfx → `await renderAndWait()` → `await waitForFeedback(signal)` → 查询运行中的 `actionImpactRemaining` → 等待接触帧剩余时间 → 才允许生成器执行伤害。
2. `hit` 或其他非 done 的表现 beat：`await renderAndWait()` 后读取并等待本次 feedbackTail，再处理 stagedDeathFx。
3. 生成器结束：`stagedBeats > 0` 时 `await renderAndWait()`，否则只调用 `render()`；之后保留原反馈和死亡释放等待。无表现 beat 的纯能量等同步效果不可新引入 RAF 等待，否则直接 await 的延迟任务在假时钟/无呈现环境下会挂起。
4. STAGED_BOSS_DEFEAT：先 `await renderAndWait()`，再等待其反馈与原 220ms 收尾。
5. `releaseDeathFx` 清标记后的重绘、abort catch/finally 的清理重绘保留原 `render()`。Abort 立即取消尚未触发的屏障 RAF，移除监听并 reject；屏障完成后必须再次核场次/generation，旧任务不得推进新场。

## 新增回归及结果

23:19:00 前版：`battle-staged-timing`、`sts-attack-presentation`、`battle-frames-lifecycle`、`battle-action-timing` 共 4 文件 62 项通过。新覆盖：异步 RAF 提交、340ms 入队延迟、167ms 接触点之前不得结算，换场 Abort 取消屏障；正式卡库 `tt2-swiftarrow` 在 windup 的独立渲染 HP 仍 35、下一 hit 才 32，普通库真实减少到 98；五角色攻击及可用施法的接触点和倍速读取。

随后按授权修复 trigger-lifecycle 第205行，仅过滤 tt2-apollo/life-random 两张业务卡后严格验证出现顺序与各一次，保留能量和触发隔离断言。

23:19:28 五文件集合因框架拆分写入中间状态出现下列 3 条失败；触发测试 31 项已通过。已将问题交根会话协调框架会话，不覆写其文件：

- `battle-staged-timing.test.js`：`waits for an asynchronous render to enqueue its delayed windup before sampling live frame timing`
- `battle-staged-timing.test.js`：`cancels a pending rendered-frame barrier without mutating the next battle`
- `sts-attack-presentation.test.js`：`real 迅疾箭 presents its windup in an earlier RAF render than the damage and still draws from the real pile`

该轮完整输出：`timing-render-race-regression.log`（记录 3 failed / 90 passed，不能作最终通过证据）。23:19:28 后只读已见新 browser adapter 与 playback 包含屏障，最终验收由框架会话完成后另记。

原字节备份：仓库根 `.tmp/battle-flow-1020/timing-race-before/`。本轮未改 vfx/layers/frames 的生产内容，所以它们前次动态素材语义审查仍适用；未自行刷新指纹，未服务/build/浏览器操作。
