# 首页被覆盖样式清理

仅修改 `game/css/title-p0.css`：删除98条被同选择器后续规则或后加载的更高优先级首页规则覆盖的声明、被同名后定义覆盖的旧 homeCoverIn，以及已无引用的 akNudge。保留原规则顺序与必要的布局基底，现行字号、按钮背景、副标和交互细节沿用 home-polish.css；该文件未改。

逐属性覆盖依据见 [declarations.json](declarations.json)，定向测试、当前窗口计算样式及真实点击范围见 [verification.json](verification.json)。不同媒体条件、子元素和动画重入规则保留；dev.html 旧首页未改。

完成未提交。未构建、未跑全量，不扩大到其他页面。
