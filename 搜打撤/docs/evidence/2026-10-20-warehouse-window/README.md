# 仓库邻屏卡面验证

2026-10-20，在独立小副本完成，未改共享主树或发布。当前行为见 [仓库卡面构造](../../warehouse-rendering.md)。

## 受控结果

200 叠**模拟库存**，调用生产 `cards.view.js/cardHTML`；jsdom 的视口与 IntersectionObserver 受控。对照使用相同源码恢复原有全量卡面构造，其他按钮和筛选代码不变，并非真实默认存档或浏览器实测。

初次复杂卡面 200 → 6（−97%），DOM 元素 5854 → 1198（约 −79.5%），200 个按钮始终保留。单次挂载 665.33 → 179.82ms；搜索末卡再清除的两次 DOM input 事件 310.15 → 73.63ms。并行测试下的耗时只作观察值，不当作稳定性能承诺。

## 验证范围

`vitest run tests/warehouse-art-window.test.js tests/hub-pages-rework.test.js tests/page-perf-hub.test.js tests/base-inventory-lifecycle-audit.test.js tests/base-ui-sample.test.js --reporter=dot`：5 文件，93/93 通过。新增 9 项覆盖邻屏、快速跳底、重复/隐藏交叉回调、End 焦点、筛选与清除、延迟读取最新库存与失效堆键、待复原、滚动恢复、切档离页及无观察器降级。定向 ESLint 与 node 语法检查通过。

完整日志和旧源不入源码；可复核路径与 SHA-256 见 `results.json`。本轮没有全量、构建或远端 CI 结论。

## 未核范围

整合后需用内置浏览器当前窗口验首屏、补卡前后滚动总高、快速拖底、筛选重排、Home/End/Tab、待复原、图片加载后的卡槽位置。受控 DOM 事件不等于真实鼠标键盘输入，当前尚无这些实页结论。
