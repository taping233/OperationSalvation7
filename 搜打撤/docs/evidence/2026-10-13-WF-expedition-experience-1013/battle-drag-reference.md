# 战斗拖牌源码对照与定向回归

2026-10-13：拖牌已改为拿起容差、中心跟随、跨线瞄准、真实命中与一次性释放。点击保持阅读完整大卡，明确使用后再选择目标；敌人只有一个也不自动出牌。页面真实拖拽与视觉验收交主协调的 1920×1080 冻结页，本记录仅覆盖源码核对和 jsdom 构造输入。

## 真实源码依据

以下参考只读，未修改外部源码：

| 路径（均位于 `D:\素材\杀戮尖塔2源码\sts2-decompiled\`） | 已核实内容 |
| --- | --- |
| `MegaCrit.Sts2.Core.Nodes.Combat\NMouseCardPlay.cs:143–196` | 出牌线为视口高度 0.75；抓取点低于线时取 `max(line, startY−100)`，高于线时取 `min(line, startY−50)`；取消线高度 0.95。 |
| `MegaCrit.Sts2.Core.Nodes.Combat\NMouseCardPlay.cs:335–348, 426–461` | 单目标进入 `CenterCard` 后开始目标会话；`LerpToMouse` 把鼠标位置设为 holder 目标位置；取消区只有曾离开后才生效。 |
| `MegaCrit.Sts2.Core.Nodes.Cards.Holders\NHandCardHolder.cs:476–482, 570–585, 643–667` | 每帧位置插值 `delta×7`；BeginDrag 将角度归零并立即设 HoverScale；取消后归还默认手牌位置、角度与缩放。 |
| `MegaCrit.Sts2.Core.Nodes.Combat\NCardPlay.cs:193–212, 263–302` | 缺少合法单目标及不可打出时取消；CenterCard 停靠底部中心，源码缩放 0.75。 |
| `MegaCrit.Sts2.Core.Nodes.Combat\NTargetingArrow.cs:197–204` | 鼠标模式箭头尖直接跟鼠标；`delta×14` 仅用于控制器跟随，不套在网页鼠标上。 |
| `MegaCrit.Sts2.Core.Nodes.Cards.Holders\NCardHolderHitbox.cs:44–47` | Ready 仅连接基类信号，本类没有新增鼠标移动拿起距离。 |

## 网页适配与现行行为

- 6 CSS 像素仅区分轻点和拖动，属于网页输入适配。原源鼠标按下即可 BeginDrag；本项目点击必须先阅读，因此容差内不抬牌、不播放拿起音效。
- DOM 以卡牌可见中心适配 holder 目标位置，指针减中心后除当前 UI scale 得到布局位移。位置用 `1−exp(−7×dt)` 插值，保持源代码速度参数并减少不同刷新率差异。少动效模式立即跟随，不播放拿起闪光。
- 指向卡跨源码出牌线后停靠底部中心并出箭头；停靠期间箭头尖始终跟鼠标，敌人真实命中时显示原目标预览和高亮。移除了敌图周围 72/108 像素的宽松落点。
- 卡牌自由拖动与停靠均保持 1.07 显示尺寸，沿用老板此前“不缩短卡牌”的约定；这是对源 CenterCard 0.75 缩放的明确适配。
- 松手前同步处理最终指针坐标，覆盖 down/move/up 同显示帧的快速手势。合法目标只提交一次；死敌、失效场次、能量不足、空白区域或返回取消区都回手。自指向卡要求落在玩家；无目标牌要求跨线并落在战场，排除 HUD、手牌及按钮。
- 取消覆盖右键、Esc、Tab、pointercancel、lostpointercapture、失焦、窗口尺寸变化、页面隐藏、输入法 compositionstart 和卡节点脱离。Esc/Tab 捕获后不穿透；组合中的 Esc/keyCode 229 留给输入法。
- 兼容战场重绘会刷新快照、费用、命中会话和 overlay 坐标；手牌槽位/尺寸或结构变化仍取消旧拖动。所有取消清除箭头、目标反馈、帧回调、捕获与临时监听。

## 验证

- `npx vitest run tests/battle-drag-reference.test.js tests/battle-hand-inspector.test.js tests/cov-target-session.test.js tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=dot`：初轮 5 文件 80 项通过；新增无目标牌中间区取消回归后，共享树 82 项中 81 项通过。本任务 17 项拖牌回归均通过。主协调新加的九身份 fixture 初次期望 9、得到 1，筛选武术/法术后该项通过；随后暴露九叠后轻点用例失败，单跑 `-t 'pointer tap'` 通过。只读定位到 `battle.layers.js` 离场槽位先退出 Map、240ms 后删 DOM，而换场只清 Map 中槽位，可能让下一场首节点带旧 UID；已交父代理处理。最新整组不记全过，主协调修复后补验。
- `npx eslint game/src/battle/view/battle.aim.js tests/battle-drag-reference.test.js`：退出码 0。
- `git diff --check -- game/src/battle/view/battle.aim.js`：退出码 0。
- 首次沙箱测试受 `node_modules/vitest/dist/spy.js` realpath EPERM 阻止，未执行任何用例；使用正常审批工具重跑同一现有环境后得到上述通过结果。未安装依赖、构建、开启服务或提交。

新增 17 项拖牌回归覆盖：点击容差、中心锚点与平滑、scale 换算、少动效、跨线及真实命中、快速释放、死敌/费用/场次/异指针、无目标合法战场、自指向目标、五类取消、IME 与 Tab、取消线/节点脱离、无目标牌经过中间区后的取消、兼容重绘与槽位变更。大卡测试继续验证单敌也明确选目标、数字/Enter 打开完整大卡、Esc/Tab 阅读层拦截。

## 文件与待核范围

本任务仅修改/新增：

- `D:\素材\代号柒\搜打撤\game\src\battle\view\battle.aim.js`
- `D:\素材\代号柒\搜打撤\tests\battle-drag-reference.test.js`
- `D:\素材\代号柒\搜打撤\docs\evidence\2026-10-13-WF-expedition-experience-1013\battle-drag-reference.md`

待主协调在当前平台内置浏览器实页验证：220 逻辑像素新手牌版式中的中心锚点、跨线停靠、真实连续拖拽跟随与释放、CSS 归零扇形角度及回手动画。父布局应对 `aim-lift` 去掉指针拦截、禁拖动中的 CSS transform transition，并对手牌预设 `touch-action: none`。截图和本记录的 jsdom 输入不能代替真实拖拽验收。
