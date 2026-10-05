# 照相馆顶部返修（2026-10-04）

## 参考与取舍

- [KARDS 官方 UI 更新说明](https://store.steampowered.com/news/posts/?appids=544810&enddate=1679046329&feed=steam_community_announcements)：顶栏把返回/主导航、资源摘要和操作区分开；借鉴其信息分组，不复用品牌图形。
- [Disney Lorcana 官方 Companion App](https://www.disneylorcana.com/en-US/app)：官方页面展示卡牌目录截图并说明收藏管理用途；借鉴“目录浏览与卡片内容分层”的组织方式，不复制其图像。

## 改动

- 移除标题前的“柒”方框和口号式副标题，保留清楚的「照相馆」主标题。
- 馆藏数改为独立的数字摘要；保留返回键与开发工具原交互。
- 筛选索引改为“照片分类 / 当前结果 / 清除条件”，搜索提示改为名称、效果或关键词；原有页签、筛选控件和状态 ID 不变。
- 在 `photo-studio-craft.css` 末尾追加顶部专属覆盖，简化旧装裱框，稳定控制后载工艺样式的最终外观；保留手机与矮窗口排版。

## 检查

- `npx eslint game/src/hub/game.cardslib.page.js tests/premium-ui-pages.test.js`：通过。
- `git diff --check -- game/src/hub/game.cardslib.page.js game/css/photo-studio-craft.css tests/premium-ui-pages.test.js`：通过。
- `npx vitest run tests/premium-ui-pages.test.js --reporter=dot`：未能启动；Vite 配置初始化触发 `spawn EPERM`。尝试 `--configLoader runner` 后，同样在 Vite Windows 路径解析阶段遇到 `spawn EPERM`。
- 页面实际效果由主会话在当前平台内置浏览器复核；本子任务没有操作浏览器或 build。

## 未核项

- 视觉与交互实页、响应式状态待主会话当前窗口复核。
- 定向 Vitest 因运行环境的 `spawn EPERM` 未验证。
