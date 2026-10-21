# 可信回放fixture确定性补验

集中邻近测试原 `final-target-tests.log` 的三项回放失败已定性：不是Date.now，而是普通99库使用 `normal-sha-${battleState.token}-${index}` 的物理UID。可信fixture两次重新开战产生不同battleToken，完整初态比较在drawPile第0项即停止。这是回放初态校验生效，不应弱化或忽略UID。

本轮只修改 `tests/sts2-agent-replay.test.js` 的本地可信prepare构造。开战后，成对重建本场99库实体的drawPile引用与granted UID，使用fixture seed+实体序号的稳定ID，保留normal-sha-前缀及全部卡牌内容；普通永久持有卡的UID保持原值。生产UID生成、游戏规则与回放状态比较未修改。

新增回归核对：两次prepare的battleToken确实不同，但99库UID唯一、顺序严格一致，每个UID均有对应granted实体；原完整命令重放、篡改目标首处分歧停机、隐藏freeCast初态差异检查继续保留。

验证：目标ESLint与 `git diff --check` 通过；`npx vitest run tests/sts2-agent-replay.test.js --reporter=dot` 12项全部通过，约29.93秒。ACTION_THREW用例仍打印预期注入日志，实际测试通过。

原失败日志保持不改。编辑前字节在`.tmp/replay-fixture-before-sts2-agent-replay.test.js.txt`，自有增量为`replay-fixture-own.diff`。未改生产、未build/启服/提交。
