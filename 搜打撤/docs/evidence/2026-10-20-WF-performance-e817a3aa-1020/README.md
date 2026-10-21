# e817 性能集成验证记录

最终源码已冻结，原 full 全链与标准生产构建均通过：754 文件、7,797 项通过，1 文件/3 项原跳过；entry=368,588B、initial=418,290B。入口比精确 e817 净减22,295B（约5.70%），仍只有52B预算余量。当前窗口B档实页、正常staged提交门和远端CI尚未核验，因此本次技术集成以 partial 交接，不宣称可发布。以下记录截至2026-10-20 19:16 UTC。

## 固定输入与实现边界

- 原始提交：`e817a3aa2ad945c904b87bdaa99bb697a7f30d0c`，整树 `e89af07b7c0d2e09a871831f4453f2dcb84c9c2f`。完整 18,611 个文件的大小、Git blob SHA 和整树重算已核验；材料化来源是固定 `source-map.json`，未混入旧 74 文件候选。
- 背包只复用一次渲染中的纯派生结果。主包/保险/口袋 `ownedCards` 遍历从 5/4/4 次降至各 1 次；600 张卡、200 堆还原卡同为 1 次，额外 filter/reduce/findIndex 扫描为 0。保留原 UID、排序、牌堆、容器规则与实时行动容量判断。`closeBagZoom`、`openPouchStore`、`openPearlStore` 函数体与固定基线一致，见 [保留边界](preservation-review.json)。
- 视觉就绪共享仅作用于同一页面实例的待完成图片扫描、测量和解码。固定旧代码 A/B：设置热开 2→1、冷开 3→1、基地 2→1；不是 FPS 或耗时结论。订阅方独立取消/超时/字体和背景等待；末位释放清理监听，完成后不缓存。`page-loading.js` 未改。
- 基地同页面异步刷新在同一切幕重绑新表面，等旧图片和已完成图片但仍等 artwork 两条路径均覆盖；旧迟到回调不能清除新切幕标记。980ms 切幕时长保持。详见 [背包设计](bag-render-design.md)、[就绪共享设计](readiness-design.md)。
- `runtime-asset-redundancy-review.mjs` 仅更新实审后的 camp-entry 消费者 SHA 和证据说明；完整源码扫描的 195 项排除保持，0 警告，见 [排除审查](asset-review.json)。

## 资产补登记与生成清单

原资产审计的 91 错误在完整精确基线可复现，不是遗漏下载或软链接绕检查：2,131 个 runtime 资产、manifest 和 debt 均按固定 Git SHA 相等，见 [基线证明](asset-baseline-equality.json) 与 [原错误](asset-blockers.json)。

本轮按已有生产收据补登记 86 个原分辨率宝箱帧和 5 个天气图。原 1,500 项登记与顶层说明保持，count=1,591；没有改资产字节、冻结债或运行选择。逐项来源、SHA 与许可依据见 [登记证据](asset-registration.json)。manifest Git blob：`d1b1a641c875e8c6b3d0a0589faf05cc96a27020`。原 `node scripts/asset-audit.cjs --check` 返回 0 错误、570 条未变化历史警告，见 [审计日志](asset-audit-after-registration.log.txt)。

标准 Vite build 刷新两份 tracked 生成清单：增加实际存在的 poor-meal 美术/缩略图，并移除固定树不存在的 large-rig-v1 frame-14/15/16。没有手改生成逻辑或删除资产。这两份差异单列审查；补登记与生成清单的集中定向 11 文件 134 项已通过。

## 实际验证

| 验证 | 实际结果与覆盖 |
| --- | --- |
| 集中性能定向 | 28 文件、407 项通过；包含两域及 contracts/architecture/资产排除哨兵；报告 `2026-10-20T17-59-59.587Z-d0881315.json` |
| 首轮历史 full snapshot | 剧情编译、591 文件语法、数据、10 组类型、全域 lint 通过；随后在 91 个原资产错误处停止，未跑到 Vitest。后续资产独立补验已通过，不能据此改写原报告为全链通过 |
| 历史独立完整 Vitest | 750 文件：748 通过、1 跳过、1 失败；7,716 项：7,711 通过、3 跳过、2 失败。两失败均为 `workflow-cli-integration.test.js` 在无 Git 快照缺少真实仓库/index；未用跳过变量或伪造 HEAD。报告 `2026-10-20T18-02-37.678Z-a0e32a11.json` |
| 资产/生成清单定向 | 11 文件、134 项通过，含 asset-audit/lossless/card-art/chest/rations/build-artifact/redundancy/contracts/architecture；报告 `2026-10-20T18-14-14.574Z-fdf79d30.json` |
| 现行文档守卫 | 首轮通过，最新事件架构与登记更新后复验通过，657 个相对链接可达 |
| 生产构建 | 精确 e817 与早期候选超原预算；最终同步依赖恢复版标准build全部原预算PASS，见下表 |
| 实页、远端 CI | 本记录未执行，当前窗口验证由统一负责人承接；不得用测试替代实页或把旧版本实测当 e817 A/B |

所有 workflow verify 是工作树候选证据，`reusableReceipt:false`，不提供 staged/index/HEAD/CI 通过收据。完整 full snapshot JSON 超 1MB，不入 Git；相对路径、SHA256 和获取方式记在 [外部证据索引](external-evidence.json)。其他报告保留原结果，不清除失败历史。

## 精确构建 A/B 与预算阻碍

| 输入 | entry gzip | initial JS gzip | package |
| --- | ---: | ---: | ---: |
| 精确原 e817 | 381.7 KiB | 430.3 KiB | 216.51 MiB |
| 本批两性能补丁 | 383.0 KiB | 431.5 KiB | 216.52 MiB |
| 再加 Agent 异步执行拆分（a7 首次构建，未含随后冷 settle 补齐） | 377.6 KiB | 426.1 KiB | 216.52 MiB |
| 再加 Agent 冷期限补齐与事件入口 | 362.5 KiB | 411.0 KiB | 216.52 MiB |
| 再加词条按需解释渲染（最终候选） | 359.9 KiB | 408.5 KiB | 216.53 MiB |
| 原门限 | 360 KiB | 410 KiB | 由原脚本核验 |

两组均 startup=6/40、battle=61.5KiB、narrative=31.0KiB、CSS=222.9KiB；完整日志：[原基线](build-exact-e817.readable.log.txt)、[本批](build-before-entry-split.readable.log.txt)。大部分体积超限在固定基线已存在，本批仍增加约 1.2KiB，不能因此宣称预算通过。入口 Agent 归因见 [只读估算](entry-agent-attribution.json)：独立模块压缩体积不等于 Rollup 净节省，后续只认可生产构建结果。

## Agent 入口执行拆分

Agent 同步观察、动作受理、策略工厂、记录/数据页与配置合同保持；只把异步驱动、可信 fixture 回放和已配置 LLM 的执行部分按需加载。集中 23 文件 206 项通过（报告 `2026-10-20T18-24-04.514Z-c74a48e8.json`），含冷加载 Stop/局级超时 race、迟到不执行、双启动、换局、失败重试及真实命令回放。集成审查发现的冷 waitSettle 期限已补齐：加载计入同一预算、超时返回原 stalled 结构且迟到不执行；冷 step 同样有界，热路径 options 身份不变。增量集成 6 文件 88 项通过（报告 `2026-10-20T18-34-42.146Z-43ae7832.json`），作者最终完整 Agent 组 23 文件 212 项通过。完整冻结补丁 SHA256 为 `694553d75facbb8ee952c15e179d15ecb4782162ef34aae7607641bbbea0be6e`；这份晚补已经和事件候选共同生产构建，结果见下节。

[原标准构建](build-agent-entry.readable.log.txt)证明 entry/initial 各比两优化版本净减 5.4KiB，仍分别超原门 17.6/16.1KiB；没有用独立模块压缩估算冒充真实收益。构建过程中最低观测余约 340MiB，未触发安全终止；前后逐 SHA 比较原 e817 的全部 1,677 个输出及路径清单，完全不变，见 [监控回执](build-agent-entry-monitor.json)。此版大于 1MB 的 workflow JSON 同样只记录外部索引，不入 Git。

## 事件入口集成与最新构建

`game.run.flow.js` 动态载入事件装配层，保留同步奖励恢复与单控制器未保存奖励；加载时取消、10 秒期限、重试、跨页/换局归属均有覆盖。审查补齐了结算重入前不得取消其他入口，以及 LastLamp 的剧情/记录等待归属。已完成 Base 写入仍保留事实，不让迟到续体修改新页面。4 个生产文件与 12 个测试文件（既有时序适配仅增加动态导入等待）详见 [设计](event-entry-design.md) 和 [冻结来源](event-entry-source-manifest.json)。

集成 27 文件 385 项通过，黑市真实 flow 入口的补充等待也已独立 8/8 通过；作者含补充组 28 文件 390 项通过。原 four-player teardown 的 6 次 rAF 缺失警告在固定 e817 复现，未抑制，见 [基线日志](event-baseline-four-player.readable.log.txt)。

最新原 `npm run build` 编译成功，postbuild 仍因原预算失败。实际 entry=371,166B、initial=420,868B，分别超原门 2,526B / 1,028B；相对上一版均净减 15,462B，相对精确原 e817 均净减 19,717B（19.26KiB）。CSS=223.4KiB、startup=6/40、battle=61.5KiB、narrative=31.0KiB；没有改门限或把静态依赖改名移到首屏预载规避计算。见 [标准构建日志](build-agent-events.readable.log.txt)、[精确字节](build-agent-events-exact-metrics.json)。

此次最低观测磁盘余 343,601,152B，未触发 256MiB 异常停止；基线全部 1,677 个输出的 SHA256 与路径清单前后不变，见 [监控回执](build-agent-events-monitor.json)。按已授权规则，构建后再将 1,538 个逐 SHA 相等二进制与基线硬链接，回收 221,766,567B；逐文件恢复来源在集成根 `output-binary-dedup-agent-events.json`。剩余预算未闭合，统一 full 暂缓，测试结果不能替代原预算。

## 资源与后续复验

集成代码、可写生成文件及 runtime 资产为普通副本，其余固定历史二进制按需只读链接。精确基线构建的二进制源通过只读用途硬链接复用。两份新构建产物的 1,538 个同字节二进制经 SHA256 核验后硬链接去重，回收约 211.5MiB；每文件恢复来源保留于集成根 `output-binary-dedup.json`。任何后续构建必须使用新输出或先安全解绑已有输出，不能覆盖共享 inode。最新一轮按已批准的约 540MiB 起跑、256MiB 异常停止线执行；构建期间监测磁盘，不并发大输出。

真实 e817 元数据已恢复：原 commit 274 字节 SHA、整树、完整 18,611 项原 index 和 fsck 均核验；标准 shallow 边界保留真实父引用，未虚构 HEAD。见 [真实 Git 证明](real-git-verification.json)。handoff exit0，原失败所在 workflow-cli-integration 13/13 通过（报告 `2026-10-20T18-17-28.139Z-061d6d84.json`）。初次材料化 6410 个省空间历史文件为工作树软链接（Git 属性文件 183B 随后按原 SHA 转为普通副本，避免 Git 拒读 symlink，现余 6409 个），原 index 保持真实普通 mode；不得整树 add 或以工作树类型差异替代原资产。当前优化均未暂存。

原 full 与 build/预算已对最终候选通过；B 档当前窗口实页和对应来源版本仍须覆盖。未提交、未推送、未部署；没有服务端口或后台进程。

## 日志字节说明

纳入候选的文本日志只清理行末空格和文件末空白行，以符合项目 whitespace 检查；不删输出、警告或失败。原始日志保留在机器报告引用的原路径，保持报告内 logSha256 可核验；入库副本统一使用 `.log.txt` 后缀，清理过空白的版本使用 `.readable.log.txt`；原 `.log` 均原位保留并列入外部索引，不强制绕过忽略规则。原始与可读副本 SHA256、获取方式见 [来源索引](raw-log-provenance.json)。JSON 验证报告未改写；原失败状态保留。

## 词条按需解释渲染

`termKeyFor` 和输入委托同步保留，只把说明文案、DOM、定位/跟随渲染器按需加载；没有首屏预热或 preload。点击与键盘激活立即阻止误触父卡牌，动态动作说明仍保留按钮原操作。冷等待只绘制最新仍有效锚点；松手、移出、隐式指针捕获移出、ESC、hidden/inert隔离、离页等取消后不迟到显示。首次真实冷战斗持按经实际 runtime 后验证词条文本和 aria，未瞄准/未出牌；热态保留原同步位置与开关。

首轮扩大定向发现 stealth 词条用例遗漏冷等待，补一行真实导入等待并新增冷点击阻断断言后，18 文件为17通过/1原跳过，280项通过/1原跳过；原正文与玩法断言保持。失败历史保留。浏览器同 URL 网络恢复尚未证明，首个冷交互可读性仍须实页。

原 `npm run build` 退出0，全部原预算PASS。构建最低观测余342,962,176B，基线1,677输出 SHA 和路径清单全未变。由此开始统一 full snapshot 全链；构建通过不替代实页或远端CI。

### 首次最终全链发现的导入回归

19:00 的原 full 全链完成静态、类型、lint 与资产审计后，Vitest 为751文件通过、3失败、1跳过；7,763项通过、33失败、3跳过。三个失败组是 bag-pouch-capacity、pearl-storage-interface、safe-pearl-access，首个共同栈为 ui.js:515 读 SDT.UiScale.rect。词条渲染懒载延后了原同步 ui-scale 副作用，属于本轮导入合同回归；正在恢复轻壳同步依赖并新增冷 zoom 断言，不通过给测试补假对象掩盖。该轮代码、文档、状态、环境指纹全程未变，原失败报告保留。

### 同步依赖恢复复验

词条轻壳仅增加原 ui-scale 同步副作用依赖；新增冷卡面特写直接调用真实 UI.showCardZoom/Cards 与真实 rect，断言词条 runtime 从未请求。集成原三个失败组及词条/哨兵10文件160项通过；原标准build再次退出0、359.9/408.5KiB全部预算PASS，精确基线输出仍全字节不变。正在以此最终源码再次跑原full全链，未修改测试容量/存取断言。

## 最终技术验收与接棒

最终原 `workflow verify --full` 退出0，剧情编译、600文件语法、数据、10组类型、全域lint、原资产审计0错误/570未变化历史警告及全量Vitest全部完成。754文件通过、1跳过；7,797项通过、3跳过。成功报告为 `2026-10-20T19-10-55.283Z-ee180957.json`；执行前后代码、现行文档、任务状态、环境指纹均未变，结束时候选 eligibleForReview=true。之后仅更新收官记录；该报告始终 reusableReceipt=false，不是staged/index收据。19:00的33失败报告及更早失败原样保留，未改写成成功。

最终原标准构建的1,684文件共227,043,281B。恢复UiScale同步依赖后，全部输出与前一次构建逐SHA相等；固定基线1,677文件也始终保持原字节。最终产物/源码哈希见 [构建清单](final-output-manifest.json)，精确入口统计见 [字节结果](build-final-exact-metrics.json)。运行包总量比基线略增，入口延后加载不等于减少全部下载字节或提高FPS。

成功门之后没有改生产源码。正式保存仅允许51个任务路径与本批文档证据；不得把6409个历史软链接类型差异当源码提交。19:18 初次交付时真实 index 仍为 e817 原树、未暂存候选，逐包依赖 symlink 当时不能满足正式隔离 staged 门的依赖字节规则；正常提交门若需要必须按原标准解决，不能拿本次full候选替代。B档待验场景见 [交接清单](browser-handoff.md)。

收官后原 evidence 校验仍确认代码/现行文档/环境未变，eligibleForReview 与 codeEligibleForReview 均为true；只标记预期的台账/任务状态变化，见 [复核结果](final-full-after-handoff-freshness.json)。最终现行文档守卫0 findings。

### 入库日志文件名修正

发布暂存发现项目忽略 `.log` 后，仅为 28 份拟入库日志增加 `.txt` 后缀并同步引用、来源索引和交付清单；原文件与机器报告字节保持。生产源码、测试、构建输入及产物未改变。正式 staged 门结果由发布负责人随后提供。
