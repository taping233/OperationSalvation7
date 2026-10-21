# 公共交互统一

老板授权落实前轮源码排查中的返回按钮、详情弹层、操作结果提示和动画参数统一；沿用“不用验证”。

- 返回按钮：扩展既有 `linkedBackHTML` 支持快捷键与可见文字；背包移除手写SVG，商店主货架和收购台均复用。商店保留原底栏布局，返回目标不变。
- 详情开合：新增 `motion-completion.js`，商店详情入场/退出、卡牌大图退出和照片收回共用目标事件过滤、兜底计时、取消与减少动态效果处理。详情退场期间停止内部交互，节点移除后再恢复来源焦点；照片仍保留回到原位置的专用视觉。
- 操作提示：新增 `operation-notice.js/css`，背包道具使用结果、局内商店购买/出售/失败与基地（含交易所）提示接入。每个所属页面单通道替换，成功3200ms后清空，警告显式清除；旧计时器不清掉新提示。保存失败持续可见。
- 动画参数：照片入场与退出、普通卡牌大图退出、动画收尾裕量、提示时长、返回地图时序集中到 `motion-presets.js`；普通大图CSS与脚本使用同一退出时长。既有购物飞卡等专用演出保留。

代码范围：`game/src/ui/{motion-completion,operation-notice,motion-presets,home-linked-interactions,transition-handoff,ui}.js`；`game/src/hub/{game.bag,game.bag.view2,game.hub.runtime}.js`；`game/src/run/game.run.shop.js`；`game/css/{operation-notice,home-linked-interactions,interface-motion,transition-handoff}.css`。现行职责说明同步 `docs/architecture.md`。

按老板要求未运行测试、静态检查、实页或build。完成未提交，没有启动服务、提交或推送。
