# 主协调接班

2026-10-13。老板明确要求新开聊天替代上下文过长的主聊天 01a13311。本文件是继续工作的状态交接，不代表任务完成。旧主聊天在交接后停止源码编辑。

## 目标与授权

全面整改代号柒离开基地后的正式流程，以真实二游参考板复刻，重点精致度、比例、留白、易懂、无重复文字、连续交互和完整动效。老板反复否决前两轮地图/战斗美术，旧“视觉已过”结论无效。原设计可重构，可生成新美术；卡牌/角色和规则沿本作内容。

老板已明确此前相关占用结束，可全部接管；授权并行代理和指挥其他聊天，随后要求子代理用 Sol、强度自行选；上下文长就用新专用聊天，不能借旧聊天承载新任务。无提交/推送/发布/删除文件授权。只开发搜打撤 Vite，Godot/Unity/EXE冻结，外部参考源码只读。

最新特别要求：战斗界面推倒重来；入战流程太长；拖牌手感很差；项目有杀戮尖塔2源码可以照抄，结合多个二游风格。该工作已派到新的专用战斗聊天。

## 当前在途聊天

| 聊天 | 状态与属地 |
| --- | --- |
| 01a133b8-aebd-7632-82ed-19b6c8df3aac「代号柒地图与通行整改」 | 新专用Sol high。地图视觉、旧手绘图标、当前头像/指示、空白路径直达与正式通行动画。必须等旧地图聊天的 map-handoff-to-new-chat.md 明确编辑释放后写入。 |
| 01a12a56-fff8-7393-a312-6f8f01036d55「评估选人到地图节点体验」 | 旧地图载体，已发停止及最小交接请求，不再承载新工作。停止内部写代理、保留现场、写上述交接文件；尚需核实释放声明。不可假定已停。 |
| 01a133bf-cfb6-7480-a3e0-5be36c3a9f16「代号柒战斗界面重建」 | 新专用Sol high。整张战斗UI与拖放重建，允许自己拆新的Sol代理；保护引擎规则、点击先大卡、存档P1与结算事务。 |

主任务三个新的 Sol 子代理均已交付源码并停止写入，后续新协调可直接接管其路径：

- sol_console_leave：控制台来源DOM/动作/input/hover/焦点恢复，Ctrl+L全部tab、repeat/IME与迟到render守卫；商店大卡开收动画；离开对局浅灰中央面板、独立放弃确认、保存严格true才离开。证据 console-lifecycle.md / leave-run-replica.md。相关70项通过；完整boot两项照相馆旧失败未扩修。
- sol_node_flow：全部节点明确事件/选项接线，入口补给手动触发/领取前不发卡，火堆确认才收益/结果保存，接敌确认才抽怪，宝箱确认才搜索，物资固定二选一与大卡/领取分离，空白/消耗终点安全页；pickupGo共享一次锁并不关闭回调新页。证据 node-flow-completeness.md。核心最终5文件32项、相关两组129/53项通过，计数有重叠勿加总。
- sol_battle_redesign：中间版StS2手牌上沿身份区、低弧270逻辑高、420大卡、右下背包/结束回合、其他收选项；战场380ms短胜利反馈直入领奖；ready门等待正确场景/当前图与首帧，异常可简化继续。89项及架构37项通过。但老板随后再次否决外观，全部交新战斗聊天推倒重做，不要把中间版作为完成。

## 文件边界

- 地图新聊天：core/{renderer,map-node-art,camera}.js、run/expedition.view.js、map/HUD CSS和feedback-oct12仅地图段、空白路径helper；game.run.flow.js仅moveTo/activeMove前约107行；game.boot.js仅地图点击/confirmTarget。
- 节点已完成增量：flow resolveCell/runInstant之后（与moveTo定向patch分界），altar openFireRest/openEntrySupply/confirmClass补给，session/kernel/save validation及node-reward-state helper。地图字段 game.entrySupply={version:1,layerIdx,trackPos,cardIds,taken}；game.nodeRewards存火堆/物资结果，fire.continued区分结果未继续。
- 控制台：game.run.dev.js、game.boot.js仅Ctrl+L段、shop来源恢复/动画；game.menu.js离开相关与leave-run.css。root给leavePanel加了options.motionKey。
- 选人/整备首版：roster-departure-v2.css有效规则、roster-reference.css、departure-selected.css、feedback-oct12仅旧depMain根排除departure-glass；altar157/178/423展示及skin同步、hub.depart157/173标记。统一5标准/3场景皮肤容器、缩略图、玻璃分区；79项相关通过。另5项基地异域回归失败有记录，不自动扩修。
- root公共增量：overlay.js页面revision/旧焦点与背景加载取消、卡Zoom离页清理、重复close类清理；ui.js大卡hideNote/presentation=expedition及Esc单层隔离；hud.hideTooltip空安全；term-tips离页清理；interface/surface/page-motion-profiles统一区域入场、motionKey、节点退出220ms；scenes统一nodeShell及240ms节点短切幕、旧过场owner守卫；departure-transition新增startDepartureHandoff，hub.depart确认先遮挡再newRun，避免地图抢先露出；entry-events实际active反馈；expedition-transitions.css。

## 必须完成的验收要求

1. 地图仍未获认可：原图的近透明承托、小图标、窄标签与成组流向线；禁止前版大灰黑底板/黑长条。旧6类手绘图标保持。头像与明确当前位置加回。已知中途全空白可点终点通行，不能跳未处理事件/门/跨层，保留每格计数和稳定保存。
2. 所有交互节点都有独立事件页和选项；入口补给手动；火堆单独休整/离开；物资点击阅读、独立收下；节点进入/点击/离开动画完整。
3. 战斗全新设计和真实拖牌手感；点击/数字键/Enter先大卡，明确使用后再目标；单敌不自动打出。压短入场，不能旧地图闪现、空角色；去掉重复独立战胜过场。
4. 选人所有标准/皮肤的容器、大小位置；整备透景玻璃但卡与文字锐利；出发遮层先挂，过场后只地图。
5. 控制台使用/关闭/回来源、离开对局/放弃二级确认、商店大卡开收动画，真实输入复核。

## 真实参考与本地源码

- 本轮 reference-board.html / reference-board-sources.json / sts-reference-sources.json、reference-images。都是实际查看的真实截图，静态图不能证明动效时长。新增 roster-preparation-sources.json 两条尚需汇入总板。
- 杀戮尖塔2真正源码：D:\素材\杀戮尖塔2源码\sts2-decompiled\。重点 Nodes.Combat 的 NMouseCardPlay/NCardPlay/NCombatUi/NCardPlayQueue；Nodes.Cards.Holders 的NHandCardHolder/NCardHolderHitbox/NCardHolder；用rg找手牌、TargetingArrow。steam-pck-text有场景配置。只读，直接核实参数，不用旧Godot经验文档当现行事实。
- 当前官方StS2图 sts2-current-1.png/-2.png及sources/SHA，均>1MB不git；其他大参考也记reference-image-manifest.json，不自动提交。

## 运行与浏览器现场

- 老板明确把内置浏览器统一标准1920×1080；旧主的browser2 viewport.set已应用并实测innerWidth1920/innerHeight1080、zoom1。新聊天自己的IAB也要设同尺寸；这是老板请求保留的标准，不重置。
- 5372：老板当前预览的阶段冻结副本。PID18688、exec87585，旧主创建；.tmp/WF-expedition-experience-1013/runtime/game，HMR关闭、独立Vite缓存、素材junction只读使用。不要打断老板当前页面，不据源码已改就声称预览已同步。
- 5373：独立新档验收。PID7712、exec40974，旧主创建；verify-runtime/game，HMR关闭、独立缓存。同目录serve-verification.mjs。当前复制版本比最后Sol节点/控制台/战斗完成更早，需同步稳定源后再做最终复核。
- snapshot.mjs支持参数 runtime 或 verify-runtime，复制src/css/data/index/version，写source-manifest并检查复制时drift；素材junction创建受沙箱限制时require_escalated正常权限。无build。
- 5372隔离slot01曾真实出征、事件/领奖/战斗测试，layer2；战后未领和已领刷新恢复已实页通过，钱+2未重复。当前老板已采用该页，不继续用来构造测试。5373新origin slot01新档，当前选人“无”未出发，40-roster-standard-1920.jpg为新玻璃容器稳定画面；只有无标准已看，其他人物/皮肤/整备还需实页。
- 旧主IAB tab6=5373，tab5曾=5372；工具句柄跨聊天不可复用，且曾多次失效。新协调用自己的IAB开独立页，绝不外部Edge/CDP/headless。原5200/533x/534x/535x/536x服务不归本任务，勿停。
- 验证副本曾有qa-controls.js可见构造按钮；5372 index被注入该脚本。只在隔离副本，不在生产源。最终交付预览要移除index注入文本（不删除文件），记录构造范围。

## 证据与未完成

早期final-target-tests.json 315项通过，只覆盖早期阶段，不能代表随后全节点/地图/战斗重建。departure-handoff-tests.json通过，card-layer-tests17项与节点旧38项通过；最新各子任务报告以自己的证据为准，勿加总。typecheck八配置和docs守卫曾通过，源码后又变化，最终需要受影响补验。

未stage/commit/push/build。共享树已有大量他人成果，保留归属。根PARALLEL-REGISTRY本任务自有行还活跃，PENDING41旧协调问题已按老板“结束可占用”记已决。新协调接管本任务登记和服务链，达完成标准后销账，预览若留给老板需明确资源记录。

下一动作：核实旧地图停止与新地图接手；同步稳定的非战斗源码到5373，按1920标准走5人物/3皮肤/整备/出发/入口补给/火堆/节点/控制台/退出完整链；等新战斗和地图实际实施，用真实来源/实页对照返修；完成最后定向集成检查，再同步可交付预览。审美直接被老板否决就继续，不以测试过或按钮齐全宣布合格。

新主聊天：01a133c4-ab2f-7571-814e-5b57bd91c021，标题「代号柒整体整改接班」。创建与交接已确认；旧主源码编辑已释放。任务与两项服务资源登记已移交新主，未停止服务、未提交。
