# Round7 背包片独立只读审查

结论：恢复替换预览与发现页本体未发现确定的新生产回归；**详情入口仍有已确证的旧事件归属缺口，当前不能将整条Bag-use→发现链判为闭合**。另外发现两处必要检查覆盖不足，已报Root与Run。没有修改生产/检查源，未编译、测试或启动Unity/Player。

审查输入是 `bag-freeze.json` 的12项，冻结时间 `2026-11-01T09:13:52.053565+00:00`，SHA256 `c5bad6147451e19e3037433e3b2d302a2b02bd236387dc86bf249dc2cf83c072`。开始及收口时12项当前原字节均匹配。本文只对应该冻结版本；作者后续修正需另核对应差异及新指纹。Hub片保持冻结。

## 确定入口缺口：关闭后的BagCardDetail旧事件可以进入当前库存

`BagCardDetail.cs:15–19` 只有Entry/UID/名字/区域/返回焦点，没有runtime、State、slot、关闭态或render代次。`:78–83` 的实例Action直接交给 `BagView.Button`，后者在 `BagCurrentView.cs:139–143` 仅包装UIKit按钮；`Kit/UIKit.cs:69` 调用回调时也没有面板归属检查。

明确静态调用链：

1. 打开真实卡C详情，保存 `useDetailCard.onClick`。
2. 关闭旧详情，随后当前Bag置顶；或重新载入/替换到含相同UID的新OwnedCard并打开当前Bag。
3. 回放旧UnityEvent。旧详情的 `Close()` 因已出栈而无操作，`UseOwnedCard(_uid)` 却继续执行。
4. `BagCardDetail.cs:144–146` 按当前State查询该UID，`BagItemDiscoveryScreen.Open:41–48` 看到当前新Bag置顶且有合法来源，便为当前来源建立/保存发现候选。新发现页自己的强owner guard无法判断这个请求来自已关闭旧详情。
5. 非discover道具的旧事件还可在另一详情仍置顶时直接进入 `TryUse`，因为此分支没有发现页的Bag置顶前检。

这是构造保留旧UnityEvent的边界，未声称物理鼠标可以点击已失活对象。Browse在 `BagCardDetail.cs:92–95` 实际关闭旧页再创建新页，并非同实例改_uid；早先消息中“Browse读新_uid”已明确更正。需要防的是旧页继续发命令，而不是为不存在的同实例过程写夹具。

Source `game.bag.js:232–254` 持有sourceView/root/zone/filter/browseCurrent，旧页和来源变化后不能继续导航/提交。

建议精确最小修正：作者已持有的 `BagCardDetail.cs` 统一守卫全部实例动作、关闭、前后翻页及丢弃确认；捕获当前运行/Bag owner/slot/来源、当前启用与栈顶、渲染和关闭代次。关闭前先校验，再允许同一已接受操作同步续接正式Use入口。保留现行UID/容量/保存命令，不能在发现页新增宽松接收旧调用的fallback。新增“关闭→同档新Bag、加载同UID新实体、翻页旧非discover事件”断言，分别记录真实当前按钮与构造旧事件。

## 恢复预览：本次未见语义错误

实际读 `CardContainerCommands.cs:10–52,111–134`，对照正式CanReceive与 `BagItemCommands.TryUse:98–123`：

- normal来源条件与正式投影一致：非safe、非stored、无pouchOf，缺失/重复普通来源UID拒绝。来源和目标使用相同稳定ID+variant键，装备1、其它3走同一StackCap。
- 部分已有普通目标堆先按“移除来源后的普通数量 % 目标StackCap”短路；即使原包已超量，也保留正式CanReceive的既有短路，不擅自改规则。
- 完整占格以当前Query为基础减去源组旧格、加回剩余组新格。移走首成员时使用第二成员的cap/resource类别；同ID异构定义的首成员变化也按正式Query顺序处理。
- source.ResourceSlots仅从总扩容减去该来源贡献，目标ResourceSlots按同一Rule解析加回；普通格与总格两个条件、散装物资当前占格均保留。baseCap来自传入当前Query，升级值没有写死。
- query的safe组不进入普通格调整，容器内条目对总分组/扩容的既有口径继续与正式Query一致；不能按直觉另排除它们。brought/不带入标记不参与现行正式容量键，预览没有新增这类筛选。
- 显示层在 `BagCurrentView.cs:80–105` 一次Refresh内惰性取一份预览，经BagCell.Bind只传到UseStatus；详情的UseStatus按调用另取新预览。组件没有保存该快照，真正TryUse/TryChoose仍调用实时CanReceive。快照不授权命令，不能把后续库存变化反映不到旧快照当成错误。

静态成本结论可保留“O(N＋T×P)替代逐目标完整投影”，仍有当前Query、分组、目标遍历与真实UI更新，不是零分配或整帧收益。

## 发现页本体：本次未见确定的新owner/失败回归

实际读 `BagItemDiscoveryScreen.cs:20–75,91–168,183–206`、正式BagItemCommands、当前BagScreen.IsCurrent：

- current同时核runtime/State/slot/seed/地点/run/battle、Map、Bag实例与当前State、启用/栈顶/关闭及SuggestionBox。这里 `_bag.IsCurrent(_bag.Generation)` 是核当前Bag有效性，不把它描述成捕获了固定的Bag渲染世代；页面自己的_revision负责事件失效。
- FindSource只接受普通背包唯一UID；来源实体引用、完整卡定义和receipt均需一致。同UID新实体无法冒充已准备的来源。每次Bind替换事件对象并固定候选ID；选中、覆盖、禁用、关闭使旧事件失效。
- Prepare先撤销prepared；准备失败不能继续提交旧候选。最终失败只在同State/slot/地点/Bag/top且完整来源/原receipt一致时接收该同步命令回滚出的OwnedCard和Map。该路径无额外保存或随机重抽。
- 对应正式TryChoose先验证已保存receipt与当前权威卡库、替换容量，再移除源/GrantCard，同一TryPersistMutation失败恢复Source/RNG并取消deferred事件。成功观察者若换页，旧UI不关闭新页。
- 图树/按钮/CardFace保留，选中只改样式/文字/导航并把焦点交确认。Cover返回重新Prepare合法receipt，保留同ID选择，实际定义改变才更新卡面。
- 普通取消不另存receipt；过期面板只允许当前显式Escape安全退出，不写入新状态。
- Source `audio/sound.js:97–99` 和Unity AudioService:151–152均对子页click/hover先短路；当前显式click调用不会登记新鲜click进而误抑制deny。成功ding是该原生路径已有的具名成功反馈，正式命令没有第二个ding调用；未由本次检查证明实际clip/次数。

## 必要验证缺口，不能借静态预期当已验

1. `bag-check/Program.cs:24–47` 当前矩阵是room、ordinary-overfull和supplies；没有显式构造 `ordinarySlots == baseCap` 或 `used == totalCap` 的等号满包，也没改变bagUp后重新取预览。算法读当前参数看起来正确，但Root重点要求的升级/刚好满包边界缺少直接断言。建议用正式CanReceive完整“移除source”投影继续作oracle，补最短等号/差一格与升级前后快照；不要复制预览公式或降低已有断言。
2. `CurrentBagDiscoveryRound7Checks.cs` 当前主要计SaveCompleted，没有CardGranted事件数量或AudioService实际voice/sequence/clip检查。生产链静态可见TryChoose成功一次GrantCard，失败取消deferred；这不等于已测失败0/成功1事件和成功声。建议补只读观察真实CardGranted及实际ding的最短检查，恢复音量/静音，保留子页click按Source静音。
3. Native92与domain1160均只是作者的静态预期，未运行。当前window probe四图只覆盖其声明的受控路径；不能替代关闭详情旧事件、升级、全部容量边界和声学测量。

Root/Run已收到上述确定入口问题与覆盖缺口。本独审没有修改任何属地源；待作者给修后冻结差异，再做限定静态回核。
