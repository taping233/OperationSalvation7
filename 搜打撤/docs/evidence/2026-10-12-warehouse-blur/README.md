# 仓库玻璃模糊延迟修复

仓库 `.hub-page.page-in` 仍命中 `base-camp.css` 的 `camp-page-in`（200ms，从 opacity .4 开始）。外层透明度低于 1 会隔离内部玻璃面板的背景采样，已有区域不透明动效未覆盖这层祖先。

在 `game/css/base-page-motion-v7.css` 增加仅仓库外层生效的覆盖：关闭旧外层动画并固定 opacity 1 / transform none，保留内部横向区域动效。保留原有未提交改动。

按老板要求未运行测试、构建或浏览器验收，实际显示效果未核验；未提交，无新服务。