# Hub / run / boot 实现类型检查

最终本域已冻结：完整 11 配置类型检查与全域 ESLint 均退出 0；真实实现覆盖 537/537，strict 实现 49/537。首次阶段及独立集成发现的失败保留为历史证据，不能把首次局部通过当作最终联合全绿。所有运行 JS 沿统一 runtime 基线，既有 strict 配置未降级。

## 修改边界

精确清单见 hubrun-files.json。补齐 GameState 的地图几何、研究所符文、会话端口与撤离待办模型；新增纯类型 session kernel / preparation 合同，类型声明不引用生产入口以免扩大既有 strict 依赖图。公共 store snapshot 对新增纯数据字段保留递归只读，对地图、相机、hover 等活对象保留原引用合同。GameMap 仍只强制存储真正需要的血量与攻击规则，HUD 的 bagSize 为可选。

页面修改以 DOM 节点/事件来源的类型标注、可选回调参数和已知命令结果的判别收窄为主；未添加 ts-nocheck、ts-ignore、any 字典或因报错而排除源码。恢复日志保持原修订、锁和提交顺序。研究所的同步/异步战斗启动回调兼容分支显式判断 Promise；祭坛结果页用已有 type='fire' 判别保护访问。少量调用删除了接收方从未读取的兼容入参；未添加玩法、存档字段或改随机流。

## 验证

- 全域 runtime 实现诊断日志：.tmp/hubrun-final-types.log；本域 0，日志中的 battle.resolution.domain.js:224 由战斗代理收尾。
- 定向 12 文件、199 测试通过（退出码 0），覆盖基地变更、存档锁、elapsed、出征事务、撤离恢复、战后恢复、session 浏览器边界、boot、地图连通性及页面架构。命令与输出摘要见 .tmp/hubrun-tests.txt；该日志显示 12 passed / 199 passed。
- 补充 snapshot 声明后，jsconfig.json 与 jsconfig.framework-boundaries.json 均通过（退出码 0）：.tmp/hubrun-store-types.txt、.tmp/hubrun-boundary-types.txt。符文 snapshot 反例现在传完整有效 Rune，避免把错误输入误当只读验证；另保留新增符文属性数组的只读负例。
- 未运行 build、安装、服务、浏览器、提交或推送。原框架未提交现场保留。

## premium-ui-pages 换行适配

原测试直接读取源码，并用跨行模板字符串 toContain 验证 hubAct 在 currentHub 失效时早退、有效时转发 action(...args)。Windows 工作区测试文件的 CRLF 与本次编辑源码的 LF 不同，使字节匹配失败；函数正文没有变化。

调整前：readFileSync(path, 'utf8') 与未规范换行的跨行期望直接比较。
调整后：读取文本与该跨行期望均将 CRLF 规范为 LF，再做原 toContain。原 currentHub 早退、action 参数转发、整段函数结构均保留；未删除或改弱业务断言。此测试已包含在 199 个通过用例中，交父会话独立集成复核。

## 冻结

本域实现与专属类型/测试已完成；最终全域计数、旧 10 配置及 CI/浏览器边界由父会话统一集成记录，不在本域重复全量。

## I-03 集成回归修复与最终冻结

首次独立全量原红灯见 `.tmp/types-integration-accepted/test.log`；本域没有覆盖或删除原日志，也未运行第二次全量。

- 恢复 nodeOpt、grantEventCard、openPocketRestore 的具名延迟包装，恢复原 UI.log、候选开局日志、openDevConsole 完整参数转发。只以 JSDoc 元组检查边界，没有修改 mock 补出口。
- 恢复庭院 view、Warehouse/Archive/Trade 注入字段、归档/交易台 art、expedition cardHTML。兼容额外字段用 unknown 声明，保留原对象求值、hook/spies 与调用时机。
- 撤离继续使用先前捕获的 continuing；火堆恢复原无早退读取；slot lock 和研究所恢复原 then/可选链；性能条目保持缺失 scripts=undefined。所有本轮机械改写的 if (!result.ok) 恢复原真值表达式，仅在对应分支内补类型注释。
- 原生 Space/Enter 完整短路语句恢复，伙伴交互测试未放宽；可选 DOM 链逐项核对，原本可选的后续访问仍为可选，没有新增 HTMLElement 早退。
- 当前 game.bag.settle 的 TRANSITION_ART/retreat art/presentation 属其他已释放任务，duration=1050 保留。本域没有回滚；nightshift 现态用例通过。

### 地图冻结证明

`hubrun-I03-frozen-ast.json` 记录旧生成器、layeredMap、route-overlay 的 HEAD/当前字节与规范化运行 AST 摘要。三文件剔除位置、注释及 raw 后 AST 完全相同，才更新完整源码字节指纹。新增 map-type-annotation-freeze 测试独立固定原运行 AST。地图输出金样例与旧 createLayeredMap 函数 hash `1377e373…` 都没改；函数 hash 仅在比较前将平台 CRLF 规范为 LF，仍检查同一原正文。

### 最终验证

- I-03 最短失败组首轮：11 文件 188 项，187 通过、1 个旧函数 CRLF 指纹失败；没有 nodeOpt 未处理错误。原日志 `.tmp/hubrun-I03-tests.txt` 保留。
- 保留旧函数 hash，修正换行后：2 文件 19 项全部通过，`.tmp/hubrun-I03-map-final.txt`。
- 最后恢复 Promise/日志/boot 原语义后邻近复验：研究所事务、研究所回归、存档锁、boot 共 4 文件 47 项通过，`.tmp/hubrun-I03-final-neighbors.txt`。
- 最终完整 11 配置退出 0，537/537 实现、49/537 strict，`.tmp/hubrun-I03-freeze-types.txt`。
- 最终全域 ESLint 退出 0，`.tmp/hubrun-I03-freeze-lint.txt`。

最后五份变动 game.boot、base、game.hub.runtime、preparation.view、game.nest 均是上述原表达式恢复；最后类型与 lint 回执晚于这些源码。当前源码全部冻结，精确路径与 SHA256 见 `hubrun-I03-manifest.json`。两个素材 opaque 消费者 hub.presentation / lab.ending 由 foundation 独立核对资源路径 AST/输入映射，相同动态 URL 分别为 2/1 个；已通知其统一签指纹，本域不写素材审查索引。无未解决的本域已知红灯，联合全量与实页交独立 integration 验收。

## 最终稳定全量的两项测试合同跟进

原失败保留于 `.tmp/types-integration-final2/test.log`，本次只改目标测试与本证据，没有改生产源码。

- premium-ui-pages 原断言仅匹配 `return archiveV3HTML(` 字串，会被类型兼容调用的 JSDoc/括号打断。现用 Acorn 精确比较完整 hubAchHTML 函数运行 AST：函数名、单参数、直接返回 archiveV3HTML、base/meta/cards/art/view 五字段及求值顺序都必须相同，只剔除位置、raw 与注释。没有放宽页面业务合同。
- r7a-scenes-integration 保留四冬层完整顺序与全数组严格相等，追加另会话已授权的 retreat 精确资源 URL。预期独立写明资源路径，不借用生产 TRANSITION_ART 常量，防止同错掩盖。
- 两目标文件 12 用例全部通过，退出 0，日志 `.tmp/hubrun-final-contract-tests.txt`；两测试 scoped ESLint 退出 0，日志 `.tmp/hubrun-final-contract-lint.txt`。测试 SHA 另记 `hubrun-final-contract-manifest.json`。这两份测试已冻结并交 integration。
