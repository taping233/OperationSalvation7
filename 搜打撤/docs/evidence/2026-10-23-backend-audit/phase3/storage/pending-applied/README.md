# 第三轮追加：协调释放后的三项精简

主会话已收到活跃返修的精确属地确认：其编辑范围限于顶栏、覆盖层和战斗决策壳及对应测试，三个 hub 文件可以编辑。本轮逐文件核对当前原始字节 SHA 与预备补丁基线一致，再逐一执行补丁预检和应用，保留已有未提交内容。

| 精确源码路径 | 本次独立增删 | 改动 |
| --- | --- | --- |
| `game/src/hub/base.js` | +12 / -22 | 两个同构蛋计数持久化函数合并为私有 `persistEggCounter`。 |
| `game/src/hub/battle-settlement.commands.js` | +2 / -2 | 删除对两个独占私有 JSON 快照的二次 clone。 |
| `game/src/hub/save-archive.js` | +1 / -1 | 删除本地 validSlot 实现，改用现有共享工具。 |

本次追加合计 **+15 / -25，净减 10 行**。连同第三轮先前 `preparation.sources.js` 的 +1/-1，存档组第三轮合计 **+16 / -26，净减 10 行**。没有整文件删除、公开 API 删除或首轮缺陷修复。

## 数据所有权与回调顺序

`base.js` 的两个旧函数除字段名外，分支与顺序完全相同。新 helper 的字段只由两个内部常量回调绑定，未开放新外部写入口：无槽只赋值对应内存字段一次并返回 false；有槽时 mutate 仍只调用一次，其草稿只改该字段；持久化成功直接返回 true，失败后才回退推进同一内存字段一次并返回 false。异常仍传播，没有新增 catch。原有锁、采纳草稿、checkpoint 和公开包装器都不在补丁内。

`battle-settlement.commands.js` 第一处由内部 `readBase` 先对外部 value 做 JSON 深拷贝再返回 `base.value`，该对象仅由本次 `createAttempt` 局部持有，未传给 lookup/recovery 等外部回调。因此局部 `clone(base.value)` 只是复制另一棵独占树，可以直接使用私有快照。nextStats/afterBase 的构造、进度计算、最终冻结和末尾基地复核顺序不变。

第二处 `snapshot` 已在首个 await 前由 `clone(input.afterRun)` 创建，其后只做坐标和 visited 校验，没有传给外部回调或逃逸。候选直接将它交给 afterRun，再由原位置的 freezeDeep 冻结，原输入仍与最终 attempt 完全隔离。两处首次输入 clone 都保留，二次 JSON 快照内已没有函数或 getter，未删去应保留的用户回调。所有恢复、收据、身份和修订检查的次数/顺序不变。

`save-archive.js` 的旧本地判定与共享 validSlot 同为整数且 1～5，判定无状态/副作用，调用处及其短路条件不变。新增依赖 `commands.shared → core/shared` 只有纯工具与静态实体表，没有反向导入归档、Base、页面或存储，不新增循环或门面求值。

## 原文与验证

本目录保存各源码修改前原始字节 `*.before.txt`、对应独立 `*.patch`、前后哈希清单 `manifest.json` 与独立检查结果 `static-checks.json`。这些基线来自协调后的当前工作区，包含先前完成未提交增量，没有用 HEAD 覆盖现场。

预备时三份补丁分别通过 git apply --check，应用前再次核 SHA 并重复检查；实际应用后两份原本带 CRLF/混合行尾的源码被 Git 暂时规范化成 LF，本轮在精确已应用 SHA 保护下按基线恢复所有未改行原始字节及修改行对应的原行尾。没有把无关行尾转换加入本次差异。最终 base.js 保持 CRLF；battle-settlement 保留原混合格式（195 个 CRLF、261 行），最终文本与已审候选相同，最终字节哈希以本目录 manifest 为准。

- 三个实际源码分别执行 node --check，退出码均为 0。
- 三个文件定向 git diff --check，退出码为 0；仅提示已有 CRLF/LF 约定。
- 相对本轮原文分别核对完整差异与 numstat；git diff --no-index 退出码 1 表示存在预期差异。
- 引用核对确认旧 persistEggPity/persistEggBattles 名称无残留，两个固定字段端口仍在，归档继续调用同一档位判定接口；首次快照克隆、freezeDeep 与最终复核仍在。

按要求未运行测试、build 或实页；未提交、推送或修改共享占用台账。
