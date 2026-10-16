# 首屏剩余 JS 与 Agent 装配审查

结论：主任务追加批准后，已实施两项独立小改：Agent runner 首次实际让位才构造 MessageChannel；仅 commDemo 参数入口动态引入通讯演示。11 个定向测试文件、113 项通过，lint 与 425 个项目文件语法检查通过。没有 build，不承诺因此通过预算。实施细节见 [实施交接](IMPLEMENTATION.md)。

尚未发现同时满足“独立次级依赖、严格保留同步公共面、产物收益超过几 KiB”的可靠新切口；不为约 2–3 KiB 收益拆散 runner 取消协议。下文是实施前审查记录，冻结 R4 的压缩 AST 测量仍是基线测量。

另有真正独立的通讯 demo 误随首屏装入，但 R4 实际可归属代码只约 1.21 KiB entry gzip 诊断差，不能拿源码 gzip 的 3.41 KiB 宣称收益。条件动态引入已按追加授权实施，不以此补齐预算。

## 基线与方法

- 冻结 R4：entry 294,909 B gzip（288.0 KiB），预算 276,480 B，差 18,429 B；initial JS 341,412 B（333.4 KiB），预算 317,440 B，差 23,972 B
- 冻结入口 index-BGYbVOUG.js：879,705 B，gzip 294,909 B，SHA256 df696efa2d27a7ac87d61183a8d5a200c0ed740264427ff9f230b84f5000566e
- 当前 HTML 四个 ESM 入口的 Acorn 静态 .js 闭包为 199 个模块；分析全部入口，没有仅按 main.js 估算
- R4 没有提供逐模块 sourcemap / Rollup module-to-chunk 明细。本轮以源码 import 图核实依赖，再从 R4 压缩 AST 中定位实际 Agent 对象的函数绑定；次级模块以唯一字符串/模板片段定位压缩声明
- gzip 诊断差是仅从冻结入口移走已定位函数/声明 span 后重新 gzip 的差值，不是可执行文件，更不是新构建收益。真正的代理门面、import 胶水、命名变化、共享压缩窗口和新 chunk 的开销须统一构建确认
- 9 个重点来源（Agent门面/runner/policy/recorder/LLM、通讯 demo/转场、卡牌展示文案、研究所结尾）当前字节全部与 R4 相同，见 source-fingerprints.json
- 没有重复 menu.pages lazy、departure.selection-state 拆分；没有改预算、生成清单、CSS、玩法或素材

## 1. 可批准：首次实际让位才创建 MessageChannel

依赖链：game/index.html → main.js → game.boot.js:27 → agent/agent.js:16 → agent.runner.js:64–73。

现状：只要游戏启动求值 runner，就 new MessageChannel、为 port1 赋 onmessage、调用 start。真人玩家从未调用 Agent 也付初始化；Node 已有 setImmediate 时 defer 永远不走 channel，仍已创建无用的两端口。

最小修改：保留原 `typeof MessageChannel === 'function'` 的顶层能力选择、queue 数组、defer 原分支及 Promise executor，只把 Channel 构造、onmessage/start 移到该 executor 首次执行的 `if (!ch)` 内。原始候选见 channel-pump-candidate.patch；候选文本见 channel-pump-candidate.txt。其同内容已按追加授权应用，最终精确增量见 implementation.patch。

确定量化：

- 浏览器型环境，任何 defer 前：1 个 Channel / 2 个端口 / 1 次 start → 0
- 首次及并发/重复 defer 后：仍为单一 Channel / 单一 FIFO queue / 1 次 start
- Node setImmediate 路径：基线始终多建 1 个 Channel；候选始终 0，三次让位仍全走 setImmediate
- 无 MessageChannel 环境：三次让位仍全走 setTimeout(0)
- 不预计减包：候选片段源码 +54 B、片段源码 gzip +19 B；这不是首屏时延或 FPS 测量

验证：probe-channel-lazy.mjs 仅在隔离 VM 运行提取的调度声明，三类环境中双并发 + 后续单次均按 first/second/third 顺序完成；未 import 或执行游戏模块。原始结果 channel-probe.json。该探针不能代替真实浏览器调度、超时与 Agent 全链回归。

实施后建议定向覆盖：Agent command results、runner abort、driver restore、run provenance、tool lifecycle、scenes lazy boundary；新增针对“import 不造端口、首次 turbo 让位造一次、并发 FIFO、Node 优先和 timer 兜底”的回归。主任务在内置浏览器确认普通首屏与 Agent turbo 首次调用即可；无需改取消状态或拆模块。

## 2. Agent 执行链与真人 recorder 的真实边界

### 实际依赖

- agent.js 唯一静态父入口是 game.boot.js
- agent.js 静态引入 runner、policy、LLM、state、protocol、recorder、stats、scene 轻门面和 data 面板
- runner 另外只由已经动态加载的 agent.scenes.runtime.js 引用
- policy 除 agent.js 外，还被 agent.llm.js 静态引入；只切门面的一条 policy 边不会使它退出首屏
- agent.console.js 仅由 lazy game.run.dev.js 引入，已不在初始静态闭包，不能再次计算 lazy 收益
- recorder 被 game.session.js 直接静态引入，提供 resetRunCounters / restoreRunBattles / snapshotRunBattles；state、runner、data 页也消费同一 recorder
- 真人死亡、标准撤离、放弃和研究所结算分别经 session.death.js:164、game.run.altar.js:816、game.menu.pages.js:747、game.nest.js:700 晚绑定调用 SDT.Agent.recorder.recordRun；因此仅保留 recorder 模块还不够，Agent.recorder 挂载必须随启动保留
- data 面板除 Agent 门面以外，还经 game.session.js:25 注入 menuController；只切 Agent 一条边不能懒掉 data 页

### R4 压缩函数测量

| 真实函数组 | minified 字节 | 合并片段 gzip | 移走 span 的 entry gzip 诊断差 |
| --- | ---: | ---: | ---: |
| waitSettle + step + autoRun | 6,148 | 2,846 | 2,545 |
| greedy/random/strategic 三策略工厂 | 18,889 | 7,138 | 6,796 |
| LLM decide/loadConfig/saveConfig/isEnabled 公共函数 | 1,450 | 918 | 608 |
| dataPanelHTML 单函数 | 3,336 | 1,550 | 1,293 |

数据来自 entry-analysis.json 的 emitted 字段；只计算已定位函数，未将共享 helper/常量算成必然可移走。source gzip 仅用于排序：切 boot→agent 会使 11 个源码模块退出静态图，共 143,007 B，逐文件源码 gzip 59,588 B；这些源码含注释、压缩窗口不共用，不能宣称能减 58.2 KiB 产物。

### 为什么不直接“整体 lazy + 同步代理”

协议明确 act 同步、受理结果可 JSON.stringify；observe、phase、settleSignature、normalizeAction/actionId、策略工厂和其直接决定函数、stats、dataPanelHTML 都已有同步消费。动态 import 的空代理无法在第一次同步调用中执行真实策略或返回真实 HTML；用 Promise 顶替会改变公开契约。

只懒载异步 step/waitSettle/autoRun 的执行体在设计上可行，但不推荐本轮实施：

1. act 与 step 必须共享同一 completions WeakMap，不能在新模块各建一份；否则同步受理的异步业务完成证据丢失
2. autoRun 现有 busy 检查、previousDriver 捕获/setDriver、runAbort 创建都发生在第一次 await 前。若移到 import 后，双调用会同时受理，stopRun 也可能停不掉冷加载中的请求
3. step 在开始时捕获 runAbort 身份，await decide 前后都防旧决策；简单 await import 后再开始会错过冷加载窗口中的停止/换局
4. 必须只有一份 runCancelled/runAbort；导入失败也要恢复 driver 和占用，且不能由旧请求 finally 清掉新运行的归属
5. 此处仅约 2.5 KiB 的函数诊断差，尚要扣代理胶水/共享导出成本，不值得为预算强拆这套状态

LLM 请求实现可在现有 async decide 回调内另设懒边界，仍保留配置同步面和工厂创建的 fallback。但取消需在 import 后再次检查且导入失败须走现有回退口径；已识别代码量小，本轮不扩展。

## 3. 真正独立但小：通讯 demo 的条件动态引入

确定依赖链：main.js → ui/ui.js → ui/overlay.js → ui/motion-transitions.js → ui/transitions-director.js:22 → comm-feed.js。

comm-feed 仅该一个生产 import 父入口；正常业务源码无其他消费。transitions-director.js:115 只有 URLSearchParams(location.search).has('commDemo') 时调用 mountCommDemo。模块自身注释亦说明它尚未接业务剧情流；它的六条 DEMO_MSGS 是演示数据。

R4 通过唯一字面量/模板片段定位 commRowHTML、appendCommRow、commTypingHTML、setTyping、commProgressHTML、setProgress、DEMO_MSGS、mountCommDemo 八个声明，合计 3,199 B minified、拼接 gzip 1,697 B；移走这些 span 的 entry gzip 诊断差 1,235 B（1.21 KiB）。小型 esc helper 未唯一定位，故不计其收益。

最小候选：去掉静态 `import { mountCommDemo }`，在原条件块内动态 import('./comm-feed.js') 后调用该导出，并收住异步加载失败。保留条件用 has 的当前语义（包括 commDemo=0 也触发），不要擅自改为仅值等于1或 DEV-only，以免删除现有生产演示入口。真实业务闸门及样式顺序保持同步。

风险与回归：冷加载期间页面可切进 battle，旧 demo 函数只监听未来 mode 事件；动态 mount 时要用当前 overlay.mode/游戏态同步初始可见性，防首次挂载泄露到战斗。还需验证无参数不发该 chunk 请求、带参数只挂一次、加载失败不产生裸 rejection、六消息/typing/progress、close后timer/observer/mode listener释放，以及原 gateSweep 仍及时触发。复用 tests/comm-feed-lifecycle.test.js 的四条生命周期覆盖，并另补 lazy 入口边界测试。

此项是明确误 eager 的独立模块，收益小于“几 KiB”；已按主任务追加授权实施，不强凑收益。

## 4. 已排除或暂缓的其它大头

- core/diagnostics.local.js：名字虽带 local，实际由 event-bus 和 battle-loader 同步记录生产故障，顶层安装全局诊断。不是仅开发入口；不能按文件名移除
- hub/photo-studio-presentation.js：ui.js 只消费约 800 B 的纯 rarity→mount 数据叶子，没有反穿整套照相馆页面
- cards/card-description-text.js：R4 33532 B minified 的 Map 数据、约 9.11 KiB entry gzip 诊断差确是较大独立数据，但 cards.view/card-description-links 必须同步返回已审定卡面文案，不能直接懒载而先展示旧文案。仅把 Map 构建推迟到首次真实文案请求可另作初始化候选，但不减少解析/下载字节，当前尚未做浏览器收益测量
- run/game.nest.js：虽属第二模式，但 session.loadGame 在研究所存档恢复时同步调用 SDT.Nest.renderNestMap，并有 battle:end 订阅/取消状态。不能简单从 main 移走整模块；属于另一个公共状态与恢复边界拆分项目
- run/lab.ending.js：仅研究所成功撤离后使用，是可独立后移的展示模块；R4 已定位 PAGES 与 playLabEnding 合计 2102 B minified、982 B entry gzip 诊断差。收益不足几 KiB，且需处理撤离完成后的异步换局守卫；不优先
- cards schema/capability 和迁移：启动卡库存取、播种/旧档安全校验有真实同步消费，不作为“仅制作坊校验”删除

本次重点候选均在十分钟内完成定性；没有继续追无收益的命名猜测或扩大到玩法/状态机重构。

## 文件与验证边界

- analyze-entry.mjs → entry-analysis.json：Acorn 多入口 import 图 + Agent 实际绑定/函数 span/gzip
- map-emitted-declarations.mjs → secondary-module-spans.json：独立次级模块的压缩 AST 归属证据
- probe-channel-lazy.mjs → channel-probe.json：候选 MessageChannel 调度合约的隔离 VM 探针
- channel-pump-candidate.patch / .txt / channel-source-metrics.json：未应用候选及源码片段尺寸
- source-fingerprints.json：当前与 R4 的重点文件字节对照

审查阶段未运行浏览器、服务、build、pretest、游戏测试、提交或推送，未改生产源码、冻结副本或共享台账。后续追加授权实施及实际定向回归另见 IMPLEMENTATION.md；冻结 R4 产物保持原字节。来源/候选测量不能当作生产构建已过预算。
