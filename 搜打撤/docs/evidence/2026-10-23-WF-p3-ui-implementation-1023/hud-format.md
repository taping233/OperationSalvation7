# 共享生命数字格式统一

状态：源码与定向测试完成、未提交；主代理已完成本轮共享生命与顶栏的当前窗口局部实页，结果见下方。本分片没有操作浏览器、启动服务、build或运行全量测试。

## 问题与当前行为

同一个 `#hpText` 原来有两个写入者：`hudMethods.refresh`用`innerHTML`生成`.hp-rest`上限段，`run-top-bar.syncStats`用`textContent`抹掉它。地图→战斗时，数值可以相同；HUD的`_lastHpKey`缓存此时不会重建原格式，导致共享节点的当前／上限样式因调用顺序改变。

当前格式由 [map-health-hud.js](../../../game/src/ui/map-health-hud.js) 的既有更新入口统一负责：`controller.update`在数值归一后、快照缓存早退前调用局部`renderHealthNumbers`。它保持`#hpText`根节点，维护`.hp-current`与`.hp-rest`两个子节点；正常刷新只在对应数值变化时更新文字。同值但数字结构曾被旧入口抹掉时，仍能修复格式，不触碰tooltip或重播伤疗反馈。inactive状态也更新准确数字。

[hud.js](../../../game/src/ui/hud.js) 和 [run-top-bar.js](../../../game/src/ui/run-top-bar.js) 已移除各自的数字`innerHTML/textContent`写入，只向统一入口提供生命快照。HUD既有条色、首帧直接定位、`_lastHpKey`缓存以及共享顶栏的战斗快照优先保留；本分片没有重构血条动画或修改玩法／存档。

## active与交互边界

编辑前现行源码已是：HUD传`active:game.runActive !== false`，战斗顶栏快照传`active:true`，均不依赖`page-opaque`。本分片没有扩大或重写active条件。地图／战斗／奖励可见公共生命入口不会因`page-opaque`自行失效；页面显示策略由公共skin维护，现行规则见[视觉规范](../../production/art/VISUAL-BIBLE.md#信息层级)。

一个旧测试仍期待`_lastMode='battle'`时inactive，与当前共享顶栏源码不符。本次将该断言同步为战斗仍可点击展开，同时新增`runActive=false`的实际inactive断言：数字仍为4/30、入口inactive，随后回到active无虚假受伤。没有删除inactive契约或改写active源码来迁就测试。

## 改动和冻结副本同步

主代理已同步以下3份产品源码到当前冻结副本并完成下述局部实页；本分片没有写CSS。

| 路径 | 关键变化 |
| --- | --- |
| [game/src/ui/map-health-hud.js](../../../game/src/ui/map-health-hud.js) | `renderHealthNumbers`与缓存前格式维护；更新源码注释为共享顶栏用途 |
| [game/src/ui/hud.js](../../../game/src/ui/hud.js) | 仅移除`dispHp`局部变量及数字HTML写入，保留现有其他未提交改动 |
| [game/src/ui/run-top-bar.js](../../../game/src/ui/run-top-bar.js) | `syncStats`移除数字文本重写，继续传战斗生命快照 |

测试修改：[tests/map-health-hud.test.js](../../../tests/map-health-hud.test.js)、[tests/run-top-bar-actions.test.js](../../../tests/run-top-bar-actions.test.js)。首次编辑前5文件原文及SHA256保存在本机临时目录 `C:\Users\太平\AppData\Local\Temp\p3-hud-format-1024\before.json`。原有完成未提交改动保留，没有按HEAD重建文件。

## 定向验证

先新增3个回归，修复前定向运行均失败：统一数字节点、缓存命中修复旧格式、真实地图→战斗→地图刷新链。修复后执行：

- `npx vitest run tests/map-health-hud.test.js tests/run-top-bar-actions.test.js tests/battle-hud-info.test.js --reporter=dot`：3文件25项通过，退出码0。
- `npx eslint game/src/ui/map-health-hud.js game/src/ui/hud.js game/src/ui/run-top-bar.js tests/map-health-hud.test.js tests/run-top-bar-actions.test.js`：通过，退出码0。
- 对上述5文件定向`git diff --check`：通过，退出码0；Git提示既有CRLF后续写入会规范化为LF。

回归实际覆盖：保持数字根节点及正常更新中的两个子节点身份；同值数字刷新0个DOM mutation；同值缓存下修复被外部旧写入破坏的格式；inactive数字准确且无伤疗反馈；真实HUD刷新链选择战斗快照而非过期game生命；地图／overlay间重挂共享顶栏并返回，缓存未改变也不丢格式；现有低血、条宽、伤疗、tooltip、点击／键盘测试继续通过。这25项不与其他批次相加作全量结果。

## 主代理实页结果

主代理使用Codex IAB tab6、自然1074×956窗口取得[15个跨页读数](hud-cross-page-matrix.json)，未脚本调整尺寸。全程共享顶栏、生命根、数字根和资源根各1；地图／奖励／战斗／牌库／战斗简易设置显示，背包三区／完整设置／真实发现隐藏，返回后恢复。可见生命均164×64 CSS px，数字字号30／行高34、normal非italic，轨道4 px，`.hp-current + .hp-rest`格式跨页稳定。地图生命入口实际Enter与点击均可展开，见[地图最终页](hud-map-final.jpg)。

实际包扎花1费获得3护甲，真实`b.sts-hp-armor`宽26.3375屏幕px、生命区域宽138.25，没有覆盖血条，见[护甲几何](armor-geometry-final.json)。随后实际结束回合，生命30→23，[数值记录](hud-damage-final.json)与[受伤最终页](hud-injured-final.jpg)中的顶栏、脚下均为23/30。实际寻宝触发发现时顶栏隐藏，确认返回战斗恢复，见[发现最终洁净页](discovery-header-clean-final.jpg)。

本轮最终顶端边界使用[背包洁净页](bag-header-clean-final.jpg)与[设置洁净页](settings-header-clean-final.jpg)；旧顶栏碰撞截图仅留作修前证据。完整跨页对照见[实施覆盖](implementation-coverage.md#实页反馈补充共享生命与顶栏)。首脑、全场景、满容量、完整拖拽、全部低血／上限变化和未出现的发现变体未由以上样本覆盖。

源码、测试与本记录在交接后冻结，继续保留未提交状态。
