# 手绘透视雨台模块

状态：实现与定向检查完成，未提交；当前窗口实页由主会话集成验收。

`game/src/hub/courtyard.rain-tableau.js` 使用同一仿射投影绘制方形台面、雨滴落点与点击逆变换。画面包含暖纸底、可见厚度的浅水台、扁色地面投影、宽色块水面、细长落雨和投影椭圆水圈；点击台面产生三重扩散水圈。配色为冷灰 `slate`、苔绿 `moss`、暖陶 `clay`。

## 接入接口

`createRainTableau(canvas)` 返回：

- `resize(width, height)`：画布像素尺寸，重复调用保留雨滴和水圈进度。
- `render(dt = 0, animate = true)`：`dt` 单位为秒；完整绘制背景与雨台。`animate=false`、`dt=0` 或无效时间不推进模拟；单次最多推进 0.1 秒。
- `tap(x, y)`：画布像素坐标；台面内返回 `true` 并生成水圈，台面外与无效坐标返回 `false`。
- `setIntensity(40 | 80)`：分别保持 40 与 80 条雨滴，最大 80 条；水圈最大 64 个。
- `setPalette('slate' | 'moss' | 'clay')`：切换色盘；随后由调用方绘制。
- `dispose()`：可重复销毁，释放粒子并清空画面。
- `getDiagnostics()`：冻结的计数、投影边界与状态快照，仅用于诊断；无法修改运行状态。

主会话负责一个 RAF、真实指针坐标换算、键盘触发、暂停、减少动效、页面可见性、音频与 UI。模块不创建后台计时器、监听器或额外画布。台面中心位于画布宽度的 50%、高度的 60%。

## 实际检查

- Scoped handoff：指定模块、测试、证据文件没有相关编辑占用或现有改动。
- `node node_modules/vitest/vitest.mjs run tests/courtyard-rain-tableau.test.js --reporter=dot`：8/8 通过。
- 两个 JS 文件 `node --check`：通过。
- `node node_modules/eslint/bin/eslint.js game/src/hub/courtyard.rain-tableau.js tests/courtyard-rain-tableau.test.js`：通过。

测试用可见四边形独立判断雨滴落点与点击边界；检查椭圆比例和裁切、静态不推进、水圈扩散与渐退回收、持续降雨/密集点击上限、雨势差异、重复尺寸变化、三色盘及重复销毁。

未核项：当前窗口的最终构图、纸面和台体观感、真实点击、动画速度及与控制器的联动，交主会话实页复核。本子任务没有启动服务、运行 build、改共享记录或提交。

## 导航只读审查与复核

老板调整顺序后，雨台保持冻结；按主会话派工，只读审查导航最终稿。依据本轮 `hierarchy.md` 中的渐进披露和游戏可用性原则，反馈四项具体问题，主会话修复后逐项复核如下：

| 原问题 | 最终源码复核 | 对应定向用例 |
| --- | --- | --- |
| 培养仓库经补给的“整理仓库”返回丢失人物来源和筛选 | `game.hub.js:268–272` 的 `resumeStash` 识别补给回原仓库；不重置培养来源，不清人物筛选 | `hub-flow-regression.test.js`：培养经补给的整理仓库快捷回流保留人物来源和筛选 |
| 主页待复原快捷路径带入旧培养筛选，和普通后勤入口不同 | `game.hub.js:271` 对主页进入仓库的普通与快捷路径统一清筛选；来源标记也按新入口重置 | `hub-flow-regression.test.js`：主页待复原快捷入口清除旧培养范围，可领取成就也在收藏入口提示 |
| 培养搜索无匹配仍提示缺少培养牌 | `hub.warehouse.js:29–35` 区分无培养候选和搜索/筛选无匹配；`update()` 刷新空态，重置搜索保留人物范围 | `hub-pages-rework.test.js`：培养卡存在但搜索无匹配时不提示缺卡，重置搜索保留人物范围 |
| 合并奖励后，基地提示未计入可领取成就 | `hub.home-v3.js:6` 的 `pendingRewards` 合计 `pendingColl()` 与 `pendingAch()`，用于收藏室入口提示 | 上述主页快捷入口用例同时断言只有成就奖励时显示数量 1 |

结论：四项修复均成立，源码与新增用例一致。复用主会话本轮 `hub-flow-regression` + `hub-pages-rework` 22/22 通过结果；本复核未重复运行测试，未扩大审查范围。真实导航输入及截图由主会话验收，本子代理未操作浏览器，未修改源码或共享记录。
