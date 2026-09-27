# E5 存档恢复契约与入口校验

Friday 协调记录，2026-09-27（Asia/Shanghai）。协调聊天：01a0e192-baec-7192-ba9f-4e8d1cfe9923。

## 实时基线与事实

本轮实际核对 HEAD 为 `3d06b1e5467823b6c9f9e45a4f8955b77c954805`；启动时 tracked/index 干净，仅既有排除未跟踪项。相对本地 origin/master ahead 11 / behind 0，未 fetch、未 push，不代表服务器实时状态。旧 E2/E3/E4 团队已停写；本批用独立新主指挥和全新子代理。

已读 README、存档兼容契约及现行 storage/session/menu：RunStorage.read 仅浅对象与宽松 version 检查；preflightRunMap 已处理 journal、pendingExtraction 身份与严格地图校验，但未挡住 ownedCards 内 null、discovered 非可迭代等进入装载后的危险结构。loadGame 在改写运行态后才访问这些字段；内部两类 Base.save 与战斗恢复 saveGame 返回值未汇总。以上是源码缺口，实施须用故障用例证明，不冒充玩家事故。

## 已定范围和行为

1. 在现有 read → 迁移 → preflight → load 链增加最小安全校验。顶层必须是普通记录；version 缺失的历史兼容保留，已存在版本的非法形态与未来版本明确区分。不要仅靠数值强转把坏值当旧档。实际旧格式的数字字符串如确有证据支持，可保留有界兼容并记录。
2. 业务字段以真实装载消费者的安全前提为界：先覆盖集合容器、卡实例及其 card 记录、discovered、普通/龙巢直接消费字段；记录每项已存在兼容默认，区分缺失与破坏结构。保留合法历史缺失/空值语义、未知顶层扩展字段和已有标量默认。不扫描全库规则，不新增数值平衡限制，不因未知合法卡 ID 丢弃资产。不默默过滤坏数组元素后重存。
3. 预检拒绝须在 Random、地图安装、Base.use、game 赋值前完成；返回可辨原因及 preserveRun，原 run/base/journal 串不被覆盖。复用现有地图、pendingExtraction、pair/baseline 校验，不新造事务或整档 schema。备份失败时不可声称备份已成功；至少准确说明原档保留。
4. loadGame 的 ok 继续表示装载分支成功；新增可序列化、可区分未尝试/成功/失败的本次持久化结果，只汇总现有实际执行的保存。回写失败要向用户明确提示，但不要把已可用的装载伪装成完全失败，不增加保存次数，不强制每次保存变事务。menu/Agent 的成功只仍表示进入完成，不能升级为持久化保证。具体结果字段名由团队选择，需在接管回执列出。
5. read 缓存、writeBaseline 与 issue 如发现与本范围直接相关的陈旧状态，应以定向证据最小修正；不扩成全存储重构。需要窄类型时覆盖真实生产入口，禁止只检查声明/fixture。

## 单写归属

- Friday 独占本 PLAN、全量门禁和 Git index/本地提交；不亲自实现 runtime 或测试。
- 独立 E5 主指挥独占 RESULT、docs/save-format.md，统筹全新团队和独审。
- 建议分片 A：hub/game.storage.js、独立纯校验模块及专属 storage/validation 测试；分片 B：run/game.session.js、确需的 ui/game.menu.js 与 session/menu/persistence 测试。共享模块接口先定、每文件单写；所有额外生产文件先向 Friday 说明必要性。主指挥在接管回执确定最终分工后由 Friday 确认实施。
- 独审只读，检查实际 diff、兼容矩阵、原串保留、副作用顺序及 E4 守卫。主协调只对主指挥通信，不直接指挥其成员。

## 验证与结束条件

固定旧档迁移和真实可恢复旧 3/9 图分别验证；覆盖普通/龙巢/未完成战斗、缺省值、未知扩展字段、坏字段组合、未来版本、已有 journal/第三值与另一标签替换。复用既有代表用例，不重跑所有历史测试。持久结果覆盖未尝试、Base 失败、run 失败及成功；至少有真实 session/menu 入口，不能全部 stub 业务结果。不得触碰真实玩家档。

定向与独立审查通过后全队停写，交精确清单和证据，由 Friday 执行原 pre-commit 全量并本地提交；不提前重复全量。原已有本地精确范围提交授权沿用；无 push/build/install/delete/清理/回滚/amend 授权。不得手改 cards-sync.json；全部原排除未跟踪项保留。

E2 真实 hover 与旧档 04/05、E3 真实结算/旧档/长局、E4 异步实页继续后置统一验收；本批恢复提示实页同样如未运行必须列明。丢档、重复奖励、无法运行或全量失败不能当小瑕疵略过。代码/定向/全量/实页分别报告。老板停止/暂停时立即全队保留现场，不再检查、测试或提交。

## 接管确认

独立 E5 主指挥聊天为 `01a0e194-f35b-7651-9a2c-b4ff76e65e8e`。首次发送回执被自动审批以缺少直接跨聊天通信授权拒绝；老板随后在该聊天明确批准持续双向通信并按已定计划实施，回执已收到，Friday 已确认实施。

单写 A 为 game.storage.js、新 hub/run-save-validation.js 和 tests/e5-save-validation.test.js；B 为 game.session.js、确需时 game.menu.js 和 tests/e5-session-recovery.test.js；主指挥持有 save-format.md 与 RESULT，独审只读。最终文件范围以实际交付核对。

确认 loadGame 新增 `persistence: { status: 'not_attempted' | 'succeeded' | 'failed', attempts: [{ target: 'base' | 'run', reason: string, ok: boolean, code?: string }] }`。0 次尝试为 not_attempted，全部成功为 succeeded，任一失败为 failed；后续成功不能抹除先前失败。预检拒绝附 not_attempted。保留 saveGame 公开 boolean 兼容、原保存次数和 E4 进入成功语义。

实施补核：普通 loadGame 经 enterLayer 原已调用 saveGame，批准在同步装载作用域用私有收集上下文覆盖既有显式/间接保存，finally 复原；不添加写盘。按实际执行次数报告，不预设普通读档为 not_attempted。战斗 restartVersion=1 的真实入口读取 battle.run，允许校验其经 applyRunRestart 再次注入运行态的直接容器安全前提，不扩为完整战斗 schema。定向检查收集上下文在返回/拒绝/异常后不泄漏。

独审发现预检先 readForLoad 推进 baseline、随后拒绝结构/地图的漏洞：仍运行的旧局可能获得覆盖被拒原串的权限。Friday 已核实并批准在 storage/session 原归属内修正：菜单预检保持不推进，实际 loadGame 纯校验全部成功后、任何状态/持久副作用前，只采纳与已校验数据绑定的原始串；当前串已替换则拒绝。保留 readForLoad 直接消费者兼容，不另造事务。需验证拒绝后旧局保存不能覆盖、合法菜单预检也不能授权旧局覆盖、实际加载最新合法档可保存。

## 统一落库窗口

2026-09-27 15:00（Asia/Shanghai），Friday 核对实际实现、定向回归源码、RESULT 及实时工作区。团队七文件加本 PLAN 共八文件，单写归属一致；HEAD 仍 3d06b1e，index 空，原排除未跟踪项保留。本地 origin/master ahead 11 / behind 0，未 fetch、未 push。定向最终 7 文件中的 129 项通过，独审阻断项 0，全队停写；这些证据不等于全量或实页通过。

接收补修结果：readForPreflight 用 WeakMap 绑定候选与精确原串，acceptLoad 仅在实际装载纯校验通过后采纳；读取失败/原串替换在副作用前拒绝。菜单合法预检和坏结构/地图/撤离拒绝均不授权旧局覆盖。进入原 pre-commit 全量及精确范围本地提交窗口，结果以后续记录为准。真实页面恢复提示及 E2–E4 积压实页继续未验。
