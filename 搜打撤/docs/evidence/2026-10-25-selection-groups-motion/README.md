# 选中标记与分组动效普及

2026-10-25，Friday，WF-selection-groups-motion-1025。状态：已实现、完成未提交，待老板实页验收。落实上一轮剩余的三项建议。按老板要求未运行测试、lint、类型检查、构建或游戏实页，无新增服务、文件删除、提交或推送。

## 改动

1. **移动选中底板**：`game/src/ui/selection-state-motion.js` 与 `game/css/selection-state-motion.css` 增加指南章节、成就获得状态、成就陈列视图三组。通过原有 `aria-current` / `aria-pressed` 定位当前项，固定按钮命中区，只移动背景。新增监听 `aria-current`；各组保留原配色、圆角和静态状态。减少动态时使用原静态选中填充。成就分类框及照相馆页签线已有专用实现，未叠加公共底板。
2. **动态内容按语义分组**：`game/src/ui/region-transition.js` 增加可选 `enterGroups`，最多8个不重叠内容组，35毫秒间隔、105毫秒累计上限；与容器入场互斥，避免父子双层透明度。取消、离场和完成清理各组自有样式，减少动态直接呈现。`beginner-guide.js` 接标题/插图/正文；`collection-view.js` 转发详情适配器声明，`game/src/hub/hub.collection-v4.js` 接卡面/信息。没有新增逐行自动动画，不因列表长度扩大入场总时长。
3. **收窄宽泛过渡**：六份基础样式中19处 `transition: all` 改为对应控件需要的属性。`base.css` 2处、`cards.css` 2处、`hub.css` 5处、`overlays.css` 6处、`scenes.css` 2处、`winter.css` 2处。保留原时长、颜色、尺寸和已有按下反馈；尺寸、间距和布局不再被这19处声明意外动画化。未引入大范围覆盖规则。

公共说明同步到 `docs/ui/shared-interface-components.md`。本轮定向handoff无活跃属地冲突，保留共享现场与其他已完成增量；没有编辑Kimi的远征属地或其他专用动效参数。

## 未验收范围

本轮只有源码接入证据，没有实页通过结论或性能收益数字。待老板确认：指南章节连续切换与滚动后的底板位置、成就筛选/视图底板、减少动态的静态回退、指南/收藏的分组节奏，以及受影响按钮的悬停/按下反馈。上一轮三个优先项见[详情与人物动效记录](../2026-10-25-detail-character-motion/README.md)。
