# 密集状态布局整改

状态：源码与定向验证完成，当前窗口实页复核由主代理进行。

## 已确认的问题

已查看 `screens/status-8.jpg`：1280×720 当前窗口中，三名敌人各8项构造状态；敌方状态区 y478、高79、宽166，进入 y519 的消耗堆；随从状态区 y480、高141、宽127，与 x540、y510 起的手牌相交。它们是展示状态构造测试，不证明玩法触发。

原样式的状态区不限高。另一个活规则在敌人／随从 hover 或 focus-within 时让姓名行进入普通流，继续把状态区向下推，因此单纯限制状态列表高度仍不能保证阅读时的边界。

首轮有界方案在 `screens/status-8-99-fixed.jpg` 中已消除碰撞，但当前窗口自然变为1074×956、游戏缩放约0.559，12 CSS px 的下方说明只剩约6.7屏幕px，无法清楚阅读。因此将数量说明移到同排并增大字号，取消下方说明行；本轮没有主动修改窗口。

第二轮同排方案的实页矩阵已确认计数与不遮挡，但1074当前自然窗口中，紧凑随从条宽106屏幕px，名称、99回合与数量竞争宽度，仅能同时显示1项。主代理据此授权第三轮：在16个独立机制图标已接入的前提下，敌人／随从的视觉紧凑项固定使用图标＋纯数字；全文和真实单位继续保留在ARIA与词条说明。玩家保留全名和单位。

## 当前实现

- 敌人与随从：原生纵向滚动列表最多28 CSS px；玩家保留两行全名阅读空间59 CSS px。数量与列表使用同排两列 `minmax(0,1fr) max-content`，数量18 CSS px、行高28，不增加总高度。实页仍须核对实际像素与紧凑列宽，不把预算当作通过证据。
- 0项保持真正空容器。1／4／5／8／16项沿同一个宿主和固定密度，不在第五项换形。没有删去任何状态节点；可见数量为“N项↕”，组的可访问名称和现有词条提示保留完整的上下滚动、Tab逐项说明。额外词缀／标记同样计数、可聚焦。
- 玩家full保留名称、数值与单位；敌人／随从compact固定视觉隐藏`.status-name/.status-unit`，只显示18 CSS px图标与18 CSS px纯数字，flag仅图标。数字使用两位数最小盒，chip目标约49 CSS px，给当前随从同时2项、敌人同时3项留空间。当前窗口的最终可见项数仍待主代理复核，不把CSS预算当实测。
- `.status-value/.status-unit`分别保留原始数值和单位；名称也留在DOM，完整名称、回合／层数／次数／开关语义在`aria-label`和原tooltip中完整提供。正负颜色、激活条件、排序不变。焦点采用内描，避免滚动边界切掉焦点框；触屏保留原生纵向滚动。
- 状态列表和数量说明属于局部阅读区，click 只停止向单位目标事件冒泡，不取消原生默认行为；既有词条捕获、聚焦和滚动继续工作。没有 document 级新增输入拦截。
- 姓名 hover／focus 继续可读，改在原名牌上方绝对显示，移出状态流；`bottom:calc(100% + 54px)` 与既有名牌锚点相抵，提示位置不随状态数改变。单位、血条、手牌、意图坐标未改。
- keyed 状态节点、滚动宿主、滚动位置和已有 tooltip `aria-describedby` 保留。0项回收列表和辅助说明。

## 修改归属

- [game/css/battle-status-chips.css](../../../game/css/battle-status-chips.css)：有界列表、数量说明、原生滚动及焦点边界。
- [game/src/battle/view/battle.status-chips.js](../../../game/src/battle/view/battle.status-chips.js)：列表宿主、准确数量和说明、额外标记可聚焦、阅读区域局部输入隔离。
- [game/css/battle-stage.css](../../../game/css/battle-stage.css)：沿原有两处姓名职责规则整改；未在新 CSS 追加重复覆盖。
- [tests/battle-status-presentation.test.js](../../../tests/battle-status-presentation.test.js)：适配宿主并补数量、空态、滚动位置、节点身份、输入隔离，以及compact/full视觉区别与完整ARIA／tooltip验证。

首次编辑前原文和 SHA256 保存在本机临时目录 `C:\Users\太平\AppData\Local\Temp\p3-status-layout-1024\before.json`；`battle-stage.css` 在获得追加授权后、编辑前补入该清单。保留原有未提交改动，未按 HEAD 重建文件。

同排数量迭代前另存 `before-inline-count.json` 及对应原文；本次仅修改状态 CSS、状态模块和对应测试，姓名职责规则未再改变。

## 定向验证

- `npx vitest run tests/battle-status-presentation.test.js --reporter=dot`：第三轮1文件、8测试通过，退出码0。新增用例真实载入该CSS，核对compact视觉隐藏名称／单位而full保留，数值、flag及完整ARIA／tooltip不丢失。此前两轮7项通过记录保留为各版本验证，不替代当前实页。
- `npx eslint game/src/battle/view/battle.status-chips.js tests/battle-status-presentation.test.js`：通过，退出码0。
- PostCSS 解析两个修改 CSS：通过，退出码0。
- 定向 `git diff --check`：通过，退出码0。Git 提示 `battle-stage.css` 既有 CRLF 后续写入时规范化为 LF。

## 冻结与近邻接管边界

本分片最终源码为第三轮compact图标＋纯数字版本，玩家full名称／单位保留；此后未再编辑状态CSS、helper或测试。主代理最后修复的是分类底板／背包卡面CSS级联，详见 [settings.md](settings.md#主代理追加的最终级联接管)，不把它混记为状态密度的第四次修改。

本代理未启动服务、未用浏览器、未 build、未提交。以下结果由主代理使用当前平台内置浏览器取得，本代理核对证据文件后追加；不是根据截图文件名自动推定通过。

## 主代理最终实页结果

2026-10-24，Codex内置IAB tab6，当前自然1280×720窗口；没有主动切换多尺寸。最终版本为 [status-16-99-compact-final.jpg](status-16-99-compact-final.jpg)，第三轮图标＋纯数字。旧 `status-16-99-final.jpg` 属于第二轮，不能作为最终compact版本截图。

| 场景 | 真实结果 | 证据 |
| --- | --- | --- |
| 16状态、数值99的密度与几何 | 随从同屏2项，三名敌人各3项，玩家full保留两行；玩家区39.325屏幕px、紧凑区18.6625屏幕px，对应59／28 CSS px。当前场地不遮手牌、消耗堆或结束回合。 | [最终截图](status-16-99-compact-final.jpg)、[冻结输入指纹](status-final-runtime-inputs.json) |
| 0／1／4／5／8／16状态 | 玩家、随从、三敌人共5组节点数全部正确；0项高度0；4→5→8→16高度固定，不发生第五项全组变形。 | [status-count-matrix-final.json](status-count-matrix-final.json) |
| 1／9／10／99与开关 | 纯数字两位数盒约14.4125／14.425屏幕px；flag没有假造的“1”。full的真实单位、compact完整ARIA／tooltip保留。 | [status-amount-matrix-final.json](status-amount-matrix-final.json) |
| 键盘末项与原生滚动 | 实际Tab聚焦末项“攻击降低99回合”，原生`scrollTop=217.2`、`clientHeight=28`、`scrollHeight=245`，焦点内描清楚。 | [status-keyboard-scroll-final.jpg](status-keyboard-scroll-final.jpg) |
| 先拿牌再读状态 | 先实际选中初始攻击卡，再点击敌方首个构造展示状态；能量维持2/2，选中牌保持，没有提交攻击，tooltip完整显示当前量及机制。 | [status-input-isolation.json](status-input-isolation.json)、[status-tooltip-and-input.jpg](status-tooltip-and-input.jpg) |

这些状态来自只读展示snapshot构造，证明当前场地的排布、读数、滚动、键盘和局部输入隔离；不证明卡牌实际施加了这些状态。构造本身不改引擎或存档，阅读点击未触发出牌／扣能量。该记录没有触屏实机输入、真实状态施加／到期、死亡／换token及全部边缘布置的实页证据，不把本局结果扩展为所有玩法场景通过。

主代理另报告87项定向测试批次通过；随后卡片aura减少动态契约先失败、修复后7项通过。两批有不同执行时点和覆盖范围，不相加为94项或称为全量测试；本分片此前8项状态测试仍按其独立执行记录保留。
