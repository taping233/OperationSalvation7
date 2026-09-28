# E7 统一集成与实页验收

Friday 制定，2026-09-27（Asia/Shanghai）。老板本聊天明确：“把第七批启动吧，要我弄的和我说”。协调聊天为 `01a0e1d6-342e-7971-8922-ad614061a6d4`（local），旧 Friday 与 E2–E6 团队不唤醒。

## 启动基线与归属

实时 HEAD `7cf5b6c63c5ae8b0501353b5a7582f6321fb5218`，tracked/index 干净；相对本地 origin/master ahead15/behind0，未 fetch、未 push，非服务器实时状态。原未跟踪内容全部保留且不纳入本批：`.codex/`、`.ui-art-loop-0925/`、`.ui-loop-0926/`、`AGENTS.md.bak-20260927-082309-context`、根 package.json/package-lock.json、game/shots/、E2 evidence 中01-boss-empty.png及02-boss-deselected.png。

沿用每批独立新聊天、新主指挥及全新子代理的协作方式。Friday 持本 PLAN、范围裁决、全量窗口/index/本地提交；主指挥持 RESULT、实施与独审协调。只由主指挥与 Friday 持续双向沟通，Friday 不直接调度成员。先回传接管、接口/文件归属、浏览器与隔离方案，Friday 确认后实施。旧团队停写不复用。

新主指挥聊天：`01a0e1da-75d4-7941-ad33-a2d8f82e7605`（local），标题“E7 统一集成与实页验收”。

## 验收范围

从 README 按需导航，以实时源码和各 PLAN 最终记录为准。复用 E1–E6 有效证据，不重复全仓审计，不用历史 RESULT 的待提交状态覆盖最终记录。

1. E2：补真实 hover；复核旧04/05进入问题的证据来源及可复现边界。血量展示修复已落库并复验，不重开已关闭问题。只有工具当前提供真实 hover 能力才可自动验证，否则准备准确现场、向 Friday 交老板操作步骤；不合成事件冒充。
2. E3：真实主入口普通胜利、结算最后 saving 的恢复与重复奖励防护、代表旧格式兼容及有界连续游玩。明确样本/步数与未覆盖范围；不把开箱整理全阶段原子化当成既有承诺，不把有限局数称为全部长局通过。
3. E4：真实页面切局/退出及异步完成归属、失败展示、Agent 受理与完成语义。故障注入与自然流程证据分别标明。
4. E5：存档预检、恢复和回写失败提示的实页表现；拒绝保留原串、成功进入与持久化结果区分。仅用隔离样本，绝不修改真实玩家档。
5. E6：不支持规则的真实拒绝提示与付款前拒绝、合法/legacy代表流程兼容。supported 只代表战斗能力门，不扩大为全域牌效已验。

优先真实主入口集成；必要 QA fixture 必须复用真实生产模块且记录与自然流程的差异。先盘点现有 fixture 和运行环境，禁止因取证重复造实现。真实丢档、重复奖励、无法运行、门禁失败均为阻断，不能归为小瑕疵。

## 环境、实施和证据边界

只开发搜打撤 Vite，Godot/Unity/EXE 冻结。游戏只使用 Codex 内置浏览器当前窗口，不主动多尺寸。主指挥指定唯一浏览器操作者；先读相关技能与实时能力。使用独立测试 origin/存储，先核隔离再运行；不得复制、改写或清空玩家档。需真实玩家操作时说明页面、按钮、预期、反馈内容及原因，由 Friday 转老板。

初始阶段只授权盘点与提出精确文件归属。修复须有本范围真实证据，主指挥先报根因、最小文件集合与影响，经 Friday 确认单写后实施。不同成员不共同写文件、不争抢浏览器。生产代码、QA/定向检查、证据、RESULT 归属明确；独审只读。超过300行先 rg 再读片段。

禁止 build/install/push/delete/清理/回滚/amend，不改 config.toml/全局配置、cards-sync.json、玩家档；任何删除先列路径请老板同意。不改共享 README/PROJECT-STATUS，交付变化只记本批自有文档。

## 收尾窗口

每项记录：所验 HEAD/变更状态、入口与隔离方式、实际操作、预期/结果、截图或可复核输出、通过/失败/未验边界。生成文件不等于实页验收。独审核对证据是否足以支撑结论，不能只审说明文字。

定向与独审完成后全队停写，一次交回精确文件清单及证据；Friday 再统一接原 pre-commit 全量与本地精确范围提交，不提前重复全量、不绕过钩子。沿用老板历史本地提交授权，无推送授权。若仅文档/证据变化，先核现行门禁适用范围，不无理由重复已验生产代码全量。

主指挥在接管/需裁决/需人工/真实阻断/全部完成时主动报告。普通等待不频繁刷新进度。通信若自动审批拒绝，准确保留原理由，不换工具或身份绕过；将所需授权交 Friday。老板停止/暂停，立即全队保留现场，不再检查、修复、测试、清理或提交。

## 接管裁决：进入实施

2026-09-27 Friday 收到主指挥接管方案；老板已在主指挥聊天直接回复“我授权，你继续”后恢复向 Friday 报告。实时再次核对 HEAD 7cf5b6c，tracked/index 干净，新增仅本 PLAN，原排除未跟踪保留。

确认 QA 专属单写归属（以下路径均相对搜打撤）：主指挥持本批 RESULT、docs/evidence/e7-integration-2026-09-27/、docs/previews/e7-integration-acceptance/index.html 与 bootstrap.js，以及根 vite.e7.config.js；A 持预览目录 flow-scenarios.js；B 持预览目录 save-rule-scenarios.js。共享 register(ctx) 接口由主指挥定义并交成员使用，成员不操作浏览器。允许实现上述最小 QA 接线及既定矩阵，生产修复仍须先报根因与精确归属。

允许使用已有 Node/Vite 启动专用 127.0.0.1:5197 dev 服务，strictPort 防止静默切端口；不运行 npm predev/build/install，不接管5188。先由无游戏脚本守卫页检查 local/sessionStorage，非空即保留中止，不清空。首次确认空后建立本批标识，后续刷新允许保留同一批样本/journal，不能每次重置存储破坏恢复证据。测试档位和键须显式白名单；生产保存自身既有生命周期按真实流程运行，QA 不额外删除/清理存储。注入仅该 origin、dev配置、显式开关和样本范围有效，记录命中次数与实际键；真实主入口、自然交互、样本准备及故障注入分栏，不以 QA 直接改状态冒充玩家点击结果。

旧04/05缺原始数据/事件链，保留未归因，不通过改玩家档来补证。E2真实hover需人工，由主指挥准备当前窗口准确现场再报Friday转老板。E3连续游玩预算最多3场普通战斗/90动作，按实际完成记录，不算长局全面通过；代表旧档成功样本须保留有效地图身份。E4延迟/失败必须在预取前接入并记录命中，否则不能认定覆盖竞态。E5逐字保留检查分别比较run/base/journal；E6只核当前战斗能力门及代表兼容。全部完成或真实阻断主动回报，无需普通进度回执；最终独审后全队停写，再由Friday接收统一收尾。

### 隔离地址修正

2026-09-27 主指挥报告：5197无游戏脚本守卫发现已有约25个非E7 localStorage键（含run/base），owner为空，继续入口已禁用；未导入主游戏、未读取档位内容或改写/清空数据。无监听不等于无历史浏览器存储，本次为环境隔离阻断，非游戏生产故障。

Friday 批准改为候选 `http://127.0.0.1:52971`，主指挥同步其持有的 vite.e7.config.js、bootstrap.js、index.html，A/B各自负责本人文件中的地址引用。仍须strictPort、唯一浏览器操作者、无游戏脚本预检local/sessionStorage；候选地址只有实测空且登记本批身份后方可进入，非空保留中止，不改5197存储，不接管5188。5197服务本次保持原样。样本与故障注入白名单必须同步锁定新origin，不允许沿用旧地址绕过守卫。

### E7-F01：当前进入失败提示不可见

2026-09-27 主指挥在52971独立origin通过真实主入口复现：battle.view.js单次503故障实际命中，进入失败后仅标题可见；日志虽记录错误，但expedition.css中的lobby规则隐藏logPanel。Friday实看截图10-e4-module-failed-title.png，核对game.menu.js当前catch与loadGame非ok两分支均仅记日志后showTitle，确认可见反馈缺口；受控模块故障不冒充自然网络事故。

批准A单写生产game/src/ui/game.menu.js与tests/e4-async-entry.test.js，修复当前进入异常以及loadGame返回非ok两个同类失败分支：保留归属检查、原有退出/失效语义、失败返回false，回到可操作选档界面并复用slotRestoreError展示明确错误。不得让旧请求重开页面、覆盖新页或泄漏提示；不改CSS、loader、存档写入、规则或Agent完成契约。不要仅openSlotPicker而丢失原showTitle对runActive/activeSlot/上下文的清理语义。采用现有UI能力，避免另建通用提示框架。

定向须覆盖两类当前失败的实际错误元素、选档操作可恢复，以及旧失败不污染新页面；先复现再修复，不仅断言UI.log。同实例重试是否能成功应以真实模块加载行为验证，若需刷新则准确提示和记录，不为此擅改loader。主指挥实页复验并由独审核对，继续既定其他场景；全部收尾前不全量、不提交。

F01相关回归补充：A报告e4-async-entry 19/19通过，Friday核tests/agent-command-results.test.js现有load失败用例仅断言ok:false与state=title。批准A追加单写该文件，仅适配回选档modal并检查可见错误、档位退出语义；保留实际Agent失败结果。不得将原本未断言的ACTION_REJECTED称为已验证旧行为，具体code须实测核对现有runner语义，不为测试擅改Agent生产实现。原档保留只有对真实存储字节作比较时才构成证据，仅检查提示文案或stub不能冒充。运行受影响定向并独审，不提前全量。

F01实页文案收口：主指挥报告截图14已显示可操作选档与可见错误，真实Agent step为ACTION_REJECTED/completed=true；单次模块503耗尽后，同实例再次进入仍失败。该证据与模块失败缓存一致，不擅改loader。批准A只将已授权catch分支提示改为“进入档位失败，请刷新页面后重试；原档已保留”，loadGame非ok文案维持原范围；相关测试仅同步精确文案。清除本批故障注入后刷新、重新进入的成功结果仍需实页验证并记录，不提前宣称恢复成功。

F01 Agent证据补正：A的agent-command-results 29/29中stub load失败实际为ok:false/CONTEXT_CHANGED/completed:false；主指挥真实模块503为ACTION_REJECTED/completed:true。两者不得合并为统一完成保证或相互替代；记录各自起始上下文、失效点与runner分支，未定位差异时保留未核实，不仅以“触发链不同”推断已解释。此次不授权Agent生产改动。

### E7-F02：战斗规则拒绝反馈不可见

2026-09-27 主指挥报告：真实战斗unsupported出牌/注能均付款前拒绝、资源未变，提示仅写被战斗层遮挡的底层日志。Friday核当前guard的warn接线与battle.hover.js已有showThoughtBubble（纯文本显示），同意最小复用方案；行为拒绝通过与提示可见失败分开记录。

批准B单写game/src/battle/battle.engine.js、battle.exec-play.js、battle.view.js与新tests/e7-rule-warning-view.test.js：engine保留原详细日志并发出携带battleToken的规则拒绝通知，exec-play两个复验点通过注入warn复用（保留默认日志兼容），view依据当前快照token及已连接战斗舞台token消费事件，复用现有短气泡。核心不得导入DOM或view，不改schema/能力集合/规则数值/CSS/全局UI.log。对玩家显示简短可理解的提示，内部规则路径留详细日志，不将HTML安全编码串直接当气泡文案。

定向覆盖真实play/beginInfuse拒绝可见且资源不变、付款前复验通知路径、旧token/已离场不显示、正常supported与legacy不误报；避免每次render重复订阅与遗留监听，复用原事件总线，不新增全局提示框架。主指挥先完成当前E3战斗取证再释放生产/HMR写窗口；A/B文件不交叉，实页复验气泡可见性并独审后收尾。相关E6定向证据可复用或按实际改动范围回归，不提前全量。

### E7-F03：结算重试成功后失败弹层残留

2026-09-27 第二场普通胜利实页：双次run写失败后重试成功，eggBattles累计1→2、coins11、journal清除，但截图13仍显示失败弹层。主指挥及独审核事件；Friday核settle源码，saving重入直接settle而不经过new阶段关层，成功只refresh后调用teachAmmoOnce，ammoTaught=true时没有新教学覆盖。持久化采样成功与UI出口失败分别记录。

批准A在F01完成后单写game/src/hub/game.bag.settle.js与tests/battle-settlement-retry.test.js；battle-settlement-recovery.test.js仅定向回归不改。只在同run结算确认成功后、教学之前，识别并关闭本结算拥有的retry弹层，使其回调失效；持续失败仍显示可重试，旧实例不得关闭或解绑新实例/其它弹层。不得点击即关、泛化无条件hideOverlay，不改变奖励、事务或保存次数。复用已有UI关闭能力，核对淡出回调不误关紧接着显示的教学层，不新增弹层系统。

定向先红后绿：重复失败保留重试、ammoTaught=true成功退出、false成功教学仍正常、同run其它弹层不误关、旧run不动新层；包含真实DOM/现有overlay行为所需的最小接线，单断言hideOverlay被调用不足以证明归属安全。主指挥在当前窗口复验成功出口、奖励仅一次、继续操作和教学边界，独审后交回；不提前全量或提交。

E3实页预算修正：为分别取得F03同实例重试成功与pending journal跨刷新恢复的独立阳性证据，Friday批准普通胜利上限由3场增至4场，Agent动作总上限仍90，覆盖范围仍为有限样本。前两场已有故障与UI缺陷证据；第3场用于修后重试出口，第4场保存故障保留journal后刷新恢复及再次进入核不重复奖励。按实数报告，不将注入样本升级为自然长局全面通过；不扩增其它场景或重跑已闭项。

## Friday统一收尾窗口

2026-09-27 主指挥正式交回，A/B/独审停写停测。Friday核对生产5文件实际diff、相关测试与QA入口；原HEAD7cf5b6c，生产/测试变化均属E7，另外三份Luna只读盘点文档独立归属且停写，不混入E7提交。实页4场胜利、37次Agent单步（含4noop）及截图/事件的准确边界见RESULT最终段；定向分次通过不能冒充全量。

老板在收到E2人工hover步骤后明确回复“跳过即可”。因此真实hover记为“用户选择跳过，未验证”，不再等待人工、不算通过；旧04/05历史进入问题继续未归因。此段更新RESULT此前“人工待验”的处理状态，不修改历史证据。允许其余已验E7范围进入原pre-commit统一全量与本地精确提交窗口；不build、不push、不改玩家档、不清理现有服务或人工现场。

## 最终本地落库结果

2026-09-27 17:09（Asia/Shanghai）Friday实核：首次提交申请被自动审批阻止，未执行命令或门禁；老板随后直接明确“批准本地提交 E7”。在原41文件暂存范围无漂移后重新通过同一入口提交，未绕过审批或钩子。17:05:42启动原pre-commit全量，172文件/1134项全部通过，无未处理异常汇总，Vitest耗时229.59秒（钩子总耗时231秒）。完整日志`.git/gate-full-test.log`。

41文件已提交为`eeffe5e5b8d809a79e06a140ea7c4cec0cfe0ef0`（fix: surface entry and battle failures and close settled retry dialogs）。F01进入失败可见且给刷新指引、F02规则拒绝战斗气泡、F03重试成功关闭自有弹层均完成定向、独审、实页复验与全量；有限实页矩阵详见RESULT末段，不将测试通过扩大为全部牌效/长局通过。

提交后tracked/index干净；原排除未跟踪及三份Luna盘点报告全部保留，未混入E7。相对本地origin/master ahead16/behind0，未fetch、未push，不代表服务器提交同步。人工hover按老板选择跳过、仍未验证；旧04/05历史现象未归因。这些明确边界保留，不算全部实页通过。本文最终结果随后仅文档提交，不改变所验代码；更新RESULT中全量/提交待Friday的较早状态。不自动启动下一批。
