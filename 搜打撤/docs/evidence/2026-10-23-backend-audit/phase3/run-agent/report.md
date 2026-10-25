# 第三轮：Run / Agent 覆盖补查与删除

2026-10-23。本轮补查了此前没有完整核过的动作路由、记录器、观察投影、策略剩余分支、容量/模式工具与装配入口；并对当前 Run / Agent 的 **77 个 JS 文件**做静态词法读引用检查。实际只在 3 个文件实施可证明的等价精简：**+24 / -40 行，净删 16 行**。

没有删除任何整文件；没有运行测试、构建或游戏实页；没有修改原先登记的分类/卖牌/死因等 bug。冻结地图、随机流、超时/取消、回放保护及保存返修属地保留。

## 已实施与逐步核对

### 1. 合并两套反向邻接与 BFS

`game/src/agent/agent.policy.js`：+22 / -25。原出口导航与残血导航各自构造同层反向邻接、初始化多目标距离 Map，并逐层展开。现在共用私有 `layerTargetDistances`；两处各自保留目标选择。

- 邻接仍按节点编号递增、每个节点原 next 顺序，保留 `tl === li && ti != null` 条件；未增加/删除边，也未调用随机数。
- 出口目标仍按原顺序选择 door、emergencyExit、已解锁 extraction；锁着终局撤离时仍按节点编号追加 boss。原逻辑用 `dist.has(i)` 防重复，初始化前改用同一目标数组 `targets.includes(i)`，整数节点编号的成员关系与入队顺序相同。
- 残血目标仍按原顺序选择 fire、emergencyExit、已解锁 extraction。
- 两者都继续以目标距离 0、先进先出队列、首次发现距离 +1 展开；共享函数只返回同样的距离 Map。
- 两处原有条件、取层方式、try/catch、空目标处理、max 距离、梯度与评分不变。无有效层图或构图异常仍由原 catch 回退，未增设新决策。
- 只移动纯层图数据的边读取；地图层图来自当前运行时生成/恢复数据，不执行调用方回调。原分类常量和出售排序片段未变。

### 2. 删除回放内部单纯转发

`game/src/agent/agent.replay-state.js`：+1 / -5。私有 `rulesRng(snapshot)` 只返回 `rulesRandomSnapshot(snapshot)`，仅被 `readReplayState` 调用一次。直接在同一位置调用已同步导入的 `rulesRandomSnapshot(Random.snapshot())`，不移动取 RNG 快照时机、不过滤新字段、不改变规则流名单或回放对象。

### 3. 删除公开入口外的重复透传层

`game/src/run/game.run.js`：+1 / -10。原文件已经同步导入 `game.run.dev-loader.js` 的三个函数，再用三个同名函数仅做转发。现在直接同名导入、继续按原导出列表导出 `devForceBattle` / `devJumpNode` / `openDevConsole`，没有删除公开接口。

`game.run.dev-loader.js:14` 的实际实现动态导入仍留在 loader 的调用链内部；三个 loader 公共函数仍在 `:103-105` 调用 `enterDevTools`。本次没有新增静态依赖、提前导入开发实现、搬动忙碌/归属/异常处理，也没有把普通函数换成另一个箭头包装。

## 覆盖与引用依据

逐文件结论与当前 Run / Agent 直接消费引用见 [coverage.md](./coverage.md)。77 个文件逐条列明：人工纯逻辑审查、只做声明/词法检查的页面混合模块，或保存返修/旧地图保护边界。不能把“解析过”解释为完整业务验收。

[scope-scan.json](./scope-scan.json) 保存每个文件的公开导出、局部 import 消费方及行号、未消费私有绑定候选。检查使用现有 Acorn 解析器与 eslint-scope 读取词法引用，不执行游戏模块。公开导出、回调参数不作为删除候选；逐个核过其余无读引用绑定后，本轮扫描结果没有剩余私有死绑定。未以“当前两目录内没有 import”删除公开门面或 QA 入口。

本轮人工新增/补足的主要结论：

- `agent.action-router.js` 的完成凭据、active、promise、上下文与错误转换均有真实消费者；保留。`agent.state.js` 的热加载查询、失败 TTL、签名缓存与各投影分别服务命令/策略，未判为重复状态。
- `agent.recorder.js` 的局驱动来源、干预、停止原因、战斗流水及 CSV/JSON 出口都有记录/导出消费者；没有删除诊断事实。`agent.weights.js` 的合并入口与默认权重保留，未动原先记录的未消费配置键。
- `game.session.bag.js` 的容量/堆叠/区域修正与卡面刷新有当前会话消费者；`game.session.modes.js`、`game.session.kernel.js` 的公开工具、晚绑定端口与活绑定保留。
- 事件、商店、节点恢复/奖励的纯状态模块都有具体调用；拒绝过期操作、失败保留与防重入条件未按“看起来多余”删除。发现/保存及大战斗结算控制器仅核声明引用边界，不进入返修属地。
- `game.run.class-choice.js`、`game.run.dev-loader.js` 的缓存与装配有调用和生命周期作用；保留。大体量混合页面、DOM、动画、图像与 CSS 不做冗余修改。
- 旧 3/9 生成/恢复、不同版本配额、路线逆变换和有不同返回语义的 BFS 保留。除了本轮策略中相同返回语义的两套距离算法，没有把地图路径查询、场景下一步导航或连通性检查合并。

## 静态验证与现场保全

- 修改前逐份保存完整 `*.before` 与 `before.json` 的 SHA256；复制后与本轮结束均验证基线哈希未变。
- 3 个改动文件逐一 `node --check` 通过，限定 `git diff --check` 通过，退出码均 0。
- 静态引用核对：`layerTargetDistances` 有两个调用；`rulesRng` 及三个 Impl 别名不再残留；原 loader 入口与唯一动态实现导入仍在。
- `*.diff` 是本轮相对各自原文的准确差异；`after.json` 保存当前 SHA256 与各文件 +/−。前两轮及其他会话已有变更均不计入本轮统计。
- 未提交、未推送。没有新增整文件删除清单。
