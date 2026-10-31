# 当前原始战斗 UI 迁移

本片按现行运行源迁移常驻战斗呈现树，保留权威 Core 命令与快照。源码对照和语法检查不代表原生效果通过；主会统一编译、新图、真实输入及独立审查仍须执行。

## 原始模块对应

| 现行原始模块 | Unity 对应 |
| --- | --- |
| battle.view / battle.stage-view | BattleScreen、BattlePresentation：常驻场景/HUD区域，快照只同步区域；共享顶栏104由 DesktopRunHud 独占 |
| battle.scenery | 当前轨道站 far/ground/foreground 三层；整场景上移110；地面底线28%+110 |
| battle.layers、enemy-portrait-presentation | 按敌人ID+同ID序号保留单位节点；原表31个身高/体形/透明边距参数；角色27%、敌群54%～90%、盟友35%～52% |
| battle.hand、battle.hand-layout、battle-stage.css | UID继承分组与回合稳定槽序；9组分栏；260×390、步距min(190,(available-260)/(N-1))、rot0/scale1；常态下沉64、阅读上抬30、选中回到0 |
| battle.infusion-view / battle-infusion.css | 主卡300、已选材料190、候选204；已选材料移出候选、单张撤回、分页与确认 |
| battle.aim | 拖拽、点击目标确认、取消回落、键盘当前栏1～9/Enter/Esc；贝塞尔箭头按Unity Y轴翻转 |
| battle.skill-view / battle-equipment | 原48px左侧技能与装备控件；真实技能费/次数/装备主动状态；7张原资源经 Res.BattleControl 获取 |
| battle.potion-use | 顶部道具组、说明和使用确认；需目标的道具再选敌方；命令仍走 UseItem |
| battle.turn-forecast / battle-hud-info | 直接读取新 Core Forecast；不在 UI 复制结算算法；只按 Phase=enemy 下沉手牌，Busy负责锁输入 |
| battle.piles.view | 首脑牌库、权威 ConsumedPile 消耗堆；保留本场UID进入只读纸卡浏览 |
| btSettings / settings-battle-restart | public static OpenBattleSettings 供共用顶栏调用；局部设置叠层含音量开关、震动、节奏、条件重开、日志、Surrender确认；右战术只留预估与结束回合 |
| battle.overlays / battle.discover-view | 首脑编组保留实际最少/最多数量；大卡网格；发现350ms输入门、选择与确认、固定动作栏 |

原始源SHA与Unity当前字节SHA统一见 `source-contract-check.json`。本片不以旧Unity通过报告背书。

## 检查与边界

- `python check_static.py`：原始模块指纹、几何常量、原画像参数、当前命令接线、手牌1～9组公式逐点与原JS函数对照。
- `check_syntax.ps1`：只加载既有Roslyn进行语法解析，不产生/运行程序集、不执行共享编译。
- `git diff --check -- Assets/Scripts/Sdt.UI/Screens/Battle`：定向空白检查。
- 2×设置已接当前飘字/受击/红闪/首脑登场呈现时长；Core敌方行动目前同步执行，无异步敌回合时间管线可缩短，不能据此宣称完整节奏与源一致。
- 本片未启动Unity、未访问前台、未取截图；动画、纸卡最终字体与重叠命中、所有子页原生滚动/焦点和同窗效果由主会新证据验收。
- 撤离继续使用既有 Surrender/烟雾Retract规则语义与2.6秒确认组件；本片没有修改它的规则实现。

已接主会新快照 `Phase/BattleToken/ConsumedPile/Forecast/Statless`；预测模型的源对照由主会继续执行，本片仅验证消费接口与呈现结构。属地已冻结，完成未提交，供主会统一编译与原生验收。

本片属地：`Assets/Scripts/Sdt.UI/Screens/Battle/`。新资源映射和公共顶栏由主会维护；本片未改 Core/Run/Boot/Res/Kit/CardFace，未提交。
