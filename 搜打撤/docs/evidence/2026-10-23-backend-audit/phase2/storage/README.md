# 第二轮：存储与基地纯业务冗余精简

本轮只修改 `game/src/hub/base-meta.commands.js` 与 `game/src/hub/base-state.js`。相对本轮保存的原文共新增 15 行、删除 29 行，净减少 14 行；没有删除文件、修改前端或修复上轮登记的缺陷。

## 已完成

### `base-meta.commands.js`：删除不可达状态分支，合并击杀计数

`recordEvent` 在进入持久化回调前已由闭包私有 `KNOWN_EVENTS` 集合限制为六种事件，内部 switch 恰好覆盖这六种事件。因此 default 不可达，`changed` 在所有可达路径恒为 true。删除可变标志、default 及 `changed && xp` 中的恒真判断，仍对已知事件返回 `changed: true`，未知事件仍在原入口返回 `changed: false` 且不落盘；不改变没有刷新最高值时的既有返回语义。

击杀事件的两条分支原本重复递增 `kills` 和构造经验对象。本轮只读取一次 `d.boss` 并保留为局部变量，保留首次 BOSS 名登记、随后递增击杀数、随后读取职业与调用倍率端口的顺序。经验基数仍分别为 BOSS 40、普通敌人 6；倍率端口调用次数不变。

本文件相对原文 **+8 / -14**。

### `base-state.js`：删除六次完整默认状态创建及重复字段调用

`normalizeBaseState` 原本每次无条件调用七次 `createBaseState()`：一次构造目标、五次只取 stats/home/appearance/goals/story 中一个字段、一次供默认值深合并。本轮每次只创建一份局部 defaults，将其浅拷贝为目标并覆盖 raw，再按原顺序规范化十三个对象字段，最后用同一 defaults 深补齐。

默认树仍在每次调用时重新创建，不缓存或跨档共享。目标使用新的浅拷贝，raw 覆盖目标属性不会改掉 defaults 的默认字段；缺省、损坏容器警告顺序、原有字段规范化及人物迁移保持。各字段的嵌套默认对象互不共享，复用本次 defaults 不改变输出之间的引用隔离。

本文件相对原文 **+7 / -15**。

## 因活跃返修避让而未实施

`base.js` 中 `persistEggPity` 与 `persistEggBattles` 除字段名外为相同的持久化与内存回退实现，可以合并为内部 helper。主会话核对到当前活跃背包/保存返修后，要求本轮不触碰该文件；候选保留，没有实施，也未计入删除量。

上轮已清理的存档诊断 Map 未重复修改或计数。公开 API、旧存档迁移、事务与回滚、同槽锁均未删除。

## 原文与验证

修改前原始字节分别保存在 `base-meta.commands.js.before.txt`、`base-state.js.before.txt`，对应 SHA256 见 `before-sha256.json`；修改后 SHA256 见 `after-sha256.json`。快照与哈希均在修改前生成，未以 HEAD 替代当前工作区原文。

静态检查：

- 两个文件分别执行 `node --check`，退出码均为 0。
- 两文件定向 `git diff --check`，退出码为 0；仅有已有的 CRLF/LF 约定提示。
- 逐项阅读相对本轮原文的完整差异，确认仅涉及上述三处精简。`git diff --no-index` 的退出码 1 代表存在预期差异，用其 numstat 统计本轮增删。

按要求未运行测试、build 或实页；没有提交、推送或修改共享台账。
