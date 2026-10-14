# 神灯抉择护甲修复

## 核心结果

2026-10-13 UTC 定向验证确认：全新实际卡库中的神灯，原来选项一/二/三分别实际获得 5/5/10 点护甲；修复后分别为 0/0/5 点。修复仅涉及卡牌词条推导与启动期迁移，不修改战斗执行、选项流程或卡库同步 JSON。

## 已复现的原因

- `game.boot.js` 启动先运行 `ensureTabletop()`，随后运行 `ensureEffectFields()`
- 原 `ensureChoiceFixes()` 一次性删除神灯 `armor`，并写入 `sdt-mig-choice`
- 原 `deriveArmor()` 扫描完整抉择描述，把第三项的“获得 5 点护甲”回填成整张卡的 `armor:5`
- 真实战斗先打开抉择面板，随后卡级护甲兜底提前发放 5 点；第三项文本在选择后再结算一次 5 点
- 旧 marker 使后续启动跳过删除，错误字段因此一直保留

上述路径由实际目录启动和 `BattleSession.commands.playCard/pickChoice/pickDiscover` 验证，不是自造神灯 fixture。选项一的随机发现池仅收窄至目录中的“射击”，避免被发现牌本身的护甲效果污染断言。

## 修复与边界

- `cards.rules.js`：显式制作坊护甲字段仍优先；没有显式字段的抉择文本不推导无条件护甲
- `cards.sync.js`：已知当前/历史神灯卡面上的误回填 `armor:5` 幂等清除；旧 marker 不再阻挡修正；自定义非抉择卡面、其他显式数值以及另行声明结构化护甲操作保持不变
- 迁移不原地改缓存；保存返回 false 或抛错时不写成功 marker
- `cards.js`：清除动作位于各定版目录同步之后、结构化规则补齐之前
- 读档副本刷新边界经源码核对：现有 `game.session.js` 读档已调用 `refreshCardClones()`，后者从当前卡库替换副本并删除已不存在的非运行时字段。此处是静态核对，未另行执行完整旧存档读档实页
- 仍在运行的旧战斗可能持有修复前对象，实页复核需刷新页面，使卡库启动迁移和读档副本刷新实际执行

## 本轮验证

- 新回归 `tests/cards-choice-armor-guard.test.js`：12 项通过
  - 全新目录无 `armor:5` 和误导性甲 5 卡面角标
  - 三个选项实际得到 0/0/5，打开面板时为 0，额外等待后数值不重复
  - 第二项实际消灭受伤敌人；第三项实际冰冻两名敌人
  - 旧 marker、实际启动链、TT10 重播和第三批历史描述修复
  - 自定义字段、结构化声明保护；保存 false/throw 与重试边界
- 邻接定向 11 文件共 173 项通过：新回归、cards、cards-storage-guard、cards-replay、cards-random-pool-guard、m11-data、m-hosted-contract、cards-rules-runtime-boundary、battle-resolution、contracts、architecture-boundaries
- 四个改动文件 ESLint、Node 语法检查及范围内 `git diff --check` 通过
- 原始记录：`choice-armor-baseline.log`、`choice-armor-focused.log`、`choice-armor-lint.log`
- 本子任务未运行全量测试、build 或浏览器；实际页面复核由当前审查会话负责。未暂存、提交、推送或安装依赖

## 全量集成后的历史清单契约补齐

父会话全量检查发现两项旧清单契约仍要求神灯历史 `armor:5` 不变。本轮仅修改测试：`card-catalog-approved-revisions.js` 提供精确迁移谓词，`e8-card-inventory.js` 与 `m-batch-production.test.js` 都要求冻结历史生产神灯整卡恰为旧快照、现行整卡恰为同卡面删除 armor 并添加精确 M11 hosted 声明；不放行其他字段变化或其他卡。

`e8-card-inventory.test.js` 增加反例，明确拒绝旧 armor 为 7/字符串 5、自定义旧名/描述，以及新 armor 为 0/5/7/自有 undefined、新费用/描述/hosted 声明变化。原其他卡面和 CARDS_SYNC 不可变契约继续保留。

最终相关三文件 20 项通过、1 项既有显式生成模式跳过；四个测试文件 lint、语法、范围 diff 检查通过。日志为 `choice-armor-inventory.log` 和 `choice-armor-inventory-lint.log`。没有生产代码增量，也没有改写冻结清单文件。
