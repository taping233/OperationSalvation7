已用 `view_image` 逐张打开本包9张PNG，未发现阻断验收的缺字、标题裁切、卡面覆盖或主要控件遮挡。两条画面观察保留在下方；结论只覆盖列出的当前窗口截图。

本包为 Unity 2022.3.62f3c1，GUID `4d33ec981819461295052942d67afeee`，Windowed 2560×1440 / DPI120。只读结果为 `player-1/result.json passed=true`、`process.json exitCode=0`。逐图字节数、SHA256、实际捕获帧和判断见同名JSON。

| 实际查看PNG | 判断 |
| --- | --- |
| player-bag-discovery-candidates.png | 三张卡面、费用、说明和标题完整；未选时确认呈灰态。 |
| player-bag-discovery-selected.png | 双相星盘蓝底及“已选中”明确，卡面保持可见，确认呈可用状态。 |
| player-bag-discovery-save-failed.png | 局部保存失败/保留候选/可重试提示完整，所选卡和控制仍在；上方全局Toast不盖标题或卡面。 |
| player-bag-discovery-returned.png | 随身背包显示双相星盘1张，占格1/16；上一失败通知仍可见。 |
| player-r7-hub-rune-progress.png | 列表/详情均2/5，目标未达成灰态，奖励钥匙×2清楚。 |
| player-r7-hub-rainbow-progress.png | 列表/详情均1/1，领取按钮亮态，奖励钥匙×3清楚。 |
| player-r7-hub-collection-receipt.png | 回执列出实际斩杀×1、混沌之眼×1及仓库去向，按钮/详情未互盖。 |
| player-r7-hub-reward-warehouse.png | 仓库两张实际卡各×1，与回执相符；顶部占格统计对比偏低。 |
| player-r7-hub-partner-reply.png | 旺财与“歪头看着你。”回应、伙伴名/选择格和培养信息均可见。 |

`player-bag-discovery-returned.png` 顶部约 x845–1714 / y145–224 仍有前次失败Toast，含隔离测试路径与I/O原因。失败图frame1529、返回frame1534只隔5帧；本包 `round7-bag-real-claim-return` 另记录来源只消耗一次、奖励1张及独立ReadSlot通过。此处记录通知与实际到账同时可见，不据这张图推定存档失败，也不推定长期显示行为。

`player-r7-hub-reward-warehouse.png` 约 x63–302 / y345–371 的“2种·仓库3/25格”浅字在亮背景上对比偏低。未见裁切，卡名、数量及主要按钮清楚；这是非阻断可读性观察。

到账交叉证据来自正式驱动：背包真实候选为双相星盘/雷殛/法力奔涌，保留树选择、受控I/O失败保全及重试后的精确奖励均有本包记录；Hub正式m45回执记录两张不同传说卡且保存成功。驱动前置使用隔离存档填充收藏与fire/ice双属性彩虹符文，后续走真实原生控件射线点击；这是受控流程，未声称OS物理输入或自然无辅助游玩。对应代码为 `NativeDisplayReview.Round7Bag.cs:48–88` 和 `NativeDisplayReview.Round7Hub.cs:34–93`，本独审没有执行它们。

本次没有修改生产或检查源，没有运行测试、编译或新播放器。9张图不替代持久化、随机流、旧事件、六候选滚动、其他页面、其他尺寸或整帧性能证明。
