# 第四轮：撤离整理的两入口共用状态机

本轮将 `game/src/hub/extraction.commands.js` 的 `updateCards`（入库整理）与 `finish`（完成整理）中成段重复的事务骨架归一为私有异步 `organize` 内核。相对本轮原文 **+35 / -48，净减 13 行**。这是删除一份重复状态机，没有删除锁、恢复、幂等、输入隔离或失败保护。

编辑前已核 `docs/PARALLEL-REGISTRY.md` 的新 WF-project-bugfix-1023 活跃范围，避开其占用的 game.storage/restoration/terminal/base/archive/battle-settlement 与背包发现文件；主会话确认 extraction.commands 未被该清单占用并登记本轮精确属地。只有这一个源码文件被修改。

## 逐步对应

| 步骤 | 原 updateCards / finish | 归一后 |
| --- | --- | --- |
| 默认上下文 | 两个 async 函数各自先读取 pending runId，再读取活动档位；显式参数沿用传入值。 | 相同默认参数置于 async organize 参数列表；固定命令绑定不读取 game 或端口。显式 null 和 undefined 的差别保留。 |
| 入库输入校验 | 仅 updateCards 校验选择列表并 map 成仅含 name/count 的独立快照，随后读取活动档位。 | 仅 extractStash 模式执行原校验和快照，同步位置与顺序不变。finish 模式不多校验输入。 |
| 无活动档位 | 先拒绝捕获档位不一致；updateCards 校验 pending、准备草稿后采纳；finish 构造内存回执后清 pending/runActive。 | 两条独有投影分别保留；相同档位门禁共用，没有让 finish 多做 pending 校验或让入库跳过校验。 |
| 有槽门禁 | 先 expectedSlotId，再 expectedRunId；错误原文固定。 | 同序共用，错误码、retryable 缺省值、原文完全保留。 |
| 重试令牌 | 同一个 slot/run 键查 inFlight，已有 attempt 则跳过准备。 | 同一 Map、同一键、同一先查再准备分支。没有新增进行中标记或改变并发语义。 |
| 第一个 await | 无既有 attempt 时 await readPending；随后按返回 runId 复核。 | 原位置和次数不变，无额外 wrapper await。已有 attempt 路径仍跳过此 await。 |
| 独有准备 | 入库调用 prepareCardAttempt，失败/unchanged 直接返回；完成整理构造持久回执与 null afterRun。 | 原准备代码分别保留在模式分支；只在准备成功后执行相同 inFlight.set。随机和 XP 调用仍只在原路径发生。 |
| 命令互斥 | 相反类型 attempt 返回两条不同 REQUEST_PENDING 提示。 | 仍分别匹配 extractStash / extractFinish，选择原提示；retryable 仍 true。 |
| 第二个 await | await commitAttempt(attempt)。 | 仍直接 await 同一方法一次。commitAttempt 内锁、恢复、收据、身份/修订复核没有修改。 |
| 失败销账 | 仅 STALE_REVISION 且 Map 当前条目仍是该 attempt 时删除；其余失败保留原令牌，返回原失败对象。 | 完整共用相同条件与顺序；不丢不确定提交的恢复令牌。 |
| 成功应用 | applyAttempt 在前，inFlight.delete 在后。 | 同序执行；不检查或改变 applyAttempt 的既有返回口径。 |
| 返回 | 入库返回 nextPending/count/replayed；完成返回 receipt.value/replayed。 | 保留两个结果对象各自原有字段及值，不统一成新收据结构。 |

## 异步边界与所有权

两个公开对象键 `updateCards` 与 `finish` 直接绑定同一个 async 函数：前者绑定命令，后者绑定命令及空 selections 占位。不添加新的 async 包装器、then 或 await，直接返回 async 内核创建的 Promise；参数默认表达式、输入校验与端口抛错仍在该 async 调用内转成拒绝。两条业务路径在原第一/第二 await 之间的工作没有移到新异步边界。绑定后的参数长度仍分别为 1 与 0。

selections 的第一次 map 仍在读档 await 前；同一次调用不会受外部后续修改污染。pending、afterBase、afterRun 的克隆与 prepareCardAttempt/makeAttempt 均未调整。本轮也没有把 attempt、运行态或公开输入转给新的外部回调。

已定向检索现行生产消费者 `game/src/run/game.run.altar.js`，仍按原参数 await `updateCards(selections, runId, slot)` 与 `finish(runId, slot)`；公开方法名、参数映射、成功/失败结果和 Promise 契约保留。

## 跨文件候选保留理由

- collection 与 preparation 的“读幂等收据→读基地→克隆草稿→提交”表面相同，但现行 collection 同步读取收据，preparation 明确 await 收据；强用同一个异步预备 helper 会新增或挪动 await，并改变 skin 成功重放等分支的副作用时点，本轮不合并。
- departure 与 recovery 的日志骨架已经共用 recoverable-pair。前者创建新探索、要求旧 run 为空；后者已有探索并复核 run/revision。不能把两套领域校验视为重复保护删除。
- nest 与 terminal 的重放优先级、attempt 缓存和返回结构不同；不将相似“恢复→读收据→提交”压成改变重试契约的通用状态机。
- base 的升级/保存、battle-settlement 的准备骨架本轮属于新查漏修复占用，未编辑。

## 原文与静态核对

本轮修改前原始字节保存在 `extraction.commands.js.before.txt`，SHA 为 `C10CF5FC8C22E2D2B5C3469420C51416F08CD7D425EA1BB731B7FBA06F32B215`。同目录 `manifest.json` 记录最终 SHA、逐轮增删及行尾计数，`extraction.commands.js.patch` 为只含本轮差异的仓库根相对补丁；没有用 HEAD 覆盖原未提交内容。

- 实际源码 node --check 退出 0。
- 定向 git diff --check 退出 0，只有已有 CRLF/LF 约定提示。
- 已逐项阅读相对本轮原文的完整 diff，逐步核对以上状态机、分支/返回映射与 await 边界；git diff --no-index 的退出 1 表示有预期差异。
- 引用检索仅用于核对调用契约，没有执行测试文件。

按要求未测试、build、实页、提交或推送。没有修复首轮已登记缺陷，也没有整文件删除。
