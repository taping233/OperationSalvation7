# 默认桌面包：第二次最终独立定向实绘审查

**结论：本次直接复核的新播放器画面与活跃代码中，第一次审查的4项确认差异均已关闭；本次范围无确认未闭环 P1/P2。** 此结论限本表范围，不把48次取图等同全部玩家输入或全部分辨率验收。

本次为只读审查：未启动 Unity、构建、浏览器或前台操作，未改 Assets。旧报告仅作定位，结论来自最新 `desktop-final-player-2` 的原图、记录和当前源码。实际打开的11张原PNG及SHA见 `player2-review.json`。

## 最新输入

- `result.json` passed，98条记录中48次实际 backbuffer capture；`process.json` exit0、未超时。BuildGUID为 `38d6541a41004fd88bbf4438a283dccb`，对应默认 `Build/Desktop` 的第二次最终构建。
- 正常Standalone：2560×1440、DPI120、D3D12、ScreenSpaceOverlay、ScaleWithScreenSize，CanvasScaler1.333，buffer scale1。宿主零透明度、非激活且穿透点击，无OS硬件输入。构造EventSystem输入与实际渲染分别记录。
- 直接打开商店、检视、收购台、免费商品、凭据完成页、重编阅读器、奖励阅读器普通/满包/返回背包、指南第5章展开、设置共11张原图；另看原像素金币/阅读器/指南裁图。未据缩略图宣称字形质量全部通过。

## 确认项关闭

| 原确认差异 | 新实际证据与活跃代码核对 | 结论 |
| --- | --- | --- |
| 商店金币过小、价格换行 | `player-shop`、`player-shop-inspection`、`player-shop-exchange`中金币清楚可辨，货架及购买脚注价格保持同一行。`CurrentShopCoin`按原透明图留白作1.7倍补偿，源 `expedition-shop.css` 的header48/货位、出售入口、账单36/详情30/卖出28各消费者均接专用组件；收购台总价与右侧“币”分列符合源grid结构 | 关闭；卖出28入口本次图无可售牌，接线/参数静态核验，实际操作另由原生商店检查覆盖 |
| 大模糊规则网格重复字形 | 新重编与两个奖励阅读器中背景连续模糊，旧7×7稀疏偏移产生的重复卡/文字网格不再可见；前景卡牌和备注清楚。当前shader大blur分支采用96样本Gaussian，小blur保留；普通读卡共用源18px blur与18%幕布 | 关闭原确认重影；不主张GPU近似Gaussian与浏览器CSS逐像素相等 |
| 指南安全格不能编组的错误说明 | `player-guide-more-4`明确显示“普通背包与安全格中的可编组卡牌都能参与；容器里的牌需先移回普通背包”。Source `battle.lifecycle.domain.js:419`与Native `BattleSession.PrepareDeckSelection`均排stored/pouch及特定类型而不排safe；本页汉字/行距可读，正文未被footer遮住 | 关闭，按具体执行纠正文案，玩法过滤未改 |
| 真正奖励阅读器仍旧实色分支 | 新 `player-reward-reader-pending`为共同模糊幕布，单张卡、无备注、青色“收下”脚注；满包图变“整理背包”，点击后实际回背包。`CurrentRewardTile`现接薄适配器→`DepartureCardZoom`，`hideNote:true`与源chests/event-card-choice消费者一致；owner/receipt/run/node/chest/trigger及pending守卫仍在 | 关闭；新QA用正式宝箱领取命令验证taken，一次领取后旧UnityEvent不再改State/RNG；满包打开整理不改奖励、卡数、币或RNG |

凭据完成页的新图已完全到达，整页不再透出下层货架；当前取图等待该组件alpha=1且位置归零，符合其正式0.65秒到达动画。免费商品两格与完成叙事一致。设置图未见本次shader调整造成可见新布局问题。

## 奖励图顶部的保存失败提示

它是前一个受控重编锁文件测试留下的4秒全局提示，不能据此判断奖励领取保存失败：

1. `NativeDisplayReview.cs:197`用真实隔离文件锁点击重编确认，`GameRuntime.Persistence.cs:58`发出该原文；解除锁后确认已成功提交，然后立即新建奖励夹具。
2. `DesktopRunHud.ShowMessage/Update`将提示保留至 `Time.unscaledTime+4`，切换构造场景不会清空；记录中1393帧重编失败、1442帧普通阅读、1490帧满包阅读、1495帧返回背包带相同文本，1722帧返回基地已无该提示。
3. `player.log`仅有一条对应的 `[sdt]` 保存失败通知，来自上述故意锁文件；本次奖励的正式命令、一次领取/旧按钮拒绝及满包状态断言均通过。

提示附带当前Windows I/O英文原因，在该故障画面中完整可读；本次未将平台故障诊断当成卡牌/指南文案错误，也未为这个测试时序新增全局设计。它限制了奖励截图作为“无提示干净画面”的用途，不否定本次奖励接线与前景阅读效果证据。

## 范围

没有物理键鼠、多尺寸或全部自然随机流程覆盖。本次没有重新证明未改页面、全卡任意组合、商店随机等价；这些应引用各自现行证据。已查看范围没有确认遗留项，其他未查看内容不据此泛化通过。
