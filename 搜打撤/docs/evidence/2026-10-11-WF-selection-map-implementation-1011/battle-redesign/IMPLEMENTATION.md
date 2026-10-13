# 战斗实现迭代

状态：主场景/附加决策首版已实现；背景生成与战斗临时获得界面共享源码权限待协调；待老板统一审阅。

## 来源→问题→修改

来源B01/B02官方STS2战斗图+B03 1999 CBT实机图，以及root current-window/09-battle-winter.jpg。旧图上半大量天空，双方像贴在平景前；能量、技能和下方卡牌/右动作小而散，敌我虽有地面但背景不形成可交战空间。

第一版：battle-redesign新作用域，顶部回合/阶段工具，中段战场与原unit mounts，下操作台按能量125、职业技能165、可伸缩手牌、回合200设计px四区。保留原cardHTML/updateHand/UID/卡序/分页/目标/敌意图/所有handlers；技能标注实际费用，能量分“当前”与上限。熟练度占比降级、我方/敌意图装饰大标签移出主层，状态上下文可读。背景暂沿map已接M1样本，root协调新街巷战场，不改角色播放器/原稿/数值。

第二次源码对照：B01能量/手牌/结束分工、B03身份贴对象。检查后发现现首脑编组卡与牌堆是不可Tab的div/span，发现/支付候选同样；改为原生button，原data-act/UID/点击handler保持。首脑编组增加aria-pressed与真实选中态；牌堆仅实际可点击者用button，普通战只读语义保持。没有给普通战制造牌库操作。

## 附加界面

`showBattleDecision`只在battle.overlays.js做纯展示HTML装配：既有返回/确认/跳过动作块放固定footer，候选/说明在可滚区，头部显示真实回合与能量。没有新增动作或更改允许/强制条件。choosing、payment/consume/play handSelecting、discovering、首脑编组、牌库/消耗查看、战斗背包、战斗设置均已改用同壳；注能和道具待目标条在战场/下操作台间，取消/直打/发动沿原条件。候选卡面外不另加重复卡名。

原“消耗牌”查看文案声称战后还有整理背包，已按当前真实结算改为入口袋/消散说明，不改规则。主场景视图增量刷新与frames隐藏/恢复条件原样保留。

## 最低检查与缺口

四文件交互规则22项通过：battle-selection-flow-boundary、battle-hand-selection-rules、battle-discover-state、n1-infuse-uid-toggle。三个view JS ESLint通过，battle/rewards CSS PostCSS解析与目标diff检查通过。此证据不代表新版实页/审美通过，未进行自动全链循环/build/提交。

临时获得实际入口为ui/cinematics.js:showCardReward(#cardGet)，全屏光柱/卡面外重复名字/仅按原始传说字段判定；已报root精确共享范围申请，未经协调不直接编辑。battle.aim/anim/frames/core/effects均只读，未改数值、卡序、能量/技能/支付规则。

当前新背景/透明箱尚未生成接入，不宣称相关美术完成。每次下一调整应依据具体参考/画面/用户反馈；老板最新指令将最终当前窗口审阅留给老板，保持待审阅状态。
## 临时获得的限定样式接入

未等待共享源码改权而遗漏此界面：在已授权expedition-battle.css，只有body存在battle-redesign主场或battle-decision附加壳时，#cardGet改为右上290px宽对象回执。移走全屏光柱、卡面外重复lg-name与误导“任意处”提示，改视觉提示“点击收起”；160px原卡面、实际reason、既有点击关闭/自动收尾/队列均保留。卡面rv-prism有效身份给专属承托。非战斗#cardGet样式不变；该轮CSS解析通过。

ui/cinematics.js未写，原共享标题仍只按card.rarity判传说；已申请战斗上下文有效稀有度标签最小增量，未把这部分记完成。两轮目前都是参考/源码对照迭代，不冒充两轮真实实页验收；老板明确接管最终审阅。
## 真实绘画层桥接与附加界面二轮（继续实施中）

root明确批准只在battle.view自有域接far/mid/ground独立img，overlay直属foreground/z7真正位于unitFrames/z6上；只给规则UI开几何mask孔，不拿mask/CSS渐变当绘画层。三层同world与同一16:9缩放偏移，前景复制同一变换到overlay坐标。脚锚采用figure/img布局底代理，对齐绘画踏足带y.70–.78的中心.74；offset布局避免出场/受击位移把地板拖着移动。精确帧alpha脚点未暴露，保持已声明代理精度，不修改保护播放器。

world与foreground按battleToken、场次/模式/hidden、resize/HMR清理，观察figure加载变化；规则mask保护回合/控制/名牌/意图/卡面/目标轮廓，未改输入热区。重复同几何mask不重新赋SVG。四source URL目前为空，等待root未来科幻城市四件素材；被否定古城与winter-street-v2没有接入，不把桥接代码记成绘画分层已经完成。

附加界面二轮依据成熟对象式卡面/牌库结构：牌库与消耗牌由纯文字行改原卡面网格、数量单点；战斗背包分“使用道具/保护卡牌”两区，保原UID/act。发现文案查真实discover-flow后按play/playKeep/pouch/dup、剩余n、0费/估值护甲/费用衰减显示，来源卡按sourceCardId读名；不再把所有发现写成入手。必选/跳过、原抽取与结算规则未改。重复同场决策保滚动与焦点，不跨token继承。

cinematics获root精确handoff后，只showCardReward显示时计算data-combat/有效稀有度（含棱彩），战斗去外重复名字和简短回执；原队列/SFX/关闭与自动时长、非战斗内容保持。新增显示时上下文回归：战斗第一张后回地图，队列下一张恢复非战斗提示/名字。连原teardown共1文件5项通过；没有借此宣布美术通过。