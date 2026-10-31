# 奖励腾位焦点：代码对照及交付

生产修改已冻结，仅修改 `Assets/Scripts/Sdt.UI/Screens/Run/CurrentRewardCapacityOrganizer.cs`。当前 SHA256：`8771720d19112bf9ad383569cba7396c3a150f18a0f8404e7307a27e11a715a1`。

现行来源为 `搜打撤/game/src/ui/reward-capacity-organizer.js` 的 `render`/动作分派/末尾焦点恢复，业务入口为 `game/src/hub/game.reward-organizer.js`，现行样式为 `game/css/expedition-rewards.css:190–203`。Unity 活跃入口来自 `CurrentRewardScene` 两处及 `EventDialogChoices` 的容量处理。原 Unity 清空重建行与底部按钮，没有重新设置 EventSystem 选择；源代码有明确的连续决策恢复。

本次复用现有正式整理器与原库存命令，增加 action、首 UID、旧行索引的焦点恢复：进入丢弃确认选择“保留”；保留回原卡丢弃入口；移动/确认后优先原 UID 的同操作，再用原索引的相邻行；同操作禁用时选该行丢弃入口；列表空时选返回。仅恢复选择，不自动提交、不自动领取、不自动离开。重建保留列表位置；被覆盖页的旧“保留”回调受现有 Live/忙碌状态限制。容量变化拒绝领取时按源代码给提示并选择返回。

初版生产快照（SHA256 `f9b45b16ecae83065b100314747d2ec41820ed4f00880b2f4de095e4be7d6e27`）`Sdt.UI` 类型检查通过：0 error，10 条已有 warning（`typecheck/latest.log`，输入字节见 `typecheck-inputs.json`）。现行源测试全文件 18/19，连续键盘焦点 9/9 定向通过（其余10项在定向运行中跳过）；原始结果均保留，见 `source-tests.json`、`source-focus-tests.json` 和 `receipt.json`。

Root 首次原生验证 `fidelity-1030/organizer-focus-1` 在连续 Submit 后的空列表步骤失败：选择对象与查询对象同名而身份不同。代码核对确认 `Destroy` 延迟至帧尾，旧实现按名称 `Find` 能再次找到已经停用的旧 footer，使中间 footer 仍处于活跃状态。现仅改3行，使用专有 `_actions` 引用关闭当前 footer 并更新当前引用，防止同帧连续重建产生多个活跃 footer。静态引用及替换顺序检查通过；保留原生连续 Submit 用例，未改 probe、未重复全编译，当前 SHA 待 Root 集中原生复验。

源全文件失败为旧测试的对象身份假设：`syncViewChildren` 将旧 safe 按钮复用为当前 keep，测试再次 `old.click()` 实际执行保留，然后对不存在的 confirm 调用 click。实际源模块+jsdom复现见 `source-reuse-diagnostic.json`：按钮确实仍在当前 root、当前动作 keep；没有移动/丢弃，3 张保留。未改源测试，也未将这条测试假设迁入 Unity。该诊断在 Node 中忽略样式导入，不代表渲染验证。

原生验证由 Root 集中执行。已落盘 `Assets/Editor/CurrentRewardOrganizerFocusValidation.cs`（SHA256 `2648b15221b9d9403b894a8e6052a73d6605da141005faad63a908fd2097d7a4`）及 meta，入口 `Sdt.Editor.CurrentRewardOrganizerFocusValidation.Run`；它使用正式组件、实际 EventSystem submit、隔离档案与受控卡堆，覆盖确认/保留、同堆/邻行、空列表、安全格新状态失败、写失败保留确认、滚动位置及覆盖页回调。未在本任务运行 Unity；该新增 Editor probe 尚待 Root 编译/执行，可由 Root 在集中 Standalone 流程复验同等用例。

没有修改源 Vite、库存命令、事务、UI 公共组件或其他代理文件；没有启动 Unity、前台操控、提交或删除。
