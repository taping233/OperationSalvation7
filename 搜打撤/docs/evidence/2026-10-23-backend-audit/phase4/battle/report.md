# 第四轮战斗/卡牌成段重复归一

日期：2026-10-23。已归一 3 组实际重复实现，修改/新增 5 个生产文件，本轮 +45/-89，净减 44 行、2534 字节。没有移动测试来增加统计，没有整文件删除；没有运行测试、构建或游戏实页，没有提交。

## 实施结果

| 实现 | 精确属地 | 本轮增删 | 净减 |
| --- | --- | ---: | ---: |
| 三个战斗回血入口共享禁疗/回血/浮字执行体 | game/src/battle/bag/battle.bag.domain.js | +11/-21 | 10 行 |
| heal/armor/draw 三套金额字段验证共享 helper | game/src/cards/card-rules.schema.js | +22/-48 | 26 行 |
| M 批与 E8 的递归快照比较共享纯叶子 | game/src/cards/cards.sync.backfiller.js；game/src/cards/cards.sync.rule-backfill.js；新增 game/src/cards/card-snapshot.js | +12/-20 | 8 行 |

所有行数以本轮字节原文快照计算，新叶子的 10 行已计入增加项。各文件修改前后 SHA256、净字节和独立 diff 见 receipt.json；原文保存为 *.before.txt。

### 战斗回血

原先文本道具、结构化道具 heal、职业圣疗各复制同一套“先查禁疗；禁疗时打印相同提示，否则 G.heal 再推送回血浮字”的实现。现在三处在原时间点调用 healPlayer，入口的支付、后续日志、职业技能翻面和 finally 收尾不变。

这段 helper 不读取随机源，不增加或减少 RNG 调用。G.heal 与 G.log 仍以原对象 receiver 调用；禁疗读值次数、警告参数、浮字对象及顺序保持，异常仍进入原外层处理。

静态证据：三份旧块仅将局部 amount/n 名称统一后，与 helper 的 AST 相同；把新调用按原参数展开后，完整 createBattleBag 函数体 AST 与本轮原文相同。该比较不执行卡牌/治疗代码。

### 效果字段验证

原先三份代码分别验证 amountField 必须等于对应卡字段、卡值须为有限正数、amount 须为正整数且与已声明的非零卡值一致，仅 heal/armor/draw 字段不同。现在 validateEffectAmount 在原来三个位置同步调用；source 数量、guard、priceOf、filter 等其他验证仍按原顺序执行。

静态证据：把 helper 的 field 参数分别特化为三个字面量后，属性读取表达式、短路条件、错误字符串和 error 调用顺序与各旧块 AST 完全一致。再把三次调用展开，完整 validateEffectOperation 函数体 AST 与原文相同。没有将 card[field] 缓存，从而保留 getter 的读取次数。

### 卡库快照比较

两套迁移器曾各有一份相同的键集/数组/原始值递归比较。现共享 card-snapshot.js 的 sameCardSnapshot，两处保留原局部名字 sameSnapshot 作为 import alias。新文件只有 export function 定义，没有 import、顶层卡库读取或注册行为；没有引入 backfiller/capability 的额外依赖链。

静态证据：新比较函数主体在递归函数名归一后，与两份旧主体 AST 相同。各迁移器原调用点和参数未改；marker 门、读取原库、坏库/缺卡、存写失败和重试策略保持独立，没有合并 E8 与 M 批迁移流程。

## 检测与覆盖

对 157 个纯 cards/battle 文件的函数体做两种只读扫描：精确 token 序列，以及忽略标识符名称的结构相似序列。门槛为至少 60 个 token 且跨 7 行；分别得到 5 组精确候选、34 组结构相似候选。后者不是行为等价证明，未把这些 token/相似行数直接计入删除量。

输入路径与扫描方法保存在 duplicates-exact.json、duplicates-alpha.json；逐文件编辑状态与范围见 coverage.json。新增的纯叶子另外做语法和静态主体检查，不冒称其属于修改前 157 个扫描文件。

## 未实施的重复候选

- enemy-phase 的新回合状态重置、延迟反馈段，以及 resolution/status 的目标选择/治疗片段：最新登记 WF-project-bugfix-1023 正活跃编辑这些路径，未写入。额外回合/正常回合的日志、守卫和阶段语义也不完全相同，未仅凭相似行数强合并。
- 两套存储快照的形状验证：本轮只共享已证明相同的比较算法，保留各迁移器的失败处理和调用流程。
- runtime.factory 的大量 setter、engine.factory 的端口转发：标识符归一后相似，但分别绑定独立状态字段和回调；不是同一效果重复执行，没有改成泛化反射或删除公开绑定。
- requirements 与 costModifiers 的验证头、A3 多批声明：后续允许字段和校验语义不同，数据对象身份/历史 marker 仍有用途；未为小额收益增加泛化层。

## 验证边界

- 5 个修改/新增文件分别 node --check，退出码均为 0；git diff --check 退出码为 0。
- static-equivalence.json 记录 helper 特化/展开和原主体 AST 一致结果；只解析源码，不执行业务模块或测试断言。
- 没有修改前轮 6 个 bug；没有覆盖活跃 WF-project-bugfix-1023 或 WF-live-repair-1023 的精确属地。原有未提交变化包含在本轮基线中，独立 patch 只记录本轮新增差异。
- 未测试、未构建、未实页；本报告不声称全部战斗规则无 bug，也不把结构相似的 157 文件当作完整业务验收。
