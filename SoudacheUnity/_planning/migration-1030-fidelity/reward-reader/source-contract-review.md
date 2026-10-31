# 奖励详情并入公共卡牌阅读器

奖励详情现已复用 `DepartureCardZoom` 的同一呈现入口。`CurrentRewardCardZoom.Open` 仅适配所属奖励页的领取/整理委托，无独立卡面、幕布或授予实现。原生功能与效果验收由主线集中执行，本记录不将类型检查视作画面验收。

## 现行代码依据

- `game/src/run/chests.js:658`、`event-card-choice.js:124`、`event-branch-choice.js:96/215`、`game.run.altar.js:322` 和 `game.run.resources.js:96` 均调用正式 `UI.showCardZoom`，传 `hideNote:true`、`presentation:'expedition'` 及同一奖励动作的 footer。
- `card-zoom-content.js` 只由 `hideNote` 隐藏备注，卡面走公共内容；没有奖励专属大图尺寸。
- `winter.css:468` 通用卡牌特写使用18%幕布与18px模糊，卡面字号34，宽度沿 `cards.css` 的13.08em，即444.72px。`cover-details.css:31` 保留同一18%/18px关系。
- `expedition-rewards.css:151` 只为 `data-act^="chest"` 的底栏覆盖400px宽、58px高、25px青色按钮；未给奖励详情另设背景或卡面宽度。其他奖励动作仍用 `cover-details.css` 的浅底脚注及自然宽15px金色按钮。
- `reward-scene-view.js:90` 的 `rewardClaimHTML` 在待领取时按 `fits` 决定领取/选择或“整理背包”，沿调用者标签；选择型详情有基础候选放弃提示。非待领取不显示领取按钮。
- `card-zoom-controller.js` 在所属页面或触发者失效时拒绝旧脚注动作，退出只向仍有效的所属页面恢复焦点。

## 本次修改

1. `DepartureElements.cs` 的现有 reader 增加可选 `hideNote`、纯展示脚注描述和所属页面检查；原先不传参数的普通备注、战斗透明模式、导航边界、首焦点、SuggestionBox 隔离和备注点击屏障保持原入口。
2. `CurrentRewardScene.cs` 的 `CurrentRewardCardZoom` 改为静态适配器，接入 `LiveState`、`ClaimLabel`、`Choice/ExplicitMode`、`Fits` 与 `Organize`；不额外授予、收费或保存。
3. 卡面读取触发处传实际 `_read.gameObject`，避免鼠标操作将焦点恢复到无关控件。
4. 脚注动作先验证 reader 置顶、所属页存在、触发者仍连接、原局/档位/节点与收据仍匹配、`LiveState` 仍待领取，再关闭 reader；所属页重新置顶后再调用原业务委托。覆盖页、失效页面及已关闭 reader 的旧按钮不能重领。
5. 已领取/放弃只读时不显示脚注领取动作，不新增“返回奖励”按钮；沿右上关闭、外点与 Escape 退出。无 owner 的只读 QA 样本可以正常显示，不提供领取入口。

## 验证与未核范围

- 私有快照 `Sdt.Boot` 类型检查：0错误，10项既有警告。
- 当前源 `card-zoom-controller.test.js`：6/6通过，包含宿主/页面根/触发者失效后的旧脚注动作拒绝与阅读切换行为。源代码、CSS和测试未修改。
- 未启动 Unity、未打包、未操控前台。实际模糊、卡面尺寸、脚注排版、返回焦点、领取与满包转整理须由集中原生复验确认。

稳定动作名：公共关闭 `zoom-close`；奖励动作 `rewardZoomClaim`；选择警示 `zoom-choice-warning`；脚注根 `card-zoom-expedition-footer`。统一原生面板类型为 `DepartureCardZoom`。

## 集中原生验证建议

复用新局/入局补给完成的正式 fixture，在真实当前节点置 `Phase="modal"`，调用 `ChestOpenScreen.Open(new List<string>{"small"}, null)` 创建正式待领取宝箱。等待 `CurrentRewardScene.CanSubmit` 后点 `CurrentRewardTile` 的 `reward-card` Button，验证：

- 待领取详情无备注，公共卡宽444.72，只有 `rewardZoomClaim`；点击后原 `Take` 执行一次。保存旧 Button 引用再次调用时，收据及已拥有卡牌不能重复变化。
- 背包放不下目标卡时详情动作标签“整理背包”；点击打开完整 `BagScreen`，原 `taken/lost`、币和RNG不因整理入口而变化。关闭背包返回原待领奖页。
- 只读已领状态没有 `rewardZoomClaim`；关闭回到原触发按钮及原滚动位置。
- 原 owner/receipt/box 被替换或节点改变后旧 reader 自动关闭；捕获的旧领取 Button 调用不能修改新页。

旧 `RunRewardTransition` 仅直接点奖励卡下的领取按钮，未通过详情脚注，不能单独覆盖本次适配；应在本轮真实播放器或原生功能检查中加入上述详情路径。
