# 共用卡牌透明框

13款运行素材来自老板确认的等宽重绘框：初始、古朴、稀有、史诗、传说、衍生、棱彩；五位角色职业框与职业素框。使用内置image_gen生成，完整提示词和1024×1536原始PNG保留在game/art-source/card-frame-study-1014/。

本目录为512×768透明无损WebP。按原图宽高比等比缩小，透明度与黑/白背景上的可见像素均通过无损编码核对；不切片、不拉伸花饰。13张合计1,485,570字节，最大单图146,622字节。转换与来源SHA256见docs/evidence/2026-10-15-card-face-integration/。

game/data/card-frame-layout.json维护透明开口坐标；card-frame-presentation.js负责框体选择与等比位置。费用、类型、卡名、规则与光效由共用cardHTML和card-layout-selected.css独立排版。
