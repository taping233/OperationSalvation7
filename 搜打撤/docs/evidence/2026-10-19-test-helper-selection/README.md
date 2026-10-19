# 测试 helper 影响面修正

原反向依赖图包含 tests/helpers，但邻近遍历仅继续 game/src，菜单工厂经 helper 的真实测试被漏选。现在测试辅助模块透明传递，循环按最短已知距离去重；原业务层数、12 邻近/30 文件上限及超限全量策略保持。

验证：planner 48 项通过，包含 helper 循环与 13 个真实消费测试不会因邻近降级被丢弃。实际 game.menu.pages.js 的计划选中 15 个文件，覆盖 terminal-settlement，集中 218 项通过。此前 b4ed CI 的终局夹具缺 overlay 已在 88acf46 修复，此改进让同类问题更早进入定向检查。未运行游戏实页，本项为内部工具。
