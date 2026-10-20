# 资源奖励领取体验统一

## 已实现行为

资源二选一页使用公共奖励场景的原位更新。领取后保留卡面、横向卡牌列表、纵向滚动容器及其位置；已选牌显示入包状态，其他候选显示永久放弃。领取按钮消失时将焦点交给“继续探索”。

资源卡提供稳定的奖励索引、卡牌身份与稀有度标记，整理背包按钮提供接收锚点。原有成功领取反馈入口因此可复用卡面飞入背包；缺少可见端点时沿用公共回执，减弱动效时不飞入，仍保留入包文字回执。失败领取不产生成功反馈。

主页面和放大详情共用 rewardClaimHTML。新增可选动作映射 actions.pick / take / organize；未传时继续使用宝箱原动作。资源详情在选择或整理前均展示“其余选项将放弃”，已领取结果的详情不再提供领取操作。

候选生成、概率、claimResourceReward、节点消费、存档与 nodeActionBinding 规则保持原流程。整理返回仍读取原节点候选，不重新抽取；重复领取不会再发牌或重播反馈。

## 直接验证

在独立纯快照副本执行，10 个测试文件共 147 项通过：

- event-callback-lifecycle-audit（新增 5 项资源回归）
- reward-picker-continuity、reward-acquisition-motion、reward-card-feedback
- node-reward-state、node-cancel-semantics
- reward-presentation-contract、reward-receipt-clarity
- contracts、architecture-boundaries

新增回归实际覆盖 DOM/滚动保留、领取一次、节点存档、整理返回不重抽、背包页旧回调拒绝、详情提示/动作、失败无成功反馈、成功飞入和重复点击不重播、减弱动效回执。动效端点使用 jsdom 几何桩，不能代替实页视觉证据。

相关源码和测试 ESLint 通过；两个修改的源码文件 node --check 通过。完整输出见 targeted-tests.log。未运行全量 CI、构建或推送。

## 待补验证与环境限制

当前窗口内置浏览器的资源节点实页检查待集成后统一进行；本次没有启动外部浏览器、CDP 或 headless 替代。需要检查普通/满包的主页面与详情、成功飞入、整理返回和减弱动效下的最终可见状态。

handoff 已按限定路径尝试，纯快照缺少 Git 仓库而报 git rev-parse 错误；已读 AGENTS、QUICKSTART、WORKFLOW-TOOLS、质量门和相关占用。仅编辑独立副本，自有登记用于协调，未修改基线、集成目录或其他会话代码。
