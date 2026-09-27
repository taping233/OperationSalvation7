# 工程化第二批：恢复器契约与隔离 QA 修复

本记录归属本批主代理。老板明确授权先修复第一批遗留隔离 QA，再自主推进一个可验收的第二批；第三批不在本次范围。最终核对：2026-09-27 09:56（Asia/Shanghai）。第二批代码、类型检查与全量测试独立验收通过；构建和真实浏览器仍未验证。

## 实时基线与归属

- 2026-09-27 09:34～09:40（Asia/Shanghai）重新核对工作区和 README；HEAD `dd5ac7f`，相对本地 `origin/master` ahead 2 / behind 0，未 fetch。
- 第一批与原有 UI、Agent、战斗、文档改动均仍未提交，保持原归属；不能因原会话 idle 认定其改动无主。
- `battle.layers.js` 的 W5-03 图例样式/文案、W5-06 目标高亮属既有在途 UI。本次授权仅修图例持久存储隔离，保留其余修改。
- 第二批目标 `recoverable-pair.js` 与既有 `r2a-recovery.test.js` 接手时干净。`jsconfig.json` 与两个类型测试来自本对话第一批，由本对话协调继续修改。
- 仍仅开发 Vite；不 build、不删除文件、不回滚、不提交/推送、不安装环境、不动全局配置和 cards-sync.json。

## 第一批遗留闭环

- 第一批全量唯一失败是隔离 QA 的意图图例写入 `sdt-intent-legend`；本次未修改原 `r7a-qa-live.test.js` 断言。
- GPT-6-luna 修改 `battle.layers.js`：沿用 `snapshot.opts.devSample` 与 `battleToken`，隔离样本只记内存，不读写玩家偏好；普通战斗复用 `core/storage.js` 的安全 UI 偏好读写。
- 独立审查指出首版 Set 会累计历史令牌，已退回改成 QA/玩家模式各一个最近令牌，常量空间；以 Symbol 作为初值避免有效令牌碰撞。
- 新增 `intent-legend-isolation.test.js` 覆盖普通首次持久记忆、已有偏好跳过、隔离样本零存储访问、同令牌 QA→玩家互不污染、存储抛错时正常显示与会话去重。
- **GPT-6-sol medium 独立执行通过**：`npx vitest run tests/r7a-qa-live.test.js tests/intent-legend-isolation.test.js --no-file-parallelism`，2 文件 / 6 项通过，0 失败、0 跳过、无未处理错误，3.80 秒。原 QA 原样恢复通过后才开始第二批实现。
- 保留原样式、图例文案和目标高亮；本次未做实页视觉验收，没有把 jsdom 实际视图路径等同浏览器验收。

## 第二批范围与验收约定

目标是双键事务恢复器的外部输入、存储端口与结果契约可检查；保留既有提交/redo 顺序和日志格式，不迁移整个 recovery/base 业务。

- GPT-6-luna / chunk_impl 独占 `game/src/hub/recoverable-pair.js`、必要的配套类型及新增类型/契约测试、`jsconfig.json` 的追加范围。
- GPT-6-luna / snapshot_impl 独占 `tests/game-store-types.test.js` 与 `tests/commands-shared-contract.test.js` 的类型诊断补漏；不再修改图例实现。
- GPT-6-sol medium / batch_review 独立只读审查及验收；主代理仅协调、接口取舍与文档证据。
- 存储端口为 `getItem: string|null`、`setItem/removeItem`，日志包含两个 raw 字段与既有三阶段；解析输入为 unknown，只经运行守卫缩窄。
- 日志层只保证 receipt 是非数组对象，不能冒称已经证明业务成功收据或数字 revision；领域校验仍归属调用方。区分 readJournal、recover、commit 的实际成功载荷。
- 原 5 文件及第一批试点保留，检查配置不得放宽；真实 API 正例和坏端口/phase/raw/结果访问负例需被检查器验证。
- 第一批内存 `.js` 正例存在 `import type`，独立实证语法诊断 TS8006 被旧 helper 漏掉。原真实 `.ts` 正例及项目 `tsc` 通过证据仍有效；本批两个 helper 补收语法诊断，并把虚拟 JS 改为 JSDoc，用故意语法错误回归检验诊断工具。
- 验收复用既有恢复故障矩阵和命令/保存回归；因公共恢复接口和未知输入校验收口，收尾运行一次全量。构建仍受共享在途修改限制，不拿旧 HEAD 产物替代当前验收。

## 最终结果

实现于 09:52 稳定交验。以下说明实现内容，独立验收结果另列。

- `recoverable-pair.js` 使用内联 JSDoc 定义实际端口、Journal、故障点和结果；没有新增类型包装模块。`jsconfig.json` 仅在原有范围上追加该文件。
- JSON 解析结果为 unknown；经日志结构和领域校验后才以 Journal 使用。receipt 保留 `Record<string, unknown>`，commit 的 revision 保留 unknown，避免假装已完成业务校验。
- 唯一新增拒绝行为是顶层数组/非对象日志。带自定义合法字段的数组在 JSON 序列化时会丢失字段，现在提交前拒绝；运行回归确认 base/run/journal 三键都原样保留。before/after 的既有 raw 字段兼容边界未额外收紧。
- 两个原类型 helper 收集 program、syntactic、semantic 诊断；JavaScript 正例使用 JSDoc 类型导入，故意语法错误的探针能被捕获。原真实 TypeScript 正例和语义负例保留。
- 实现者 `npx tsc --project jsconfig.json --pretty false` 通过；恢复故障矩阵 13 项、数组日志边界 1 项、恢复器类型正负例 2 项、两个原类型测试 3 项均通过。新类型测试首轮暴露的 JS 语法/诊断断言错误已修正，失败证据没有冒称通过。
- 主代理对本批已跟踪修改路径执行 `git diff --check` 通过；不是对整个在途工作区的清理或重新验收。

### GPT-6-sol medium 独立验收

| 检查 | 实际结果 |
| --- | --- |
| 最终差异审查 | 通过；恢复状态机与写入顺序未变，顶层非对象/数组拒绝边界有回归，类型未虚称业务收据，既有在途 UI 保留 |
| `npx tsc -p jsconfig.json` | 通过，退出码 0 |
| `npx vitest run --no-file-parallelism` | **158 文件 / 920 项全部通过**；退出码 0；0 失败、0 跳过、无未处理错误报告；208.62 秒 |
| 原隔离 QA | 本轮全量原样通过（1 项），未改宽原断言 |
| 本批相关用例 | 新图例隔离 5 项、恢复类型 2 项、数组日志边界 1 项，以及修复后的原类型测试、既有保存/恢复矩阵均包含在全量通过结果中 |
| 构建与真实产物预算 | 未执行；其他会话仍有未提交改动，不符合共享区构建条件 |
| 真实浏览器、长局与多尺寸 | 未验证；本批定向视图测试不是实页验收 |

完整输出：[batch2-review-vitest-20260927.log](../batch2-review-vitest-20260927.log)，最终统计位于 356～357 行。该日志受仓库忽略规则影响，核心统计已固化在本记录。

### 改动与整理入口

- [意图图例隔离](../game/src/battle/battle.layers.js)：复用现有 UI 安全存储与 devSample，会话令牌使用常量空间；保留既有样式/文案/目标高亮。
- [恢复器实际接口及输入校验](../game/src/hub/recoverable-pair.js)、[检查范围](../jsconfig.json)：内联声明清楚表达现有模块边界，没有另加运行包装层。
- [图例回归](../tests/intent-legend-isolation.test.js)、[恢复器类型回归](../tests/recoverable-pair-types.test.js)、[数组日志保留现场回归](../tests/recoverable-pair-contract.test.js)。
- [快照类型诊断修正](../tests/game-store-types.test.js)、[命令类型诊断修正](../tests/commands-shared-contract.test.js)：补齐漏掉的语法诊断，保留第一批有效的真实类型检查证据。
- 本批整理限于复用现有封装、收口诊断遗漏和避免令牌集合增长；没有删除文件或擅自清理其他在途工作。

收尾 HEAD 仍为 `dd5ac7f`，相对本地 `origin/master` ahead 2 / behind 0；未 fetch、未提交、未推送。本批已停止实现派发。后续项目沟通由“项目沟通与主代理调度”接续，完成结果一次同步，不启动新的实现批。

实际并行方式：遗留修复先串行实现→独立通过，再让两名 Luna 分别处理恢复器和类型测试诊断，Sol 同期只读审查；最终整合状态由 Sol 统一运行全量。依赖遗留通过、共享 jsconfig 单一写入者及最终验收必须串行，未为提高并行度扩大范围。

上下文交接判断：准确上下文余量不可获得，不估计百分比；目前未发现已影响本批约束保留、判断或协调。两批证据已落入自有记录，建议下一顶层设计批在新主代理对话承接，便于聚焦新阶段；当前没有因此留下未完成实现，是否新建由协调对话按老板授权办理。

## 后续授权边界

老板 09:49 的计划调整不改变本批范围。下一次推进先做顶层设计：以高效、简洁、解耦、可复用、模块化为原则，明确职责、状态归属、API/数据流和渐进迁移/冗余整理清单，再制定下一实现批。设计完成先汇报，不默认继续零散补类型，不自动启动第三批；删除仍须先列路径获明确同意。
