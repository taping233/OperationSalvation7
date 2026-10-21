# GameStore 快照隔离整改

已完成定向实现与回归验证。`getSnapshot()` 对会话普通对象/数组字段统一递归复制并冻结副本，覆盖 `nodeRewards`、`entrySupply`、`pendingEventLoot`、`pendingExtraction`、`pendingRunePick`，以及以后增加的普通数据字段。旧快照不会跟随真实领取动作改变，原始状态仍可写。

## 合同与边界

- `map`、`hover`、`moveTarget`、`altarFrom` 仍保留原引用；`rings` 保留原来的一层行复制，行内节点仍是实时对象；`discoveredPairs` 仍转换为冻结字符串数组。
- 未知可枚举字段（含 Symbol）按数据默认策略处理：普通对象、无原型字典、数组隔离；不新增宽泛类型索引，未声明扩展仍不可经 `GameSnapshot` 类型直接访问。纯数据类型须在 `GameState` 中显式登记。
- 函数与带原型对象（包括 DOM）属于不透明运行态引用，不遍历、不冻结；普通数据容器上的访问器保留描述符且复制时不执行 getter。此类运行态端口不承诺内部快照隔离。
- `WeakMap` 保留同一快照中的共享子图和循环关系（包括扩展字段回指根 state）；不同快照各有副本；保留 `undefined`，仅冻结副本。`inventory` 扩展纯数据现在也递归只读。
- `EntrySupply` 和五类 `NodeReward` 根据现存节点验证器声明；待撤离与符文记录采用可变 `SessionData` 容器，由对应功能保有具体结构。快照一侧递归只读。

## 验证

工作目录：`D:/素材/代号柒/搜打撤`。以下最终命令均退出 0。

1. `npm run test:target -- tests/game-store-snapshot.test.js tests/game-store-types.test.js tests/contracts.test.js tests/architecture-boundaries.test.js`：4 文件、62 项通过。其中快照 4 项覆盖真实 `claimEntrySupply` / `claimResourceReward` 领取、领取前快照稳定、待领取深层写入拒绝、未知扩展/环/别名/无原型字典、DOM/实例/函数/访问器不透明边界和既有运行态语义。
2. `node node_modules/typescript/bin/tsc --noEmit -p jsconfig.json --pretty false`：通过；fixture 验证状态仍可写、奖励/待领取快照不可写、错误字段类型与未声明扩展不可访问。`@ts-expect-error` 的无效化也会令该门失败。
3. `node node_modules/eslint/bin/eslint.js game/src/hub/game.store.js tests/game-store-snapshot.test.js`：通过，无警告。
4. `git diff --check -- game/src/hub/game.store.js game/src/hub/game.store.types.d.ts tests/game-store-snapshot.test.js tests/game-store-types.fixture.ts`：通过；Git 只提示 store.js 将按仓库规则规范行尾。
5. 用只读 `git show HEAD:搜打撤/game/src/hub/game.store.js` 在 Node 内存模块加载旧实现（仅替换外部 facade 注册为空函数）并修改真实补给/奖励领取字段：输出 `HEAD regression reproduced: old snapshot changes after live claims = true`，退出 0，证实原缺口。

首轮回归遇到 Node 环境缺少 `document`，已将快照专测设为 jsdom；类型 fixture 中负例赋值触发 TypeScript 控制流窄化，已调整断言顺序；访问器专测与 Vitest 对象诊断隔离后通过。没有更改项目测试配置。

集成复核 S1 指出顶层原先的 `Object.entries` / 展开仍会执行 getter：已将顶层和嵌套构造统一为读取 own descriptor，访问器不求值；根 state 先登记到 `WeakMap`，避免回指根产生第二份副本。新增抛异常的顶层 getter 与根回指断言，最终定向 62 项、类型、lint 和 diff 检查再次退出 0。访问器的动态返回值明确属于运行态端口，不承诺快照隔离。

## 未核范围与现行文档建议

未运行 build、全量测试、全仓类型门或实页，交联合验收会话按公共边界风险补充；未启动服务、提交或推送。现行 `docs/architecture.md` 的 GameStore 说明可补充“普通会话数据隔离只读，地图和交互端口保留实时引用”；本代理没有修改共享现行文档。

本片仅修改 `game/src/hub/game.store.js`、`game/src/hub/game.store.types.d.ts`、`tests/game-store-snapshot.test.js`、`tests/game-store-types.fixture.ts` 与本证据；父任务 `WF-framework-solo-1021` 统一登记。
