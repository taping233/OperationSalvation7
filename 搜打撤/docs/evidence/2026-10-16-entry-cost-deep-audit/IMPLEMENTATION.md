# 首屏两个小项实施交接

已按主任务追加授权完成两项小改，11 文件 113 个定向测试通过，0 失败/跳过。源码/新测试定向 ESLint、425 个项目文件语法检查、文档守卫和自有空白检查通过。未 build、未操作浏览器/服务、未提交/推送；预计仅约 1 KiB 级首屏 gzip 减少，不能承诺预算达标。

## 精确修改

1. `game/src/agent/agent.runner.js`：原有 Channel 闭包/能力判断/queue/defer 分支保留，Channel、handler 和 start 移到第一次实际用该 Promise executor 的 `if (!ch)` 中。Node 仍优先 setImmediate、浏览器并发 FIFO 不变，未拆 runner 任何业务状态
2. `game/src/ui/transitions-director.js`：移除 comm-feed 静态 import，在原 has('commDemo') 参数条件内启动动态 import。Promise 在本模块缓存，成功保持占用以防重复挂载；加载或 mount 异常统一 catch 后记 warning 并释放失败缓存，所有转场监听/观察器仍同步安装。动态加载期间若已进入 battle，mount 后在同一个任务内同步隐藏 demo，后续继续由原 demo 的 mode listener 控制
3. `tests/agent-channel-pump-lazy.test.js`：正规模块导入的四项调度回归
4. `tests/comm-demo-lazy-entry.test.js`：参数边界、加载/挂载失败、冷加载跨战斗与转场同步启动的五项回归

`implementation.patch` 是相对本子任务实施前两份源文件的精确增量，并包含两个新测试；没有把他人此前的 runner 改动混入。`agent.runner.before.js` / `transitions-director.before.js` 保留当时原字节，`source-fingerprints.json` 是实施前与 R4 的核对，实施后指纹与验证见 `implementation-receipt.json`。

## 验证结果

- `implementation-tests.json` / `.log`：11 文件、113 项全部通过。包含两个新专测、agent-command-results、agent-runner-abort、agent-runner-driver-restore、agent-run-provenance、agent-tool-lifecycle、agent-scenes-lazy-boundary、comm-feed-lifecycle、contracts、architecture-boundaries
- 新 Channel 专测验证 import 无端口、首次浏览器 wait 创建一次、双并发及再次 wait 的 FIFO、Node setImmediate 优先且零端口、无 Channel 的 timer 兜底
- 新 demo 专测验证无参数不求值该动态模块、commDemo=0 仍遵从原 has 语义、DOMContentLoaded 重发不二次挂载、动态加载失败和 mount 失败都已 catch、冷加载窗口内进入 battle 后初始保持隐藏；无参数与加载失败时 gateSweep 都仍同步可用
- 原 comm-feed 四项生命周期测试继续验证六条消息/typing/progress、重复 mount 防重、关闭后 timer/observer/mode listener 释放和宿主移除兜底
- `implementation-lint.log`：两源码、两新测试 ESLint 退出 0
- `implementation-syntax.log`：425 个项目文件语法检查通过
- 文档守卫 `workflow docs --json` 退出 0，ok:true；结果 implementation-docs.json
- 源码 diff whitespace 与两新增测试 trailing whitespace 检查通过

初次两个新测试的运行记录 `new-tests.json` 为 8 通过/1 失败：Vitest 会把故意拒绝的 mock 模块工厂错误包成 cause，原测试错误地要求外层错误对象等于原错误。测试改为验证 warning 只有一次、文字匹配、cause 或原错误等于该失败对象，生产代码未因这一夹具问题改变；最终 113 项覆盖已包含修正后的测试。

## 体积与未核项

- 实施前 199 个静态 JS 模块，实施后 198；comm-feed 已不在常规首屏静态 .js 闭包，仅由参数入口触达
- 原冻结 R4 中归属 demo 的八个压缩声明合计 3199 B，移走这些声明的 entry gzip 诊断差 1235 B。动态 import 与错误处理胶水会吃掉部分收益；必须由主任务下一次统一构建得出真实差值
- MessageChannel 变更只减少不必要初始化，源码片段略增；没有用它声称包体、时延或 FPS 提升
- 本轮没有重新产物验证、真实浏览器 turbo 首次让位、demo 参数页面实检、远端 CI 或完整游戏全量门。请主任务沿用当前实机窗口安排适量验证，并在稳定冻结节点统一构建
- 未修改冻结 R4、生成清单、预算、CSS、玩法、正常记录持久化、runner 的共享完成证据/取消/忙碌协议或其它源文件；更大 runner 拆分仅保留审查意见
