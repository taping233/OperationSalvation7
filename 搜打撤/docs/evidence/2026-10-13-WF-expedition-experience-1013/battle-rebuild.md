# 战斗重建实施记录

2026-10-13，Friday / Codex，专用战斗聊天。状态：授权源码实施已交付，未提交；最终视觉、真实指针与冷加载验收由主协调继续。旧战斗美术通过结论无效，本记录不宣称新的美术已通过。

## 参考对应与实现

实际查看本目录 `reference-images/sts2-current-1.png` 与 `arknights-is6-battle.jpg`。前者采用完整中部单位、贴身生命、底边手牌、左能量/右结束回合；后者采用边缘资源、固定系统操作、中央场景留白。图源与 SHA 复用 reference-board-sources.json 与 reference-images/sts2-full-sources.json。保留本作冬境分层景和原角色/卡框，本轮无需额外位图。

| 区域 | 本轮落地 |
| --- | --- |
| 全屏战场 | 重写 battle-sts 生效样式块，人物390、敌人330逻辑高；意图在头上，名称/生命/状态贴单位下方。独立顶栏只呈现地点、回合、阶段和选项。 |
| 左下操作 | 能量改独立八角容器，牌库计数贴邻；职业技能在左下玻璃承托上呈现真实费用。 |
| 右下操作 | 单一结束回合、次级背包与弃牌/消耗计数，撤离/设置移至顶栏选项。没有额外胜利页。 |
| 九叠手牌 | 220逻辑宽，取真实HandPosHelper的1—9张位置表，横向按容器缩放，弧高原值×0.3、角度×0.25。名称/即时费用/叠数在各叠露出区；数字位置就近显示。悬停抬92逻辑像素，点击仍打开420逻辑宽完整大卡，长规则保留旁列全文。 |
| 拖拽 | 使用真实StS2鼠标拖牌的中心锚点、75%出牌线、95%取消线与速度7。6显示像素是本作区分阅读点击的容差；停靠保留此前不缩短卡牌约定。详见 battle-drag-reference.md。 |
| 入场 | 首个可绘制idle纹理就绪并提交renderer后揭示；剩余帧后台补齐，换角色/换页取消旧批次。详见 battle-entry-first-frame.md。 |

只读源码参考根为 `D:\素材\杀戮尖塔2源码\sts2-decompiled\`。手牌实读 `MegaCrit.Sts2.Core.Helpers\HandPosHelper.cs:8–180` 的位置/角度/基础缩放表，和 `MegaCrit.Sts2.Core.Nodes.Combat\NPlayerHand.cs:809–847` 的各卡位置、邻卡让位与目标角度逻辑。本作保留220px卡面和九叠分页，未采用原作随张数缩小的0.8/0.9规则；参考适配与原参数区分明确。拖牌实际源码行号见专属记录。未修改外部参考源、engine/effects、牌效或玩法数值。

## 额外确认的生命周期修复

新增九叠与下一场轻点序列实际暴露旧UID残留：单位挂载先写共享battleToken，手牌随后误认为已核对新场次；同时离场槽先退出Map、240ms后移除DOM。已拆分handBattleToken/unitBattleToken，换场直接清空常驻手牌子节点。当前场次重绘仍保留手牌与单位节点。数字键、Enter及目标键盘入口补齐IME组合守卫，手牌悬停撤掉重复的跟鼠标操作说明。

## 验证与边界

- `battle-rebuild-final-tests.json`：实际收集9文件、118项全部通过，覆盖hand-layout、hand-inspector、expedition-battle-presentation、e2-view-hp、battle-drag-reference、battle-frames-lifecycle、battle-entry-readiness、contracts、architecture-boundaries。命令还给了不存在的battle-target-session路径，该名称未收集、不计覆盖；真实目标会话为cov-target-session，拖牌子任务此前该文件19项通过。
- 修改的5份生产JS与4份测试定向ESLint退出0；两份CSS经PostCSS解析通过；相关tracked diff空白检查退出0。
- `docs:check -- --json`退出0、findings为空；该守卫扫描现行文档入口，按工具口径跳过evidence，不能据此宣称本记录正文被自动审查。
- 首次沙箱Vitest在依赖realpath处EPERM，未执行用例；通过正常工具自动审批后使用原环境。布局初次失败是0/-0测试断言；九叠初次fixture包含不入手牌类型，随后序列失败确认上述旧UID问题并修复。旧失败报告不作通过依据，最终118项为准。
- 定向jsdom构造输入不代替真实指针或视觉验收。未进行build、安装、服务启动/停止、浏览器操作、删除文件、提交、推送或性能前后采样。5372/5373页面未操作。
- 当前1920×1080真实九叠阅读、长规则、目标预览、实际连续拖拽/回手与冷暖首帧仍待主协调冻结页验收。没有实测加载时长，不报告具体提速数值。

## 尚需主协调处理的入战依赖

节点属地禁止本聊天编辑。当前只读核对 `game/src/run/game.run.flow.js:197–199` 的进入战斗选项仍调用 `enterNode('battle', ...)`；`game/src/run/game.run.scenes.js:241–254` 对battle/boss仍调用city-cut接敌过场。要达到老板的“确认事件选项后直接开战场”，节点负责人需让战斗确认直达openBattleCell，或在enterNode对battle/boss直接调用done并保持上下文守卫。不能用缩短ready等待替代移除这段重复过场。

## 本轮完整路径清单

路径均在 `D:\素材\代号柒\搜打撤\`：

- `game\src\battle\view\battle.view.js`
- `game\src\battle\view\battle.layers.js`
- `game\src\battle\view\battle.hand-layout.js`（新增）
- `game\src\battle\view\battle.aim.js`
- `game\src\battle\view\battle.frames.js`
- `game\css\expedition-battle.css`
- `game\css\battle-hand-overhaul.css`
- `tests\battle-hand-layout.test.js`（新增）
- `tests\battle-hand-inspector.test.js`
- `tests\battle-drag-reference.test.js`（新增）
- `tests\battle-frames-lifecycle.test.js`
- `docs\evidence\2026-10-13-WF-expedition-experience-1013\battle-rebuild.md`
- `docs\evidence\2026-10-13-WF-expedition-experience-1013\battle-rebuild-handoff.md`
- `docs\evidence\2026-10-13-WF-expedition-experience-1013\battle-drag-reference.md`
- `docs\evidence\2026-10-13-WF-expedition-experience-1013\battle-entry-first-frame.md`
- `docs\evidence\2026-10-13-WF-expedition-experience-1013\battle-rebuild-layout-tests.json`（失败轮记录，最终报告取下项）
- `docs\evidence\2026-10-13-WF-expedition-experience-1013\battle-rebuild-final-tests.json`

本聊天及子代理已停止编辑属地，根登记由主协调维护；已有胜利380ms反馈与game.bag.settle奖励事务未改。
