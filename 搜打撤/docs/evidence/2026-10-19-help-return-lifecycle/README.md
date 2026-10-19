# 公共帮助返回生命周期

## 已实现

`game/src/ui/overlay-return-state.js` 单源提供临时页的展示快照和一次性返回：

- `captureOverlayReturnState(root, focusTarget)` 只记录非零双轴滚动和焦点元素的 tag/id/class/data 描述，不保存 DOM 或游戏状态引用。
- `restoreOverlayReturnState(root, snapshot)` 根据稳定描述匹配重建后的元素；多个匹配或元素消失时跳过，不按子节点序号猜测。
- `createOverlayReturn({revision,getRevision,isOpen,back,restore})` 只允许来源临时页的一次返回。已关、正在关闭、更新页、重复回调均失效。只有 back 同步完成一次页面替换才恢复展示状态；领域/session 校验仍归 back 的拥有者。
- `overlay.showHelp` 默认接入以上机制，兼容现有 `before()/back(state)`；无 back 时保持无操作。按钮、Esc、共享关闭入口均使用显式 `data-cancel=true` 的 helpBack。

覆盖实际消费者：背包、商店购买、商店收购台、撤离整理。商店两个入口通过公共 showHelp 自动接入，未修改其他会话的 game.run.shop.js。背包去除专用帮助 DOM 恢复闭包，保留分区/筛选/排序及原对局/卡数组有效性检查。撤离回调增加档位、页面版本和 pendingExtraction 身份检查，并保留提示及完成确认状态。

## 验证

批量完成后集中运行7文件：`help-return-lifecycle`、`bag-help-return-continuity`、`overlay-dialog`、`extraction-flow`、`shop-transaction-lifecycle`、`contracts`、`architecture-boundaries`。首轮103/105通过，2项新测试因尚未执行开帮助的初始聚焦帧而误判为返回抢焦点；修正测试先清空初始帧后，仅补验新文件11/11通过。合计105项定向通过。受影响源码与测试定向 ESLint 通过。

新增覆盖真实商店购买/出售的按钮与Esc返回、双轴滚动和入口焦点、无交易副作用、旧页/新帮助/关闭/换会话拒绝、一次性返回、before兼容、稳定key重排与歧义跳过；撤离实际流程覆盖确认状态保留及档位/pending改变后拒绝旧帮助返回。复用既有真实背包7项及overlay可访问性测试。

## 边界

这些是 jsdom 合成交互和源码契约，不是浏览器实页或视觉验收。当前平台实页环境阻塞，未使用 headless/CDP 或外部浏览器替代。尚需当前窗口确认四类页面真实滚动容器和视觉焦点位置。公共恢复限定同步重建；未来异步临时页需另建显式完成协议，不复用该回调冒充异步已完成。没有全量路由重写、玩法变更、build、commit、push、新服务。既有未提交改动保持原位。
