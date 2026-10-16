# 消耗卡复原选择页：公共决策壳与键盘操作

完成未提交，编辑释放。实现位于共用 `openPocketRestore`，祭坛献祭道具（最多 2 张）、祭坛回赠（3 张）、修鞋铺（1 张）同时生效。真实玩家存档未读取或改写；未使用浏览器、启动服务或运行构建。实际画面与真实键盘输入仍待父任务在当前窗口验收。

## 本次实现

- 改用已有 `battle-decision` 头部、摘要、滚动内容区与独立 footer；`discover` 模式沿用远征选卡遮罩，保留当前场景音乐
- `.pocket-restore` 作用域内规定 1480 逻辑像素上限、94% 高、五列 240 逻辑像素卡面；仅内容区滚动，继续旅程始终位于内容区外
- 复原候选改原生 button，显示卡名、口袋剩余张数和“复原 1 张”；完整规则通过 aria-description 提供，卡面内部 Tab 焦点移除
- 同一次复原重绘保留滚动和当前候选焦点；该种候选耗尽后就近选择下一候选，全部候选耗尽则焦点落继续旅程
- 共享取消探测新增显式 `data-cancel="false"` opt-out，仅复原候选使用。卡名或规则含“返回/取消”时不会被 Escape、× 或遮罩当成退出动作误点。退出仍委托原有继续旅程回调

## 业务边界

`FIRE_RESTORABLE`、次数、容量检查、口袋扣减、逐张发卡、新 UID、`finish`、保存和原有 done 回调保持不变。`manifest.json` 的字节比较确认复原函数外源码、函数内 `finish` 到发卡回调末尾、已有奖励 CSS 均未变化。Apollo `deferAcquiredCard` 原增量原样保留。`game.run.altar.js` 未编辑，既有献祭 safe/stored 与滚动修复未触碰。

新增 `game/src/ui/overlay.js` 变更仅是 `_findCancelBtn` 的显式 opt-out 谓词，其余取消启发式不变。旧 `tests/sys03-altar-restore-txn.test.js` 仅更新两条呈现壳断言，原业务断言不动。

## 验证

最终定向 16 文件 184 项通过：新界面 16 项，旧 SYS03/钥匙复原、奖励原子性、事件生命周期、四线回归、献祭保护与滚动、珍珠盒、UI 生命周期/可访问性、契约与架构边界。

新测试用真实 UI 委托和 overlay 实现，游戏/存档为独立桩，不访问玩家存档；jsdom 不模拟布局或浏览器默认键盘点击。键盘激活测试明确构造默认激活结果 `click(detail=0)`，不当作真实 Enter/Space 实机证据。浮点 scrollTop 保留和按钮焦点为 DOM 契约，五列/字号为 CSS 契约，均不等同真实布局验收。

- `regression-final.log`：最终 184/184
- `lint.log`：限定源码/测试 ESLint 通过
- `syntax.log`：427 个项目文件语法通过
- `typecheck.log`：8 套类型配置通过
- `cancel-probe.log`：修复前构造卡名触发取消误判的观察证据；最终测试已替换成防回归断言
- `scenes.delta.diff`、`styles.delta.diff`、`overlay.delta.diff`、`sys03.delta.diff`：相对接手工作树的独立增量
- `manifest.json`：文件 SHA 与不变量检查；未更新父任务管理的 opaque 指纹
