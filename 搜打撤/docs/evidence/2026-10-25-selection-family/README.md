# 选卡二级界面收尾

2026-10-25，Friday 子代理 selection_interfaces。实现完成未提交，编辑释放。老板最后明确“不用测试，改完就行”后立即停止测试、浏览器与追加检查，仅保留本记录。

## 已完成

- 首脑编组增加独立“查看详情”，查看不编入或移出卡牌；已编入状态和进度原位更新，卡面外呈现开战装备说明。
- 同一选择轮刷新保留候选横纵滚动、焦点及发现的暂选；新选择轮不继承上轮状态。候选移除后焦点落到相邻可操作卡。
- 发现方向键移动到屏外候选时只滚动所属列表，不通过焦点滚动整页；保留老板取消放大镜的决定。
- 清理首脑编组原有190px卡宽及重复选中覆盖；统一完整卡面、选中描边与独立详情。
- 修正手选网格的尺寸包含/自动宽度组合导致的零尺寸卡面，保留单行候选与横向溢出滚动。
- 献祭、消耗区复原的原网格改为保持240–280逻辑像素完整卡宽，避免为固定五列压缩正文；保留原选择、确认、容量与存档规则。
- 注能近期分页/选材反馈未改；活跃的 altar/scenes 源码未改。研究所不在范围内。

## 精确修改范围

生产源码：`game/src/battle/view/battle.decision-shell.js`、`battle.decision-content.js`、`battle.overlays.js`、`battle.discover-view.js`；`game/src/ui/discovery-selection.js`。

生产样式：`game/css/battle-decision.css`、`battle-secondary-overlay.css`、`expedition-rewards.css`、`expedition-battle.css`、`battle-hand-overhaul.css`、`cover-battle-shell.css`。

测试：`tests/battle-decision-lifecycle.test.js`、`battle-formation-reading.test.js`、`discovery-selection.test.js`、`sacrifice-layout-readability.test.js`、`pocket-restore-interface.test.js`、`hand-material-selection-window.test.js`。手选夹具仅补标准ResizeObserver桩，原有行为断言保留。

只读预览：`game/dev/selection-family-review.html`；硬阻断localStorage写入。编组使用生产renderer；手选/发现使用生产模板及本地演示动作；献祭/复原只构造原布局，不代表真实支付/复原控制器验收。

## 已有验证及边界

- `tests-final.txt`：9文件128项通过。第一次扩展检查的失败仍保留在`tests.txt`；其中设置旧选择器断言、发现缓存引用相等断言未处理，不计入通过集合。
- `eslint.txt`、`stylelint.txt`：当时所改JS/测试和6份CSS通过。末次手选尺寸修正后仅补`stylelint-reading-fix.txt`，没有再跑完整定向集合。
- 当前Codex内置1280×720自然窗口，未更改尺寸：编组真实点击三张、打开详情并返回，保留3/3及原详情焦点；发现真实点击/方向键转选，确认按钮响应；手选卡面从零尺寸恢复至约208×312显示像素。截图：`formation.png`、`discover-selected.png`、`hand-select-fixed.png`。
- `hand-select.png`保留零尺寸缺陷现场；`sacrifice.png`、`restore.png`仅证明构造布局下完整卡宽、独立候选滚动及固定动作栏。初版夹具缺MAP.rules的错误已补齐，未删除早期失败记录。
- 最后增量未完成真实对局全路径验收；没有覆盖全部存档、满容量、所有首脑、逐种支付/复原分支或最后完整日志复核。按老板最新要求不再继续验证。
- 无新服务、build、安装、配置修改、文件删除、提交或推送。共享REGISTRY由主代理统一维护。
