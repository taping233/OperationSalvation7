# 运行源码类型覆盖：独立集成

状态：可执行集成验收已完成；实际实现537/537受检、strict49/537、0诊断。稳定全量750文件通过，随后修正的3个完整测试文件25项通过；两段证据分列，不称一次全量全绿。最终实页受本轮内置浏览器不可用阻塞，临时服务已释放。机器摘要见 [integration-result.json](integration-result.json)。

## 检查边界与独立审查

- 自有运行实现分母为 `game/src` 的535份JS，包括generated、QA与预览。新增runtime基线为checkJs=true、strict=false；原10配置保留，strict实际实现49份。fixture或仅导入可达不计作实现覆盖。
- 审查 `check-type-coverage.mjs`：隔离复制真实源码，逐文件追加独特错误赋值，只有同一文件和追加行的TS2322计入覆盖。runtime显式include全部JS；`.typecheck`门面仅用于runtime配置，原facade.js仍被探针实际查错。声明使用真实具名导出typeof，没有宽泛any字典。全目录未发现ts-ignore/ts-nocheck。
- 既有framework-boundaries、framework-ports、game-store fixture负例保留，新增只读符文属性负例传入有效Rune，避免以输入无效替代只读检查。premium-ui-pages保留currentHub早退及action转发的完整断言，仅将实际与期望CRLF规范为LF。
- 现行说明更新 `architecture.md`、`development.md`、`game/src/README.md`；`jsconfig.json`仅修复失效说明链接，未改其compilerOptions/include。
- AST审计排除注释与位置后比较HEAD/工作区，并比较相同作用域callee的实参数量。HEAD包含上一框架成果，不能把全部差异归本轮。发现消费钩子uid丢失(I-04)、flow端口提前读取(I-03)、新增HTMLElement早退拒绝SVG事件(I-05)，均回交原作者，未以类型绿替代语义审核。原始审计 `.tmp/types-ast-audit.json`、`.tmp/types-call-audit.json`。

## 首次集成结果

- 首次完整类型/语法/数据通过后，全域lint发现hub/run八处未使用形参(I-01)，作者用void读取保留兼容形参后冻结。首次失败日志 `.tmp/types-integration-final/lint.log` 保留。
- I-01后冻结输入摘要：`b6a7859cb76eb3a23e0516147afff44000b2ec2318700d1a062dc5306670f12d`。原始逐文件manifest `.tmp/types-integration-accepted/inputs-before.json`，覆盖game/src、data、tools、tests、scripts、narrative及根配置/包锁。
- 完整typecheck11配置退出0、0诊断，真实实现535/535、strict49/535；语法595文件、数据、全域ESLint及文档659相对链接均退出0。
- 真正 `npm test`（含pretest剧情编译与数据校验）退出1：752文件中739通过、12失败、1跳过；7716测试中7656通过、22失败、38跳过；2个未处理mock异常。用时408.99秒。失败原日志 `.tmp/types-integration-accepted/test.log`，SHA256 `80124e8578fc2de34da18dd27582bd8c03186ef3fb5a8842792256b59b6bbe19`。修复依次分派I-02脚本登记/配置指纹及资产审核指纹、I-03hub/run冻结源码与延迟端口、I-04消费钩子/过场/药水回归。原红灯不覆盖或删减。
- 此次首轮全量不构成稳定源码验收：失败即停编排未生成after清单。另一会话的 `ui/transition-art.js` 创建时间为03:17:57 UTC，落在首轮03:15:28–03:22:19 UTC运行期间；`transition-heading.js` 在03:27:50 UTC随后新增。不能把首轮22项失败完整归因于本轮类型化。UID实参、延迟端口读取与SVG拒绝分别有独立AST及定向回归证据；过场素材与排版是其他已授权会话的完成成果，保留其业务变化。

## 本轮内置浏览器来源与环境

- 2026-10-21本轮重新调用cua.getState，明确列出当前会话IAB。子代理 `createBrowserTab('iab','about:blank',{visible:true})` 因“visibility is not supported in a subagent thread”拒绝；visible:false成功，使用当前默认1280×720窗口，未设置viewport。后台标签不是老板当前可见页面。
- 来源为Codex `mcp__cua_repl` 的真实click/坐标输入、AX状态与截图；无外部浏览器/headless、无构造游戏状态或合成事件。服务为独立源码副本 `.tmp/wf-types-browser-1021`，node Vite `--host 127.0.0.1 --port 5337 --strictPort`，PID17432；启动exec78431退出0。assets/node_modules为只读共享junction，其余运行源码、CSS、data与配置均副本，无build。
- 127.0.0.1:5337原有五档均占用，未改写。localhost:5337原有空档位05由本会话建立为验收档；其他四档不进入、不覆盖、不删除。
- 副本运行源码556份含声明的逐文件字节与上述输入manifest完全一致；源码子集摘要 `d8230f3685180ea5afb4a67232feeeaaacba567d326789ba8d2cb2bac28f3bfd`，核对 `.tmp/types-integration-browser-source.json` mismatch=[]。
- 初次资产junction真实路径落在原目录，Vite默认fs.allow拒绝/@fs资产HTTP403。首战按产品提示使用简化画面继续；该段仅证明功能路径，不作为正常美术通过证据。副本vite配置精确加 `server.fs.allow:[ROOT,path.resolve(ROOT,'../../game/assets')]`，保留副本原允许项，未改生产配置；服务自动重启。随后同一far.webp本地HTTP请求200/34880字节，正常战斗首帧与敌回合截图已留存。403、音频/资源警告与正常阶段分开，原日志 `.tmp/types-integration-browser-logs.json`。

## 已执行的真实流程（待最终补丁后复核影响范围）

标题→空档05新建→基地→人物无→默认整备→真实出征→领取两张随行补给→地图节点2首战。真实初始攻击扣费2→1、手牌5→4、敌人2→1；真实结束回合，敌方伤害35→30，第二回合能量恢复2；再次攻击胜利，领取1金币，保留待领箱返回地图。

副本资源修复引起页面重载后，从标题选档05继续对局，真实恢复第一层、生命30/35、金币1、消耗区2与节点2待领奖；随后真实前往节点7，在正常美术模式看到完整背景、人物、图标，重复初始攻击及敌回合，生命30→25、剩余1敌、第二回合2能量。截图分别为 `battle-turn2-degraded.png`、`restored-map.png`、`battle-normal-first-frame.png`、`battle-normal-turn2.png`。

这覆盖上一框架任务所缺标题/开局、真实提交卡牌、敌回合与持久恢复的具体路径；不代表所有存档迁移、全部牌效或多尺寸视觉均通过。最终补丁后的输入、全量、浏览器补验与服务释放在收尾后补记。

## 最终冻结输入与复用的检查

I-02/I-03/I-04/I-05已恢复消费UID/来源实参、延迟包装、原options/context身份、默认值与原动效字符串；撤销为类型引入的候选运行校验与额外数值转换。SVG委托改按Element能力收窄，HTML与嵌套SVG冒泡测试通过。原业务负例、随机流、素材省略算法及候选集合保留；精确资源指纹经消费者构造AST审查后更新，证据分别见I02-foundation.md、hubrun.md、battle.md与ui.md。

I-02完整回执后的五份源码恢复由hubrun最终冻结；已独立核对五份mtime均早于03:50:34 UTC完整ESLint日志及03:50:41 UTC完整11配置类型日志，作者明确退出0且不再改源。复用 `.tmp/hubrun-I03-freeze-types.txt`（537/537、strict49/537、0诊断）与 `.tmp/hubrun-I03-freeze-lint.txt`（全域0）；最终源码逐文件及日志SHA另锁在 `.tmp/types-integration-final2/static-reuse.json`。I02原回执只说明此前同源输入，不冒充五份最后修改后的回执。

03:52:44 UTC冻结的最终源码+资产组为 `701df90d7c0f6c9237d83f1e3fadaa93b96ce1faf1384b89b2a339a12caff7cd`，环境组为 `360f22bba2965b75cae34d33a710caaeb18e52a7b9a0df3e5de864672bbd9e76`。本轮同时锁定真实资产字节与目录清单、源码、配置、包锁与环境；原始清单 `.tmp/types-integration-final2/inputs-before.json`。最终语法597文件及文档659链接均通过；03:52:45 UTC启动真正npm test，含pretest剧情编译及数据校验。

稳定全量在03:58:25 UTC结束、退出1：754文件中750通过、3失败、1跳过；7726测试中7685通过、3失败、38跳过，无未处理错误块；Vitest时长338.39秒。前后源码/资产/环境及状态组均相同，changed=[]、removed=[]；`stability.json`确认 `stableCodeAssetsEnvironment=true`。完整原红日志 `.tmp/types-integration-final2/test.log`，SHA256 `ccc47520172235e78affc3697b8c2d5bde955da3474db19ead8f721cd27b00bf`，未覆盖。

剩余3项分别为hero-cards药水随机候选的旧效果断言漏判真实draw2、premium-ui-pages对插入JSDoc后源码子串的旧匹配，以及r7a-scenes对另一已授权过场新增retreat资源的精确预加载期望。生产源码继续冻结，仅修这3份测试。独立审查已确认premium改为完整函数的独立期望AST，比原子串更精确地保持render/return/五注入字段与求值顺序；r7a保留四层原顺序并精确增加独立明确retreat URL，没有借生产常量生成期望。

hero测试临时缩窄发现候选池，finally恢复卡库方法；没有替换真实发现、选取、临时UID生成、直接施放或抽牌执行。固定火焰药水保留原不留手及全部效果判定，再精确断言2点伤害；新增精神药水用例验证原牌库末2个不同UID依pop顺序移出、手牌精确追加、药水唯一进入消耗区且不留手。生产随机行为未修改，这两例只证明相应确定候选路径，不宣称全药水池覆盖。

## 修正后的完整三文件回归与证据复用

独立执行 `node node_modules/vitest/vitest.mjs run tests/hero-cards.test.js tests/premium-ui-pages.test.js tests/r7a-scenes-integration.test.js --reporter=dot`，退出0，3文件25项全部通过，15.77秒；随后对相同3文件ESLint退出0。日志 `.tmp/types-integration-target3/target3.log`，SHA256 `453bb0093edea19c4f5db32de1b805d431ac721653d1d07d685779bb28222b68`。

新前后源码+资产组均为 `33ce62a179998643757608e16ffce60b47b20a7428bcff68b7b5275d1fa866db`，环境组仍为上述 `360f22...` 且前后相同。与稳定全量after逐文件比较，唯一变化是上述3份测试，unexpected=[]、removed=[]；生产源码、资产、其他测试、配置和依赖环境逐项相同。由此复用稳定全量其余750个完整通过文件，另列本次3文件25项；不重复计算两段中的重叠用例，不改写稳定全量原exit1。既有1个跳过文件及38个跳过测试维持原状，没有新增skip或绕过门禁。质量门的测试输入变化采用对应完整文件定向反馈；未见跨测试污染或新的失败，不为固定次数再跑全量。

原始完整manifest与日志留 `.tmp`；[机器摘要](integration-result.json)逐项登记相对路径、字节数、SHA256和生成命令。完整manifest约617KB，正式摘要约7KB，单文件均未超过1MB。源码类型与全域lint复用最新冻结证据，三文件新增测试的lint另行实际执行；数据校验来自同一稳定全量pretest，语法与文档范围如上。

## 最终源码的实页边界

接续时重新加载cua文档后，原REPL句柄不存在；`cua.getState()`返回apps=[]、browsers=[]；明确调用 `cua.createBrowserTab('iab','http://localhost:5337/',{visible:false})` 返回 `Browser is not available: iab`。真实参数与记录时间见[browser-final-blocker.json](browser-final-blocker.json)。未反复重试或切换外部浏览器。

最终源码、CSS与data共757文件已同步到原副本，逐项SHA与最终冻结输入匹配，保留副本fs.allow与资产/依赖junction；核对记录 `.tmp/types-integration-final2/browser-source-final.json`。因工具不可用，最终slot05恢复、SVG图标真实输入及最终浏览器error窗口未核验；单元DOM的HTML/SVG冒泡结果不能替代这些实页路径。前段正常实页证据仅适用于其旧输入指纹；最后真实页面动作是在旧版正常战斗后“离开对局→保存并退出”回到标题，slot05留下生命25/35、金币2、消耗区4。

## 现场释放

04:03:21 UTC，核对原服务PID17432的Node路径、完整Vite命令、创建时间03:13:28.412155 UTC和5337监听归属后，仅停止该进程；原conhost/esbuild子进程随后均退出，5337复核无监听。详情见 [service-release.json](service-release.json)。独立副本、assets/node_modules junction、本会话slot05和全部日志均保留，未删除文件或存档，未动其他服务。最终浏览器会话不可用，未把旧标签或旧图声明为最终页面；未运行build、安装、提交、推送或发布，远端CI未核实。
