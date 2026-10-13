# 黑框代码层面续查

老板反馈移除关闭键后仍出现黑框，明确本轮不需要测试。仅查源码与样式，不使用浏览器，不跑测试或构建。

已确认的代码冲突：静态 page-transitions.css 仍对成就页 ag-header、ag-summary、ag-content 播放 ptBlockIn，当前成就页已有 surface-motion 标题/摘要入场与 achievement-motion 奖章/详情动效；achievement-motion.settleEntry 仅取消 data-surface-role 的 CSS 动画，未处理旧 ag-header/ag-content 的动画。旧整栏透明度/位移会与当前内容动效叠加，详情遮罩又跨过页头，存在额外合成变化。删除这三条仅成就页的旧动画规则，保留现行成就动效与其他页面规则。

成就页 #ovBody 只设高度和padding，未约束外层溢出；补 overflow:hidden，滚动继续由现有 ag-scroll 和 ag-detail 自行处理，避免内容与详情动画影响外层滚动区域。

这些修改消除了已查明的重复动效和外层溢出路径。没有捕获黑框原始帧，不能将它们认定为已证实根因，也不宣称实测修复。依老板指示未测试/未实页；完成未提交，无新服务，未build未提交。