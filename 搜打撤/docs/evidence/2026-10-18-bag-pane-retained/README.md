# FB015 / FB031：背包共同刷新边界保留内容节点

2026-10-18 UTC，完成未提交。实际调用链确认：跨安全格、拖入珍珠盒、筛选、排序与使用道具均进入showBackpack(true)，旧patchBackpackPane已经保留外壳/左栏，但每次替换整个.bag-col；同区滚动值恢复不能保住卡面节点和焦点。

## 共同边界

- 同zone保留.bag-col、.bag-board、.bag-grid；区间切换仍沿原pane替换和左栏焦点路径，不建立隐藏页缓存。
- 普通/安全格卡格用当前堆UID序列作为只读data-pane-key（JSON经escAttr），不写存档、不生成UID；同名不同实例不会误复用。无UID的物资/消耗区用同类同名队列逐项匹配，不跨刷新缓存卡数据。
- 复用卡格必须同步全部属性（含删除旧dataset），逐个比较完整子节点；只保留DOM完全相等的卡面，数量/状态/模板变化更新相应节点。头部容量、工具选态、回执、空提示按当前markup更新。
- 保留当区scrollTop。焦点原本在pane内才处理：仍存在的原控件恢复，已替换筛选/排序控件找等价操作，消失卡格回邻近卡格或当前分区钮。原来焦点在外部不抢焦点。首轮专测证明insertBefore移动仍连接节点也会失焦，最终修复涵盖此边界。
- 保留grid后，bindBagDrag必须移除上次click/keydown/pointerdown监听再绑定当前库存与会话。点击抑制以grid的WeakMap记录跨本次重绑延续，防落点后的click误开详情。showBackpack既有resetBagDrag仍先终止当前手势，旧pointermove/up不能继续落账。

生产改动：bag-pane-view.js、game.bag.drag.js；game.bag.js仅bagZoneTiles两处透传uids，game.bag.view2.js仅escaped展示key。保持合成/帮助既有diff，不更改容量、库存数量、UID、安全格/容器规则或CSS。

## 验证

集中首轮9文件169项：168通过，1项焦点断言失败；原始 `tests.log` 保留。修正上述insertBefore焦点边界后，只重验受影响3文件77项全部通过（`focus-fix-tests.log`），其余6文件结果复用。

新增纯DOM6项与真实模块5项覆盖：
- pane/board/grid及未变卡格/卡面节点保留、滚动/焦点连续；删除/重排、不同UID同名牌、数量/状态/旧dataset移除、卡面模板变化。
- 筛选/排序焦点、回执与空态实时更新；100次不变patch的MutationObserver记录为0，外部焦点不被抢走。
- 拖入安全格/珍珠盒更新正确来源状态且保留无关卡格；重复刷新及替换库存数组后键盘和pointer只响应一次；拖动途中刷新清浮影，旧move/up不移动库存。
- 复用帮助返回、背包投影、锦囊容量、通行证、hub性能计数、contracts与architecture边界测试。

定向lint、node语法与相关diff检查通过，8套types通过，见 `lint.log` / `types.log`。view2资源路径/卡面引用未变，新增展示key触及opaque源码指纹，由父审后更新。

这是模块/jsdom DOM生命周期与计数验证，不是实页“无闪烁”、图像渲染或FPS结论。未使用替代浏览器，未build、开服务、提交或推送。
