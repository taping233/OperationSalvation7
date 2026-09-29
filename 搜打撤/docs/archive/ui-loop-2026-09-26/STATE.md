# STATE — 美术/UI/体验大修循环 0926（主代理恢复依据）

## 主目的锚
**「让玩家实机中看到、摸到的体验变好——一切决策冲突时以此裁决」**

## 任务书
`搜打撤/docs/ui-experience-overhaul-brief-2026-09-26.md`（定稿，2026-09-26）。
包络：约 9 小时（2026-09-26 23:10 开工）。包络末端只收尾不开新活；禁止中途放弃、禁止交半成品。

## 环境事实
- 仓库根 `D:\素材\代号柒`；游戏源码 `搜打撤/game`（window.SDT）；Vite 项目根 `搜打撤/`（package.json 在此）。
- 本任务专属 dev server：**http://[::1]:5180/**（仅绑 IPv6 回环！127.0.0.1 返回空壳）。后台任务 exec_092edf31。
  旧残留 5173-5176 已按老板指示杀掉，只留 5180。
- 浏览器坑（全部实测）：
  - 主代理侧：IAB 可用但 `tab.cua.keypress` 会挂死调用链（禁用）；交互走 DOM click；合成 KeyboardEvent 进不了游戏输入层（浮层关闭用 `.ak-back-tl`）；rAF 面板后台时停摆（FPS 采样须前台）。
  - **子代理侧：IAB 不可用**（"Browser is not available in subagent"）→ 标准路线=puppeteer-core+Edge/Chrome headless（参考 `.ui-loop-0926/DOC/tools/shot.cjs`）。
  - 标题页入口：#mStart=开始 / #mSettings=设置 / #mAch=成就 / #btnCardLib=照相馆；开发者面板 #titleDev 须开「开发者模式」（用完关回）。
- 测试口径：`npx vitest run <file>`（不跑全量、不 build）。
- git HEAD @开工：`dd5ac7f`（2026-09-26 18:12:33 +0800），master。
- 代理并发：固定 3-4。

## 禁碰划线（全波次有效，违者按狂奔处置）
A. 并行会话未提交改动（git status M，一律禁碰）：
- `搜打撤/docs/agent-iteration-playbook.md`
- `搜打撤/game/src/agent/**`（含 agent.state.js 共 8 文件）
- `搜打撤/game/src/battle/battle.lifecycle.js`
- `搜打撤/game/src/generated/art-manifest.js`、`thumb-manifest.js`
- `搜打撤/game/src/ui/overlay.js`
- `搜打撤/game/tools/agent-batch.mjs`、`agent-compare.mjs`、`agent-evolve.mjs`、`agent-ledger.mjs`
- **09-27 02:3x git 复核新增（并行会话仍活跃写盘）**：`game/src/run/chests.js`、`game/src/run/game.session.death.js`、`game/src/run/game.run.altar.js`（R1 的 cls2 插入与并行 hunk 并存，此后禁再碰）、`game/css/battle.css`（**争议热点**：W1 划线属 R2 但并行有未提交改动→R2 禁直改，新增样式走独立 css 片）
B. 任务书铁律永久禁区：`game/src/agent/**`、`game/tools/agent-*.mjs`、`src/generated/**`、Godot/Unity 目录。
C. 未跟踪现场（.rv-*、.review-*、_mine*.patch、package.json、package-lock.json、shots/、.tmp-ui-review/ 等）：不删不碰；删除类发现只进 APPROVAL-QUEUE.md。
D. `ui/overlay.js` 全程禁改：相关 issue 标 `escalation(overlay冻结)`，W8 终报移交。

## 阶段/波次状态（更新此处=更新真相）
- S0 开工准备：✅ 完成（起服/共享层/冒烟基线 SHOTS/PERF-BASELINE.md/链路验证/抽书）
- 阶段一 理解层：✅ **完成**（文档化 44 截图+LEG-1~7 并入；基准 22 卡；理论 A/B 各 17 情绪节点；理解书定稿 v1）
- W1 信息架构与导航：**进行中**——评审员⏳走查开单（截图 53+）/ R1✅热身完（LEG-6a verifying + w1-r1-impact.md）待领单 / R2⏳（LEG-6b+w1-r2-impact.md）
- W2 布局与可读性：未开始
- W3 玩家旅程#1（纵切）：未开始（第一靶=局末结算仪式 C17）
- W4 视觉样式：未开始
- W5 反馈与动效（含打击感）：未开始（第一靶=战斗胜利零反馈）
- W6 声音：未开始
- W7 玩家旅程#2（复测）：未开始
- W8 收敛（一致性走查+性能回归+终报）：未开始（关注项：LEG-6a 的 7.5MB 徽记未预热）

## 文件划线登记（在途修理工占用，热点单人多主）
- R1：index.html、css/base.css、css/hub.css、ui-scale.js、css/expedition-roster.css
- R2：battle view 各片、css/expedition-map.css（battle.css 争议，禁直改走独立片）

## 停止条件
- 老板宣布额度低于 20 → 立即全停。
- 波完成判据：该波 open issue 全部 closed / wontfix（双签）/ gameplay(待拍板)。
- 包络末端：issue 只许 closed 或 open（附证据移交下轮）；fixing/verifying 悬着不许收工。

## 关键决策记录（追加式，带时间）
- 0926 开工：现场核对一致；旧实例 5173-5176 识别为残留（后经老板令杀掉），另起 5180。
- 0927 02:3x 仲裁：并行会话新增 5 冻结文件（chests/game.session.death/altar/battle.css/agent.state）；battle.css 判争议热点，R2 改走独立 css 片。
- LEG-6 拆分批件：6a（R1：职业徽记+宠物蛋，挂点=选人页面板/卡角标+仓库宠物区）与 6b（R2：结算横幅，挂点=胜利搜刮页与终局页顶部）为主代理预先批件。

## 派发计数与结果（每派一个记一行）
- 链路验证代理 → 完成✅（chain-test PASS）
- 抽书代理 → 完成✅（TOC 35 章+LENSES 113 卡+RUBRIC 校准；3 项报批入队）
- 基准调研代理 → 完成✅（22 卡；RUBRIC 索引 ready）
- 文档化代理 → 完成✅（四域档案 44 截图；LEG-1~7 并入；老板留言 leveldb 恢复约 20 条）
- 理论波 A/B → 完成✅（各五节+17 节点；A=50 图、B=28 图）
- GAME-UNDERSTANDING.md → 定稿 v1（主代理裁决三笔分歧）
- W1 评审员 → 在途⏳（走查开单中）
- W1 R1 → 热身完成✅（LEG-6a verifying、impact map、27 测试过）待领单
- W1 R2 → 在途⏳（LEG-6b + impact map 已落）
- W1 评审员 → 完成✅开单12条（P1×6：W1-01数据页入口/W1-02战斗背包钮被盖/W1-03返回件四制式/W1-04定位钮离屏/W1-05宝箱无跳过/W1-10闸门零方向；P2×6）；B/E/M/T 候选全裁决归属；留任复核人
- W1 领单 → R1：W1-01/03/06/07/08/11/12 ⏳已唤醒；R2：W1-02/05/04/10/09+协作单 ⏳已唤醒
- W1 R1 → 7单全修完✅推verifying（W1-01数据页入口/W1-03返回件语法定版/W1-06标题CTA/W1-07术语定版表/W1-08危险钮分层/W1-11留言直达/W1-12零改动更正）；vitest 11文件90用例过
- W1-05 裁决：chests.js 对 R2 定向解冻（主代理逐行复核仅LEG-6b+5行）；R2 续修按 W1-03 出口语法
- 评审员 → 复核9单verifying批⏳（LEG-6a/6b+W1-01/03/06/07/08/11/12）
- W1 R2 → 完工✅：LEG-6b+W1-02/04/05/09/10 全 verifying；7文件30用例过；8文件129+/10- 全本人hunk；overlay/lifecycle/agent/generated/altar 零接触
- W1 全部 12 单 + LEG-6a/6b = 14 单 verifying，评审员复核中⏳
- W1 复核 → 14单：13 closed / 1 reopened（W1-10 方向播报假修复被评审实机对账抓出，退回 R2 真修+四向对账）；W1-12 按评审失实更正 closed；复核裁剪图 3 张留现场待批
- W8 照会新增：W1-02 的无条件 MutationObserver 反 inert（战斗常驻，关注长局性能）；LEG-6a 徽记 7.5MB 未预热
- **W1 波闭环✅**（04:0x）：14 单全 closed（W1-10 经一次退回+二次复核 72 点采样对账 closed；W1-12 评审失实更正）。波收尾五项自查过：方向无漂移/单测120+/失真警报无/W8照会2笔（MutationObserver反inert、徽记7.5MB未预热）。
- W2 布局与可读性 → **进行中**：三人组留任（评审员读 ch13/15 指定页段+处理留W2候选池 B-3/E-2/E-3/E-4/M-4/M-5/M-6；R1/R2 热身=影响图增补密度权重维度）；GAME-UNDERSTANDING 已更正定位按钮表述（R2 代码层核实为功能钮）
- W2 评审员 → 开单6✅（P1×1 W2-01撤离钮arm无回弹；P2×5）+候选池7条全裁决（M-5归档/M-6复测关闭）+密度锚点探针
- W2 领单 → R1：W2-06/02/03/04 ⏳；R2：W2-01/05 ⏳（chests.js 定向解冻复核成立：+11/-3 全本人）
- W2 R1 → 4单全verifying✅（W2-06数据页布局/W2-02钥匙三通道收敛/W2-03经济总览行/W2-04整备页权重）+w2-r1-impact.md；56用例过
- W2 R2 → 2单verifying✅（W2-01 arm视觉升级+间距分级，事实更正"无回弹"开单；W2-05 宝箱档位色带）+w2-r2-impact.md 含结算页阶梯预案（W3 取用）；24用例过
- W2 全 6 单 verifying → 评审员复核中⏳
- **W2 波闭环✅**（04:4x）：6单全closed（W2-01含评审失实更正：rg单行漏跨行；M-5/M-6归档有据）。波收尾五项自查过。
- W3 玩家旅程#1 → **进行中**：评审员新档走整局+五件事审查+边走边开单；R1 预映射局外动机（XP可见性靶）；R2 结算仪式预案细化待单即修
- W3 评审员 → 完成✅：星月整局至 L2 阵亡；开单4（W3-01局末零XP P1/W3-02对局内XP无载体/W3-03治疗卡误指仅log/W3-04 gameplay=L2对牧师过陡，推翻"主观不可感"旧结论）；五件事对照表=C17精确复现；41截图
- W3-01 裁决：death.js 对 R2 定向解冻（diff 仅 LEG-6b+5 行）
- W3 领单 → R2：W3-01/03/02 ⏳；R1：无单，转 W4 视觉一致性预盘点
- 包络决策预告：W3 收波后，W4/W5/W6 拟合并为一次三透镜联查走查（issue 按波标注、各波判据独立验收）以保 W7 复测与 W8 终报窗口
- W3 R1 → 我域0单✅；双交付：w3-r1-plan.md（局外动机呈现预案A-E备好）+ **w4-r1-plan.md（W4根因清单：F1双:root双token语义漂移P0/F2金色token零通电+430硬编码/F3圆角制式外145处/F4 --serif名不副实/F5 eyebrow半数缺位，含分批收敛改法）**
- W3 R2 → 三单verifying✅（W3-01结算XP行+阶梯全套+classSummary取值bug顺手修/W3-03误指红框抖动/W3-02顶栏微条轻做）；37用例过；death.js+34/chests.js+30/battle.view.js+48/aim.js+17 全本人hunk
- W3 复核⏳（含 aim pending 态全体敌人可点的开单裁决请求）
- **W3 波闭环✅**（05:5x）：3 呈现单全 closed + W3-04 gameplay 待拍板。C17 局末结算塌陷修复闭环（结算 XP 行+跨级宣告+对局内微条+classSummary 取值 bug 顺手修）。评审裁决 aim pending 疑点=不开单归 W5。
- **W4/W5/W6 联查 → 进行中**：评审员三透镜一次走查（W4 用 F1-F7 清单抽验开单/W5 含归档池+击败爆点第一靶/W6 自建听觉基线）；R1 主 W4 批1 等值替换（批4 token 合并待主代理专项授权）；R2 主 W5 打击感（尊重震屏开关与 reduced-motion）+归档池；W6 新音效文件禁做（触发/音量/挂接可修）
- W4/5/6 评审 → 开单16✅（W4×5含F清单转正/W5×8含T-1转正永不移除实锤/W6×3自建听觉基线）；W5-01+W6-01+W6-02=击败瞬间三面一体同一人改齐
- W6-01 裁决：victory 音从 chests.js 胜利渲染点接线（battle.lifecycle 真并行冻结不碰）
- W4-02 裁决：圆角不发明新制式，向既有 --radius-* 三档收敛，样张留档 W8 展示
- 领单 → R2：W5-01/03/04/05/06/07+W6-01/02 ⏳；R1：W4-01/02/03/04/05+W5-02/08+W6-03 ⏳
- W4/5/6 R1 → 8单verifying✅（W4-01批1金色125处等值/W4-05冷蓝token60处/W4-02圆角81处归一R2域3处回退移交/W4-03字体正名/W4-04 eyebrow七面/W5-02看门狗重写/W5-08图标ALIAS零新素材/W6-03页签音）；67用例过；自抓token自引用bug修复
- 主代理裁决：批2（alpha~230）/批4（双:root合并）/R2域金替换（~300）→ **移交下轮**（终报列明），不占包络末端
- W4/5/6 R2 → 6单verifying✅（W5-01击败爆点30ms采样序列证据+双门开关/W5-03意图图例一次性/W5-04跳字分级/W5-06 pendingItem过滤/W5-07徽章整组隐藏/W6-02音量Accent归位）+W6-01评审失实更正（victory本已接线，rg字面漏条件式——第三起同型误判）+W5-05 stuck→open移交下轮（altar三方占用）；41用例过
- 评审员联审16单⏳
- **W4/W5/W6 三波闭环✅**（07:2x）：16单=15 closed + W5-05 open合法移交（stuck→open附预案）。W6-01评审失实更正成立（victory本已接线，第三次rg字面漏判，教训入结论）。W6听觉基线建成。
- W7 复测 → 进行中⏳（评审员七靶位聚焦复测+曲线对照表）
- W8 → 主代理并行启动：性能回归采样（对照 PERF-BASELINE）+终报装配
- **W7 复测闭环✅**（07:5x）：七靶位 7/7 过（含震屏双门 0/13 采样对照）；曲线「高开中平终塌」→「高开→小峰→微坠→缓坡收」，C17 终局 −3→−0.5。
- **任务完结✅**（包络内收官）：终报 FINAL-REPORT.md 落盘（W7 节已补）；交接文档已更新；巡检 cron 已撤（任务完结）。issue 终态=39 closed + 7 open(附证据移交) + 1 gameplay；fixing/verifying 零悬挂。
