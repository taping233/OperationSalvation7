# M01 第一阶段交付：基地存档与提交边界

- 契约：`GAME-MODULE-CONTRACTS-2026-09-21.md` v1.0 §3、§4、§17、§18
- 实施基线：`D:\素材\代号柒\搜打撤`，`master`，HEAD `2dfec66aa610d9a1abc87a8ce1159ca2db90911d`，保留工作区原有未提交改动
- 停止点：只交付基地单键提交；对局键和跨键事务延期，M01-E 未实现、未宣称通过

## 本包改动

- `game/src/base.js`
  - BASE schema 版本仍为 2；新增字段均可用默认值兼容，不做破坏性升版。
  - 新增 `home`、`appearance`、`goals`、`story` 默认分组。旧 `stash`、`collection`、人物成长等仍是唯一真源。
  - 新增内部 `_m01.revision` 与 `_m01.requests`。历史 `Base.save()` 每次成功写入推进 revision，并保留提交记录；因此它之后发生的 M01 命令会得到 `STALE_REVISION`。
  - 1→2 宠物迁移的缺失时间使用稳定值 `0`，保证重复迁移结果相同。
  - 增加供命令门面使用的窄写入口：先完成单个 localStorage 写，成功后才替换当前槽 `Base.data`。
- `game/src/base.commands.js`
  - `readBase(slotId)`：同步返回深冻结快照，不切换当前档位。
  - `readBaseReceipt(context, { command, payload })`：业务校验前查询已完成请求；同参数返回原收据，异参返回 `REQUEST_ID_CONFLICT`，未命中返回 `value: null`。该查询不做 stale 检查。
  - `commitBase(context, preparedChange)`：异步提交完整、已由领域模块校验的基地状态。写失败返回 `SAVE_FAILED`，不替换内存；同命令／同 requestId／同 payload 跨重载重试返回原结果；新请求旧 revision 返回 `STALE_REVISION`。
  - 首次持久化成功后通过 `window` 的 `sdt:domain-event` 发布标准领域事件；失败或幂等重放不重复发布。
- `tests/m01-base-commit.test.js`：M01-A～D 的独立用例。

## 字段与接口

```js
const context = { slotId, requestId, expectedRevision };
const preparedChange = {
  beforeRevision,
  command,
  payload,       // 稳定、可序列化的命令参数；用于持久幂等身份
  afterState,    // 从 readBase.value 深拷贝后形成的完整基地状态
  events,        // [{ type, payload }]
  output,        // 可选业务收据；随幂等记录持久化并在重试时原样返回
};
```

成功结果为 `{ ok:true, value:{ requestId, command, baseRevision, eventIds, output? }, revision }`。

新增分组：

```js
home = {
  owned: { [furnitureId]: instanceId[] },
  placements: [],
  displays: [{ slotId, ref }],
};
appearance = {
  characterSkins: { [characterId]: skinId[] },
  selectedSkins: { [characterId]: skinId },
};
goals = { tracked: [], presets: {} };
story = { flags: {}, outcomes: {} };
```

`coins` 继续位于基地顶层；`home` 不复制货币。`characterSkins` 是解锁资格，`selectedSkins` 是当前选择。

领域模块的调用顺序：

1. 先调用 `readBaseReceipt(context, { command, payload })`；命中时直接返回其中的持久化 `output`。
2. 未命中才调用 `readBase(slotId)`，执行库存、余额、布局等业务校验。
3. 深拷贝快照，生成完整 `afterState`，调用 `commitBase`。
4. 只有 `commitBase.ok === true` 才执行成功演出或刷新 UI。

## 验收证据

命令：

```text
npx vitest run tests/m01-base-commit.test.js tests/base-meta.test.js tests/save-compat.test.js tests/base-key-count.test.js --no-file-parallelism
```

结果：4 个测试文件、26 个测试全部通过。

消费方接口对齐追加验证：`m01-base-commit` + `m02-collection-commands` + `m03-home` 共 3 个文件、20 个测试通过。

- M01-A 通过：v1/缺字段基地数据保留旧资源、仓库和收藏；补齐四个新增分组；连续读取一致；进行中对局键原串不变；快照深冻结；未来版本与损坏档拒绝被普通 `Base.save()` 或新门面覆盖。
- M01-B 通过：档位 1 提交家具后档位 2～5 原串不变；标题页无选档拒绝提交。
- M01-C 通过：注入目标 localStorage 键写失败后，内存和盘上数据均不变；同请求重试成功且目标键只写一次。
- M01-D 通过：重新 `Base.use()` 模拟重载后，同请求返回原业务收据；异参冲突；历史 `Base.save()` 后的新请求旧 revision 报 stale；旧请求记录仍可重放。
- M01-E 未实现：本包没有基地／对局跨键提交日志或恢复流程。

尚未执行全量 build、全量测试或浏览器实机；本包没有 UI 入口，验收为模块级与真实 localStorage/Base 接入测试。

## 已知边界与回退

- 本包只对 `commitBase` 范围保证写失败时内存和盘上均不变化。历史业务仍会先直接修改 `Base.data` 再调用 `Base.save()`；若该旧写失败，内存回滚不在本阶段保证内。其成功写会推进 revision，避免与新门面静默并发覆盖。
- `_m01.requests` 第一阶段不清理，保证已完成经济命令可长期重放；代价是记录会随命令数增长。后续若压缩，必须先设计不会重新执行消费命令的归档策略。
- 未来版本和损坏基地档拒绝 `commitBase` 覆盖；原键继续保留。
- 回退代码时应保留玩家已经写入的 `home`、`appearance`、`goals`、`story` 与旧真源字段。旧代码的深合并/展开保存会保留未知字段；禁止通过清空存档回退。
