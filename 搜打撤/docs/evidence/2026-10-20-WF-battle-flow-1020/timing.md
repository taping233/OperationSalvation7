# 出手与命中时序校准

状态：实现与定向回归完成，当前窗口真实卡实页验收由主会话集中执行。

## 选择与实现

原逻辑在飞卡和后续前摇分别启动动作，前摇使用统一 cue 毫秒数，命中前再追加 85ms。现行角色攻击帧长约 417ms 或 500ms；无、黑箱的 cast 只有 neutral 静帧，不能把其 800ms 当作可见施法出手。

- 多帧伤害动作由真实 windup 触发；从播放器当前实际可用的纹理过滤后时间线、当前帧、下一帧截止时间读取接触姿势剩余时间，不再叠加固定 cue 前摇或额外 85ms。已按倍速运行的帧时间不会再次除倍速。
- 原图核对的接触/释放姿势：无 `frame-039`；常无语 `f038`；白塔、黑箱、星月 `frame-038`。无与三角色约 167ms、常无语约 125ms 到达该姿势，按实际当前进度扣除已播时间。接触帧未加载、静帧施法或无活动播放器时保留四类 cue 回退。
- 首次前摇启动新卡动作；同卡连击动作未完时继续当前帧，不重复截断。已经到达接触姿势的后续连击保留短 cue 间隔。
- 飞卡事件只在本次渲染交接一个待播动作；同次反馈有真实 windup 时由其接管，否则原回复、增益、纯诅咒动作照常播放。该交接按 body 存在 WeakMap，不推断或复制卡牌规则。
- `frameSynced` 仅是表现反馈元数据；扣血数值、费用、段数、随机、抽牌规则、corefactory、敌人素材均未改变。

## 文件与备份

实现属地：`game/src/battle/view/battle.frames.js`、`battle.anim.view.js`、`battle.vfx.js` 的动作触发片段；`game/src/battle/runtime/battle.staged-playback.js`；新增小辅助 `game/src/battle/view/battle.action-timing.js`。

原字节备份：仓库根 `.tmp/battle-flow-1020/timing-before/`，按原相对路径保存上述四个原实现文件和原 `tests/battle-frames-lifecycle.test.js`。

## 验证

- 首组：`npm run test:target -- tests/battle-action-timing.test.js tests/battle-frames-lifecycle.test.js tests/sts-attack-presentation.test.js tests/architecture-boundaries.test.js`，4 文件 92 测试通过。
- 次组：`npm run test:target -- tests/battle-staged-timing.test.js tests/battle-trigger-lifecycle-unification.test.js tests/battle-frames-ownership.test.js tests/battle-frames-pending-release.test.js`，4 文件 53 测试通过。
- 保留非伤害卡动作后定向补验：`npm run test:target -- tests/battle-action-timing.test.js tests/battle-staged-timing.test.js tests/architecture-boundaries.test.js tests/sts-attack-presentation.test.js`，4 文件 50 测试通过。覆盖所有角色接触帧、1/2 倍速、缺帧、neutral-only cast、同动作续播、跨场次拒用旧时钟、实际帧剩余时间只等待一次、后续连击及无 windup 的支援动作。
- 限定实现与原测试文件的 `git diff --check` 通过。

## 实页边界

测试证明运行中帧时间读取、续播、回退与规则哨兵。接触姿势来自现行素材的静态核对，仍需主会话在当前窗口核对攻击/施法与命中音效、跳字、血条同拍；渲染线程严重卡顿时的实际显示偏差不由 DOM 测试证明。本子任务未启动浏览器、服务、build 或提交。

## 实页发现的 RAF 提交竞态

主会话真实 DOM trace 证明前版读取 feedbackTail/帧时钟早于异步渲染提交，可能采用固定 cue 回退。已完成可取消的 RAF 提交屏障与真实迅疾箭邻近回归，前版 4 文件 62 项通过；框架会话同期将播放模块拆为 facade/adapter，后续 5 文件回归捕获迁移中间态 3 项失败，已协调由框架会话承接并完成最终回归。完整有效修复片段、边界、准确失败测试名与日志状态见 [timing-race-patch.md](timing-race-patch.md)。本记录不将迁移中间态标记为已通过。
