# E7 统一集成与实页验收结果（自动项完成，人工 hover 待验）

2026-09-27，Asia/Shanghai。主指挥持此记录；Friday 持 PLAN、范围裁决、全量窗口、index 和提交。

## 基线与范围

- 接管及实施前 HEAD：`7cf5b6c63c5ae8b0501353b5a7582f6321fb5218`；tracked/index 干净；本地 `origin/master` ahead 15 / behind 0，未 fetch，非服务器实时状态。
- 原未跟踪排除内容保持原样；没有 build/install/delete/清理/回滚/stage/commit/push。生产修复仅按 Friday 逐项批准的归属进行。
- A 单写 `docs/previews/e7-integration-acceptance/flow-scenarios.js`；B 单写同目录 `save-rule-scenarios.js`；主指挥持同目录 `index.html`、`bootstrap.js`、根 `vite.e7.config.js` 及本记录和证据。全新独审只读。
- 主指挥唯一操作 Codex 内置浏览器，无尺寸覆盖。当前工具没有真实 hover/mousemove；人工悬停未验，不合成事件替代。

## 现有证据边界

- 旧 04/05 原记录仅证明当时在 5187 最终 reload 后停在选档层且 console 空；没有原存储或事件链，不判定生产/工具根因。新 origin 的成功不能反证旧问题。
- `tests/fixtures/save-v1-run.json`、`save-v2-slot2-run.json` 缺地图身份，适合拒绝保留阴性，不是成功恢复阳性。可恢复构造旧格式须保留 3/9 地图身份及 seed/mapSeed。
- 自然页面交互、QA 样本准备、受控故障注入分别记录。最终获批并完成4场普通胜利、37次Agent单步（含4次noop），另有真实界面按键；不是37次总输入，不代表长局全面通过。

## 初始环境与隔离守卫

- QA 的 JavaScript 文件已做 `node --check`，HTML 由实页加载验证；收尾按最终改动再次核对。语法检查不是实页验收。
- 现有 Node/Vite 6.4.3；直接调用 Vite，未运行 npm predev。首次沙箱启动遇 esbuild `spawn EPERM`，随后工具审批允许现有 Vite 进程启动。
- 服务首次监听 `127.0.0.1:5197`，strictPort。没有接管已有 5188。
- 无生产脚本守卫页实测：5197 localStorage 已存在非 E7 键，包含 slot1 run/base；sessionStorage 空，E7 owner 为 null。守卫禁用登记/继续入口，未加载真实首页，未读取存档正文、复制、改写或清空数据。
- 原始可见截图：`docs/evidence/e7-integration-2026-09-27/01-guard-5197-existing-storage.png`。Friday 已批准改用候选 `52971`；首次预检 local/session 都为空（图02），登记本批身份后加载真实主入口。端口无监听不等于浏览器存储未曾使用。

## QA 接线修正与排除证据

- 独审指出独立 bootstrap 抛错不能阻止另一个 main module。最终采用同一静态父模块依次 import bootstrap/main，守卫失败中断后续求值，并保留生产 DOMContentLoaded 初始化顺序。中间动态 import 方案造成 UI 未初始化，已在 QA 内修正；08:12–08:14 UTC 的启动错误不归为生产缺陷。
- 工具条在模态页随 overlay 移动，避免被生产背景 inert 禁用；工具条键盘事件不传播给游戏，避免 Enter 触发地图行动。08:18 UTC 的首轮 slot5 过程受额外行动干扰，不用作完整恢复提示验收；08:20 UTC 重跑证据有效。
- 部分指针定位未激活目标或激活了工具条；从后续通过真实键盘 Enter 激活生产按钮，逐次核对页面和事件。未合成 hover。截图按当时实际窗口取证，未设置 viewport。
- record 上传取消 keepalive，检查 HTTP 状态并保留错误；flush 已见 pending=0/errors=[]。实际取证以 events.jsonl 收录为准。

## 已取得实页证据（仍待最终独审）

- E5 坏 ownedCards[0]：主菜单拒绝，提示原档保留；run/base/journal 逐字不变，无进入（图03、e5-recovery-observation）。
- E5 原固定 save-v1 代表：缺 3/9 地图身份被拒绝，三键原串保留（图07）。不是成功旧档证据。
- E5 构造无 version、有效3/9及seed/mapSeed的 slot4：真实菜单进入，hp50/coins23，生产保存变为version2且含mapSnapshot（图04）；不是所有真实旧档兼容证明。
- E5 slot5 两个独立构造样本：run 与 base 单键故障各实际命中；均成功进入且明确提示“恢复后的部分进度未保存”。run故障时原run仍无snapshot、原串未变；base故障时run写出snapshot但base原串未变（图05、06）。进入和持久化分别判定。
- E6 version999 和错误infuse/onPlay组合均真实拒绝，资源全等且无pending；合法结构化样本扣1能量、金币+8，不按desc+99。最初名为unsupported的样本实为invalid，不能计未支持规则通过；合成legacy金币句式本来无解析分支，只证明扣费/played，不计效果兼容通过，正在换真实代表样本。
- E3 从空slot1真实新档→基地→整备→黑像→自然探索→普通战胜利。该战包含E6合成手牌准备，不能称全程无注入。最后宝箱前布防run单次写失败，08:25:47 UTC命中：journal/base/journal成功→run失败→后续生产恢复补run→清journal。最终eggBattles=1、coins10、journal无，出现消耗品教学。仅证实后续恢复成功，未证实故障后手动重试/刷新；不能把它描述为commit catch内部自动恢复。
- E4 延迟：重载前布防，08:29:07 UTC实际拦截 `/src/battle/battle.view.js`。真实菜单选择04后等待加载，用QA按钮调用生产showTitle（明确受控生命周期操作），再从生产菜单选05、释放旧请求，最终只进入05且日志只记05（图08/09）。
- E4 失败：真实503命中后，Agent act初始返回ok=true/async=true/completed=false；再次Agent step返回ok=false/ACTION_REJECTED/async=true/completed=true。受理与最终完成不同。
- **E7-F01 已批准修复**：进入失败后标题CSS隐藏logPanel，玩家看不到提示（图10）。A 单写 game.menu.js 与 e4-async-entry.test.js；两类当前失败实际错误DOM红灯已复现，旧请求不污染页面断言通过，正在最小修复。
- E6 后续有效未支持样本：合法 onPlay 的 acquire act=play，以及合法 infuse+onDraw，均在实际出牌/注能入口被拒绝，资源不变且无pending。真实 STARTERS 应急绷带在第二战治疗 33→35，能量差0；这才作为 legacy 代表阳性。
- **E7-F02 已批准修复**：上述未支持样本只在底层日志产生原因，战斗前景不可见（图11）。B 单写 battle.engine.js、battle.exec-play.js、battle.view.js 及 e7-rule-warning-view.test.js，复用既有气泡并验证战斗token归属；不扩大能力或规则。
- E3 第二场同局重试：08:36:59 UTC 布防两次run失败，最后宝箱结算命中第1次，首次真实点击重试于08:40:33命中第2次；再次点击后 state=idle、eggBattles=2、coins=11、journal=null。奖励只计本场一次（之前为1）；图12为失败稳定态，图13为持久化成功后的实际界面。
- **E7-F03 待定位裁决**：图13仍显示“战后结算未完成”及重试按钮，虽存储成功，UI出口未通过。已报Friday，只读定位中；不把图13的文件名作为通过结论。

## 修复与证据补正（持续更新）

- Friday 已批 F03：A 单写 `game/src/hub/game.bag.settle.js` 与 `tests/battle-settlement-retry.test.js`，成功后只关闭自己持有的失败弹层，保留其它层和首次教学；存储恢复测试只回归。
- Friday 已将普通胜利实页预算增至4场，Agent动作仍最多90。截至第二场完成，events中21条 `qa-result:flow-step`（含4次sys:noop）；真实界面按键、样本准备与Agent动作分开记录，不称21次总输入。
- F01 初版实页图14：单次模块503后，选档页有可见错误、可继续选档；同实例再次点击仍失败，需刷新（ESM失败缓存）。已批准catch文案明确“请刷新页面后重试”；loadGame非ok提示不变。图14为文案收口前证据，最终界面待复验。
- F01 定向：e4-async-entry 19/19、menu-recovery-entry 3/3、agent-command-results 29/29，分次运行非全量。Agent fixture只stub存储，其提示断言不能证明原档字节不变。
- Agent差异独审源码解释：runner先dispatch再捕获completion上下文。fixture省略recoverSlotIfPending，在launch设slot=1后才首次await，失败showTitle清为null，故CONTEXT_CHANGED/completed:false；生产会先await async recoverSlotIfPending，捕获起始null，失败再归null，故真实模块503得到ACTION_REJECTED/completed:true。实页未记录完整context tuple，以上为源码推断与实测结果相符，不冒充逐引用实测。两者均ok=false。QA flow-snapshot.slot取Base.slot，并非session activeSlot。
- F02 修前单文件红灯（16:46:34）：9项中7项因缺提示/订阅失败，supported阳性通过；另legacy用例自身样本接线未正确治疗，要求B先纠正，不能计生产回归。jsdom缺animate接线警告也仅在测试内修正。
- F03 A 已修复并停写：保存本结算retry按钮DOM及callback身份；同run成功仅解绑自己的callback，仅包含原按钮时立即关闭弹层，再继续原教学。奖励、事务、保存次数不变。新增真实 overlayMethods/DOM 用例5项，修前3失败，修后全部通过；最终 retry15 + recovery13 + e4入口19 =47项定向通过，非全量。独审确认 immediate 关闭不遗留210ms淡出尾巴；同run替代层、新run层、首次教学均受保护。实页仍待复验。

## 最终自动实页结果

最终仍基于 HEAD `7cf5b6c63c5ae8b0501353b5a7582f6321fb5218` 加本批未提交改动；本地origin差异仍ahead15/behind0，未fetch。证据事件用UTC，报告北京时间；本轮最后游戏证据为2026-09-27 16:57:45附近。

| 项目 | 最终结论与证据 | 边界 |
| --- | --- | --- |
| E3 重试出口 | 第3场最后run写故障→图19重试页→真实按钮重试→图20地图，state idle、eggBattles 2→3、coins22、journal空；随后move:1,2成功 | 首次教学由真实DOM定向覆盖，本场不重置ammoTaught |
| E3 跨刷新恢复/重复防护 | 第4场最后saving失败，图21 state=battleSettlement、egg3、coins22、journal非空；刷新真实选01后图22 idle/egg4/coins22/journal空；再次刷新进入仍egg4/coins22，7个ownedCards UID逐项一致 | 不覆盖开箱整理全阶段原子化或任意故障组合 |
| E4 当前失败展示 | 图23最终文案明确刷新重试，选档可操作；故障停止后真实刷新进入原01，图15及最终事件证实。先前图14为旧提示 | 模块503为受控注入，同实例缓存失败未改loader；两种Agent结果分别记录 |
| E4 旧完成归属 | 图08/09及模块delay hit证明旧04被新05淘汰，最终仅05活动 | 退出步骤是QA调用真实showTitle，不冒称纯用户点击 |
| E5 预检/回写 | 图03–07与原串比较通过上文代表矩阵，运行恢复成功与落盘失败分别判定 | 拒绝样本journal均原为null，不推及任意非空journal；构造可恢复旧格式不是全旧档 |
| E6 拒绝与兼容 | 图16未支持出牌、17未支持注能、18非法规则均可见气泡；各对应资源全等、无pending。修后supported实页金币+8/能量-1；真实绷带此前实页hp+2，修后定向阳性 | 前3场包含QA手牌覆写，第四场正常战斗无规则样本；战斗能力门不是全域规则覆盖 |

F01、F02、F03代码均已独审无新增阻断。F02最终5文件33项定向通过（新9、E6执行13、能力6、类型3、E2血量2）；F03最终3文件47项通过；Agent29与恢复入口3此前相关定向通过。检查分别执行，不能加总冒充一次全量。4个QA JavaScript最终 `node --check`通过。未运行全量或build。

最终独审已实际查看图15–23并独立重算events，无新阻断：3个拒绝样本before/after逐对象完全相同；supported差值+8/-1；第四战恢复与再次进入的完整ownedCards快照相同、同runId，最终base恰有4个battle.win回执（0,3 / 0,5 / 1,1 / 1,7）。第四战失败稳定态内存egg3，但磁盘base已egg4、旧run为21币、journal phase=base-written；恢复按journal.after补出run22币并清journal，不能把跨键部分提交误写成所有键都未变化。图20后flow的overlay字符串是已隐藏DOM残标题，实际截图与可继续移动证明弹窗已关闭。

旧图10/11/13保留为修前失败，不能当修后截图。所有主入口样本存储及journal原串只来自52971已登记隔离origin，未触碰5197旧数据。最终flush为pending=0/errors=[]。A、B及独审已停写/停测；主指挥完成本记录后交回Friday。

## 人工接手与未验

E2真实鼠标hover仍未验。已显示并保留当前窗口的既有隔离页：
`http://127.0.0.1:52971/@fs/D:/素材/代号柒/搜打撤/docs/previews/e2-snapshot-acceptance/index.html`

图24现场已选“注能样本”：双方50/50、能量2、初始攻击×2。老板操作：鼠标悬停初始攻击看说明；点选该牌后移到右侧肃清总督看4点伤害预览（不点击敌人）；移到空白看预览消退；Esc取消后点“记录当前证据”。反馈提示/4点预览/移出与取消是否正常。工具无真实hover接口，不能用键盘焦点或脚本事件替代。已报Friday转老板，等待期间主指挥停浏览器操作。既有BOSS/注能/手牌面板及血量修复有效证据复用，不重复重开。

旧04/05历史进入现象仍缺原始链、未归因；新origin成功不反证历史。全量、本地精确提交及index窗口由Friday接手，本团队没有执行。

## 精确交回文件

- 生产（5）：`game/src/ui/game.menu.js`、`game/src/hub/game.bag.settle.js`、`game/src/battle/battle.engine.js`、`game/src/battle/battle.exec-play.js`、`game/src/battle/battle.view.js`。
- 定向测试（4）：`tests/e4-async-entry.test.js`、`tests/agent-command-results.test.js`、`tests/battle-settlement-retry.test.js`、`tests/e7-rule-warning-view.test.js`。
- QA（5）：`vite.e7.config.js`，`docs/previews/e7-integration-acceptance/`内 `index.html`、`bootstrap.js`、`flow-scenarios.js`、`save-rule-scenarios.js`。
- 本RESULT，`docs/evidence/e7-integration-2026-09-27/`内24张PNG及events.jsonl；PLAN由Friday持有，独立纳入其收尾。
- 不纳入三个 `ENGINEERING-PARALLEL-*-2026-09-27.md` 盘点文档、开场列出的原未跟踪内容；不纳入任何既有E2图修改（本轮未改）。服务5197/52971保留，人工页保留，不删除/清理。
