# 卡牌中途选靶的触屏取消入口

2026-10-18 UTC。扰敌选定第一名敌人后，提供可点击的取消按钮，复用已有道具选靶提示条与取消命令，不改核心玩法。

## 问题与修正

真实模块链：扰敌 → 点击首个敌人 → pendingTarget 保留，牌与能量尚未消费，气泡提示“已选某敌先攻击；再选另一名敌人 · Esc 取消”。此时第一次瞄准已经提交并结束，右键取消瞄准的临时监听不再存在；页面唯一 btPickCancel 只在 pendingItem 渲染，触屏用户没有直接可见的取消控件。不能把通过另选卡或重新拖牌产生的旁路视为清楚的取消入口，也不声称所有可能操作都无法退出。

修前新增真实模块测试在“取消按钮存在”处失败。修正仅扩展 `battle.view.js` 原 itemBar：pendingItem 保留原说明；pendingTarget 复用 `.bt-infuse.bt-pick`、`.bt-infuse-actions`、`mini-btn` 和 `btPickCancel`，显示当前牌名及“继续选择目标，或取消返回手牌”。既有 command 负责清理，不新增弹窗、状态或第二套取消规则；牌名用 esc 转义。

保留同文件此前临时道具任务的 showItemBar 改动，未覆盖他人修改。

## 验证

- 修前 1 项真实模块红测；修后新增 2 项通过：首选取消不消费且清提示/目标高亮/按钮；含不可信牌名的提示条安全渲染，正常双选一次扣费完成后移除。
- 5 文件 165 项通过，详见 tests.txt：battle-hand-inspector、battle-infusion-action-layout、battle-esc-ime-guard、contracts、architecture-boundaries。
- 原 targeted items 回归确认道具取消入口仍存在、取消不消费道具。
- 定向 ESLint、node --check、8 套 typecheck 通过；types.txt 留存类型结果。
- 本轮只读鼠标/触屏审计额外运行 battle-drag-reference、battle-hand-keyword-interaction、battle-aim-canvas-resolution，共 39 项通过。拖牌取消、词条按住阅读、跨重绘更新、箭头清理未发现新的确定缺陷；不把通过结果当作完整体验无问题证明。

均为源码与 jsdom 合成交互，非实玩。内置浏览器环境仍阻塞，无 headless/CDP/外部浏览器替代，无 build/服务/提交/推送。待实页核验触屏首选敌人 → 看清取消条 → 点击取消 → 重新选牌，以及现有药水取消条的实际布局、点击可达性。

## 参考

参考 Shattered Pixel Dungeon 固定 SHA `57a4e06a4caf162446d1c28caa7983f0493fecf0` 的 [WndBag.java](https://github.com/00-Evan/shattered-pixel-dungeon/blob/57a4e06a4caf162446d1c28caa7983f0493fecf0/core/src/main/java/com/shatteredpixel/shatteredpixeldungeon/windows/WndBag.java) 选择态退出明确结束选择，以及 Slay-The-Robot 固定 SHA `4dac5abe0d19382f8ace2cec5ed3fd77e2a0e11d` 的选择/提交分离。只参考交互边界，未复制第三方代码或素材；不推断这些游戏与本项目有相同触屏实现。
