# 奖励腾位整理的连续焦点

已完成局部修复，未提交。奖励满包时进入“腾出位置”，点击某行“丢弃1张”会重建整理器内容，移除当前焦点节点。修前真实模块 jsdom 的6项新增焦点用例均失败，activeElement 为 body；原6项业务用例仍通过。问题在整理器自己的重绘，不是公共 overlay 的开窗聚焦。

## 修改范围与行为

- `game/src/ui/reward-capacity-organizer.js`：只在本地 render 后恢复焦点，不改公共 overlay。进入确认聚焦“保留”；保留回到原卡“丢弃1张”；确认丢弃后优先同堆，原堆消失则当前索引相邻卡，尾行消失退前一行；无卡时聚焦“返回奖励”，不自动离开、不自动领取。
- 安全格整理失败后若原按钮已禁用，回到同卡可用的“丢弃1张”入口（只聚焦，不执行丢弃；仍需二次确认）；领取前容量变化则聚焦返回。
- 焦点恢复用 preventScroll，原 live/revision/current 守卫继续保护旧页面，奖励归属、容量检查、移动整叠及丢弃1张规则保持。
- `tests/reward-capacity-organizer.test.js`：新增9项真实模块焦点断言，含安全默认、同卡/邻卡/空列表、禁用目标回退、旧页面不抢焦点。

## 源码对照依据

- Shattered Pixel Dungeon，固定提交 `57a4e06a4caf162446d1c28caa7983f0493fecf0`（2026-10-06）：[InventoryPane.java](https://github.com/00-Evan/shattered-pixel-dungeon/blob/57a4e06a4caf162446d1c28caa7983f0493fecf0/core/src/main/java/com/shatteredpixel/shatteredpixeldungeon/ui/InventoryPane.java#L284-L340) 的 updateInventory 保留槽对象，更新 item/提示/可用性，并保留仍有效的 lastBag。借鉴点是交互中的状态更新保留操作上下文；这不是对其桌面键盘焦点行为的测试结论。GPL-3.0-or-later，不引入源码或素材。
- Slay-The-Robot，固定提交 `4dac5abe0d19382f8ace2cec5ed3fd77e2a0e11d`（2026-08-28）：[CardSelectionOverlay.gd](https://github.com/DesirePathGames/Slay-The-Robot/blob/4dac5abe0d19382f8ace2cec5ed3fd77e2a0e11d/scripts/ui/CardSelectionOverlay.gd) 的 populate_cards 在进入选择时建卡，_on_card_selected 只改 picked_cards、选中光效、说明和确认可见性，不在每次选择时销毁整组控件。MIT，仍只借鉴思路，没有复制实现。该项目原型局限不影响这段可核实机制，但不能借此宣称整个项目体验优秀。
- 本项目没有因此改造成槽复用架构，仅弥补现有重绘后的焦点契约。参考实现不同本身不是缺陷，真实模块断言的焦点丢失才是本次修复依据。

## 验证

- `red.log`：修前12项，原6过/新增6败。
- `green.log`：5文件104项通过，含整理器15项、chests-reward-capacity-notice、reward-capacity-preview、contracts、architecture-boundaries。
- `lint.log`：两个改动文件 ESLint 退出0；源码 `node --check` 和限定路径 `git diff --check` 退出0。
- `types.log`：8套 typecheck 通过。
- 没有运行全量/build、第三方游戏或浏览器，没有提交/推送。jsdom 的 focus+click 是合成模块验证，不是实页键盘操作。真实下一次 Tab 的位置取决于浏览器；不由此声称必定落首项，待内置浏览器环境恢复后验证“满包奖励→第二卡丢弃确认→保留→确认→返回奖励”的连续实际输入。
