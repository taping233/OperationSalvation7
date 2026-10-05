# 成就界面比例修正

2026-10-04 21:04（北京时间）；HEAD `425d03920e4323b016433419ec11aec4a7f3795b`，本地 upstream 引用领先53、落后0，远端未刷新。

根因：`#ovBody` 是 flex 容器，陈列室子项宽度自动按内容收缩，实际仅919.65px，而父容器1309.33px。仅在 `game/css/title-achievements.css` 陈列室根规则增加 `width:100%; min-width:0`；既有成就制作成果完整保留。

Codex 内置浏览器（cua），origin `http://127.0.0.1:5200`，当前1309×764窗口、DPR1.5，无尺寸覆盖。修改后陈列室、标题与三栏主体实测宽度均1309.33px，与父容器一致；同窗口A/B字段见 `browser-23a2dc06-7e80-47a5-8b0c-6f815f6224b4-comparison.json`。原始快照 `before.json` / `after.json`；截图 `before.png`、`after-list.png`、`after-grid.png`、`after-detail.png`。

真实输入：主页打开成就、列表滚动、集中/分列切换、打开/关闭首枚奖章详情；外观无右侧留白或裁切，console捕获error0。计算样式只读采集，不构造存档或合成事件。

`workflow verify --tests tests/achievement-gallery.test.js` 6/6通过，报告 `2026-10-04T13-02-00.603Z-a2e7d1d3.json`；CSS路径计划为skip，不将其计作通过。其他窗口尺寸、解锁档表现、性能、全量与远端CI未核，本轮未提交未推送增量无CI覆盖。未build；复用既有5200服务未启停。
