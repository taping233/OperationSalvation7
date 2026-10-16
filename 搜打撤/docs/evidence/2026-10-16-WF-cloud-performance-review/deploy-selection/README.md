# 解除 deployPick 对基地整备的静态反穿

已把 deployPick 的共享 live binding 抽成无依赖的小状态模块。基地轻门面不再静态引入整备页面，原有同步 API、状态引用身份、预设规范化与全部出征生命周期留在原位置。14 个文件 141 项测试最终全通过。未改基地 runtime、CSS、存档或游戏规则；未 build、未操作浏览器或服务、未提交。

## 实现范围

- 新 `game/src/hub/departure.selection-state.js` 只持有 `deployPick` 和同步 `replaceDeployPick(value)`，不读取 window/document、档案或 DOM，也没有其他 import
- `game.hub.js` 从纯状态模块导入后继续导出原名 `deployPick`，保持 ESM live binding
- `game.hub.depart.js` 从同一模块读写选择引用，仍原样导出 `deployPick` / `setDeployPick`
- `setDeployPick` 的卡堆身份规范化、代次递增、档位标记、选角/开局回调清空仍在 depart，不移到轻门面，也不新增异步包装
- 六处原引用赋值等价改为同步替换；对象内的加减卡操作仍就地修改，推荐/撤销仍按原逻辑克隆
- `game.hub.runtime.js` 完全不改，继续从 depart 导入完整 setter；21 份基地静态 CSS 的顺序不变

## 源码边界实证

当前主 HTML 的 4 个模块入口，Acorn 静态 JS 闭包从 214 个节点变为 204 个：11 个整备/视图模块退出初始图，只增加 1 个 284 字节纯状态模块。depart 与 runtime 均不在初始静态图中。

对照只用 handoff 时无既有差异的 game.hub.js 与 game.hub.depart.js 的 HEAD 原文恢复旧边，其他人的当前源码在前后图中相同。完整节点名单及方法见 [static-boundary.json](static-boundary.json)，复现用 [verify-static-boundary.mjs](verify-static-boundary.mjs)。

这是源码可达性验证，未做 bundler、tree-shaking 或压缩产物测量。不得把模块源码体积写作实际 entry/initial gzip 改善，预算需父任务统一构建确认。

## 定向验证

最终 14 文件 141 项全部通过，0 失败/跳过，见 [final-target-tests.json](final-target-tests.json)。

首轮曾有 1 项失败：其他已完成基地任务新增房间标题映射后，runtime 的 `split('\n').length = 430`，触发原有 `<430` 行数守卫。父任务交回原负责人移除冗余空行，保留原门槛与全部业务修改；随后本轮重新运行全部 14 文件取得全绿。原始失败报告保留在 [target-tests.json](target-tests.json)。本轮未编辑 runtime。

通过范围包含：

- 新状态模块在无 DOM 环境下同步替换/原对象变更、引用身份与置空
- 全部 HTML 模块入口的静态图不会再触达 depart / runtime
- 基地轻门面的公开 live binding、首进加载、同入口去重、失败重试、取消/换档/导航竞争；测试把任何提前求值 depart 的行为设为明确失败
- 草稿换角返回保留、换档清空、预设导入、标准卡堆身份、推荐预览/应用/撤销、库存变化与保存失败保护、确认出发只提交一次
- 基地业务生命周期、Home 异步生命周期、预设整备集成、contracts、architecture-boundaries、facade-snapshot-drift
- 7 个修改/新增源码与测试路径定向 ESLint 通过；生产代码语法与自有 diff whitespace 通过
- 现行文档守卫通过，461 条相对链接；该守卫不扫描 evidence，本报告链接另作本地可达性核对

测试直接调用现有 Vitest，未走 npm pretest。最终完整输出见 [final-target-tests.log](final-target-tests.log)、[lint.log](lint.log)、[docs-check.json](docs-check.json)。

## 与第一步资产优化的当前关系

本轮只读重扫时发现其他任务的 battle.layers.js 已变更，不透明资产消费者指纹失配，发布审定按设计保守回退为 0 排除，并报告一条警告。没有为恢复体积收益刷新或绕过指纹。父任务明确待所有资产消费者冻结后统一审查更新。

因此第一步 16.12 MiB 是上一冻结状态的可省发布实体字节，不是当前混树已实现的生产包体。新构建须同时复核正确消费者指纹、别名/生成清单与实际预算。

## 交付与待核

精确 7 路径及 SHA 见 [handoff.json](handoff.json)。其中 hub-flow-regression.test.js 本轮只改成功清空引用的源码断言；同文件新增的七房间标题回归属于基地原负责人，已保留并在最终测试中一并通过。game.hub.runtime.js 与 hub.home-v3.js 在本轮前后 SHA 相同的核对已完成；父任务此后修复自己的 runtime 行数不属于本轮改动。

待父任务：手动刷新真实选档→基地→整备→更换人物/返回→重进→出发；稳定节点统一构建并量化 entry / initial JS。完成未提交，编辑已释放。
