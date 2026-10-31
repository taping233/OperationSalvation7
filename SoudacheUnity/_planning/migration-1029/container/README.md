# 容器与占格移植证据

现行来源：`搜打撤/game/src/core/card-capacity.js`、`core/bag-render-derivation.js`、`hub/bag-inventory-commands.js`、`hub/run-rescue-cards.js`。

实现保留一个OwnedCard列表，使用stored/pouchOf标记容器位置。GameRuntime的CardStacks、UsedSlots、SafeUsed、BagCap、GrantCard和AddItem统一调用容量入口，未另建背包状态。

- 装备每张一格，其余同名每三张一格；散装物资每三件一格。
- 每只珍珠盒额外提供9个仅用于资源的格子，容器内资源不占背包格；安全格内盒也计容量。
- 多个锦囊仍只由首只提供3张法术容量；容器转移按实际显示堆叠或明确UID提交。
- 取出整叠按最终普通/资源格分别预检；最后一只非空容器不能丢弃。
- 安全格珍珠盒在失败时保护stored且无pouchOf的内容；放弃另排除本局带入卡。
- 存入、取出、安全格移动及丢弃复用TryPersistMutation，保存失败恢复原OwnedCard列表状态。

`source-fixtures.mjs`直接执行现行JavaScript生成6组对照，`ContainerChecks.csproj`执行生产C#源码逐项比较区域标记和占格。`data-20261029-132330-430/result.json`记录25条断言通过，另含真实文件写失败/重试及嵌套容器声明存档恢复检查。音频/Unity平台口由测试适配器替换，原生界面由主会话验收。
