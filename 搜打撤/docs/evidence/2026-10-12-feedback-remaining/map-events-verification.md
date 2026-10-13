# 地图与事件留言定向验证

2026-10-12。复核本轮已有实现，保留共享工作树改动；本子任务新增地图双击确认回归用例。

- 首层生成器将入口邻居优先安排为战斗，并以首战前可达区域检查拒绝提前遇到火堆的候选。生成器及布局版本未提升，不主动重生成旧存档地图。
- 地图节点首次点击展示节点预览；再次点击同一可达节点才确认移动。不可达节点只能预览。右侧半透明预览与透明返回按钮由本轮 `feedback-oct12.css` 提供。
- 底部人物使用当前角色的 `sprite-v1/neutral.webp`；五个人物素材路径均存在，角色纳入工具带刷新键。
- 全屏事件模板不再输出右上资源区，事件选择与确认入口保留。攻击、金币图标由主代理在页面 SVG 定义完成。

验证：

- `npx vitest run tests/layered-map-generator.test.js tests/expedition-view.test.js tests/event-scene-selection.test.js --reporter=dot`：3 文件、29 用例通过，含 200 种子首战前不可达火堆断言。
- `npx vitest run tests/boot.test.js -t '地图首次点击|运行时按 mapSeed|fake rAF|第一层 door|enterLayer' --reporter=dot`：5 用例通过、13 项因定向筛选未运行。新用例以真实启动链上合成 pointerdown/pointerup 验证首次预览与二次移动；不是内置浏览器真实输入证据。
- 定向 ESLint 检查覆盖地图生成、远征面板、事件模板、boot 与 boot 测试。

当前窗口的静音内置浏览器实页由主代理统一核验；本子任务未操作浏览器、未新启服务、未 build、未提交。旧存档中已有火堆布局不属于新增地图保证；未重新执行整套 boot 测试或全库测试。
