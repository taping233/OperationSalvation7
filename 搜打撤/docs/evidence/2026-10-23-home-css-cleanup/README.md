# 首页覆盖样式清理

删除 `game/css/title-p0.css` 中34条已被现行首页规则覆盖的声明，以及 `game/css/home-polish.css` 中的空规则。逐条清单见 [removed-declarations.json](removed-declarations.json)。

核对依据为 `game/index.html` 的固定导航分组、`ui-scale.css` 对 `title-p0.css` 的导入、`home-fx.js` 后加载 `home-polish.css` 的路径，以及选择器优先级。保留仍生效的指南27px字号、入场延迟、悬停与转场条件规则。通用字号的选择器优先级低于指南专用字号，不能当成覆盖依据。

验证：目标两份CSS的Stylelint通过，定向 `git diff --check` 通过。老板明确本轮用代码核对，不补实页验证；此前只打开当前5200首页并读取清理前属性，没有进行清理后浏览器验证。不运行构建、不新增服务、不提交推送。
