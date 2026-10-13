# 战斗呈现与手牌交互

2026-10-13，Friday 子代理。当前已完成点击先放大、明确确认使用的交互实现和定向逻辑回归；当前窗口的最终视觉与真实输入复核由主代理继续。未提交。

## 已确认的问题与改动

1. 主代理 [04-battle-entry.jpg](04-battle-entry.jpg) 的 1280×720 自然遭遇：手牌顶 y=500，角色生命区域到 y=543.33，存在叠压；第一张初始攻击被裁切；顶部回合/操作字偏小。经真实参考板确认后，最终实现采用底边扇形手牌，卡面本体增至220逻辑像素宽，同栏9叠不变，移除横滚条；左右能量/结束回合独立，人物HUD留出卡框外扩安全区，保留现有城市战场。此前从左平排的中间方案已被该参考方案替代。**当前仍待主代理当前窗口实页核对，不等于整体美术验收通过。**
2. 选牌主提示原先把整段键盘说明塞入单行省略区域，且卡面另有重复标签。已改为短主提示，键盘说明保留在辅助标签；主提示支持换行。
3. 牌堆和战斗背包详情原先显示原始描述，后备能源会退回“消耗口袋”旧措辞。现在与手牌完整规则共用 `displayCardDescription`。
4. 老板明确要求“点击卡牌放大而不是打出”。新增 `battle.hand-inspector.js`，普通点击、指针轻点、数字键、Enter/空格、规则/注能入口均先打开对应完整大卡，不扣费、不选目标、不结算。详情内“使用这张牌”才进入既有玩法；即使只有一名敌人，也仍需下一步确认目标。无目标牌在明确使用后结算；注能材料显示“选作注能材料/取消这张材料”，查看不消耗。

直接拖动仍沿原释放目标规则。无足够能量或规则禁止使用的牌仍可查看，使用按钮给出具体原因并禁用。查看层挂在 overlay 的独立高层，战场临时 inert；Esc 只关详情，Tab 在详情按钮间循环，数字键/战斗快捷键不能穿透。关闭后恢复原手牌焦点；卡离手、场次切换、决策页切换、战场DOM移除或overlay隐藏时清理详情并还原 inert。旧确认按钮的重复点击不能重复出牌。

## 真实参考与适配边界

- 主参考：[Mega Crit 官方 StS 图库](https://www.megacrit.com/press-kits/slay-the-spire/)，具体 [ss8 实机图](https://www.megacrit.com/images/ss8.jpg)。主代理已在当前平台直接查看并传回观察：底边扇形手牌、左下能量、右下结束回合，聚焦卡升至中央约200×300像素，其他牌退后。详情大卡沿其可阅读比例适配，使用项目自己的原画与卡框。
- 子代理实际查看了本轮保留的 [官方战斗实机图2](reference-images/slay-the-spire-official-2.jpg)：大卡居中、底边手牌、两侧操作，背景局面仍可辨。最终详情层据此去掉重复的外部牌名/费用和两栏大面板，名称费用只在卡面；右侧完整规则按需展开，长规则自动展开；下方保留一个使用动作。
- 主代理后续在自然变化后的683×948当前窗口保存 [22首帧](22-battle-replica-first.jpg)与[23点击大卡](23-battle-large-card.jpg)，没有人为多尺寸测试。确认点击初始攻击只查看、能量仍2，角色/敌人HUD未叠压。短卡额外规则横板随后完全取消；仅超过70字的长规则保留旁列全文。
- 官方视频入口：[StS 发售预告](https://www.youtube.com/watch?v=9SZUtyYSOjQ)、[StS2 Gameplay Trailer](https://www.youtube.com/watch?v=ttVtllHkb4E)，链接由 [官方 StS2 press kit](https://www.megacrit.com/press-kits/slay-the-spire-2/) 核实；本子代理未逐帧观看。
- “单击查看、明确使用再选目标”是老板对代号柒的规则，不能宣称这是原作的同一输入方式。未用生成图冒充实机参考，未复制外部商业游戏资产。
- 本子代理尝试独立 IAB 参考页返回 `Browser is not available: iab`；主代理已有可用当前窗口负责游戏实页，本子任务未改用外部浏览器。

## 验证

- [最终详情与架构回归](battle-inspector-final-tests.json)：3 文件 44 项通过，其中详情 7 项涵盖单/多敌、无目标牌、重复确认、键盘/Esc/Tab/IME、真实模块指针轻点、缺能量、换场与隐藏清理；另两文件为 contracts/architecture-boundaries。
- [最终生命周期与注能链](battle-inspector-lifecycle-tests.json)：2文件11项通过，包含最终详情8项和既有注能3项；新增验证主卡与材料都先查看，明确选择后才调整注能材料，能量与手牌在确认发动前不变。加上战场DOM令牌检查后，旧舞台不能操作新场次。
- [旧面板回调防串页](battle-inspector-stale-tests.json)：最终详情8项通过。旧详情的关闭/确认回调只作用于自己的面板，不能关掉或操作后来打开的新详情。
- [启动链新版交互](battle-inspector-boot-tests.json)：2 项通过、16 项按定向筛选跳过。旧“点击即打出”两项已更新为新规则，并显式加载懒加载战斗模块。jsdom 的音频codec/Pixi无渲染器警告不作为音画验收。
- [邻近回归](battle-inspector-tests.json)：首次新测试导入路径错误导致该文件未收集，其余4文件17项通过；错误文件后单独修正并最终纳入上面的7项通过。不能将初次5文件报告宣称全过。
- [前一轮说明/目标提示](battle-presentation-tests.json)：5文件34项通过；后续受影响的详情入口另按上面新版交互重验。
- 修改的战斗 JS 与测试定向 ESLint、两份CSS的PostCSS解析、相关 tracked diff 空白检查通过。未做全量、build、外部CI、性能或音频听感结论。

最初只筛选旧 boot 两项时，测试依赖此前未执行的懒加载初始化，出现 `SDT.Battle` 未定义；该次 [battle-input-tests.json](battle-input-tests.json) 不算生产回归通过。后来按新合同修正初始化并重验，以上新版报告为准。

## 属地与未完成项

生产路径：`game/src/battle/view/{battle.aim.js,battle.view.js,battle.layers.js,battle.overlays.js,battle.hand-inspector.js}`；样式 `game/css/{expedition-battle.css,battle-hand-overhaul.css}`。测试 `tests/{battle-hand-inspector.test.js,expedition-battle-presentation.test.js,boot.test.js}`。未改公共 ui.js/overlay.js、台账、服务或存档路径。

战斗胜利奖励刷新丢失的P1已交回主代理：定位到 `game.bag.settle.js` 直接打开宝箱没有可持久化的 onCell 上下文；同时恢复普通宝箱回调会漏掉原战胜事务，不能仅补标志。此子任务只定位，未动该P1代码。

待主代理实页核验：大卡当前窗口尺寸/文字、真实单击与鼠标拖拽、真实键盘默认按钮激活、注能材料完整链、所有新战斗布局的统一观感。性能没有有效前后采样，不报告改善或无回退。

## 冷入场首帧修复

22首帧的外圈背景并非事件DOM残留：`expedition-battle.css` 原先为普通战斗直接写了 outskirts 兜底，而正式四层战场只有在图片解码后才显示。玩家序列帧又会先隐藏静态立绘，再等待Pixi/角色帧装载，两条异步链造成旧背景与空单位先出现。

已新增 `battle.presentation-ready.js`：新场次同步挂中性接敌层，战场inert；等正式场景解码、当前人物/手牌图片解码、角色帧首画面实际提交后才揭示。没有最小等待时间；已就绪资源在Promise完成后直接揭示。8秒仅作超时上限，失败或超时时仍明确显示状态，玩家可继续等待或选择“以简化画面继续”；选择简化时取消帧/场景旧加载接管并给出简化标记，缺失立绘有文字占位。

场景、就绪门、图片解码和角色帧各自校验拥有者。换场/关层后旧回调不能揭示下一场；同一角色DOM的重复render复用pending attach，避免新render不断取消首次装载；首帧Promise结束前显式提交一次Pixi渲染。没有修改公共overlay接口、入场预告时长或玩法状态。

- [就绪门与帧生命周期](battle-ready-final-tests.json)：2文件33项通过。
- [最终就绪门与契约](battle-ready-contract-tests.json)：3文件46项通过（就绪9项+架构/契约37项），包含缓存无固定等待、全部资源完成才揭示、失败/超时明确选择、关闭/换战清理、旧图片源解码不能标记新图就绪。
- [初轮关联回归](battle-ready-tests.json)：4文件通过，帧生命周期9项失败。其测试桩和断言仍固定旧常无语neutral/frame-001帧名及旧时长，与当前已交付f000等帧表冲突；已改为读取真实frame-catalog的idle名称和时长后，通过上面的33项。未改角色帧表或素材。
- HP、规则拒绝、点击大卡和boot等jsdom输入测试明确隔离资源加载门；资源就绪由专门受控Promise和图片load/decode测试验证。实际网络/首帧表现须由主代理在内置浏览器补验，不能由这些桩推断。

追加路径为 `battle.presentation-ready.js`、`battle.frames.js`、`tests/battle-entry-readiness.test.js`、`tests/battle-frames-lifecycle.test.js`，并在既有HP/规则拒绝/boot/详情测试隔离资源门。相关ESLint、CSS解析和diff检查通过。当前等待主代理对冷入场的新实页复核。

## Sol 接手后的战斗结构返工（待当前窗口视觉验收）

老板否决前一轮战斗美术；上文扇形方案与23大卡截图仅是旧阶段证据，不代表本轮通过。Sol 接手后实际查看两张 StS2 官方完整实机图：`reference-images/sts2-current-1.png`、`sts2-current-2.png`，来源、字节数、SHA256 与不入 git 约定见 [完整参考记录](reference-images/sts2-full-sources.json)。参考图可见上沿费用/名称、低弧底边手牌、角落操作和完整人物/生命区。

本轮只在战斗缩略卡加入上沿身份区，名称、即时费用和叠数限定在本叠可见宽度；保持原画与卡框，完整大卡仍用本作原排版。九叠以内降为最多2度、10像素低弧，手牌操作带由350降到270逻辑高，底部卡面允许延伸至屏外。详情大卡由330增至420逻辑宽；短规则不增加重复规则面板，长规则继续按需展开。右下常驻结束回合和背包，撤离/设置收进选项。点击、数字键、Enter先看卡、明确使用后再选目标、直接拖拽、Esc/Tab隔离，以及冷入场ready门均沿用。

旧代理新增的 `battle.victory.js` 已接入：保留当前战场，只做380ms短胜利反馈，然后原结算续流直接开领奖；减少动效或无动画接口时即时继续。关闭/换场立即取消旧反馈，新增令牌守卫避免旧动画清理后解除新场次的inert。`game.bag.settle.js` 的变动仍仅限纯胜利展示端口；奖励持久上下文、afterRewards和存档事务保持本轮接手现场。

- [Sol 定向回归](battle-sol-final-tests.json)：8文件89项通过，包含手牌详情8项、就绪9项、角色帧25项、胜利反馈4项以及原结算刷新恢复/失败重试。新反馈测试验证同场Promise去重、保留舞台、关闭取消、换拥有者不解除新门、减少动效即时继续。
- 首次沙箱运行在Vitest依赖realpath处EPERM，未收集任何测试；获批运行后首轮81/86通过，5项因仍模拟旧独立胜利过场而失败。只将测试桩接到presentVictory，并保持原奖励幂等断言后通过上述89项；不能把失败轮算通过。
- 改动JS/测试定向ESLint、两份CSS PostCSS解析及tracked diff空白检查通过。未运行build、服务或浏览器。

当前窗口的九叠名称可读性、大卡比例、人物/意图/生命区和选项操作，由主代理内置浏览器实际复核后才能判断本轮美术是否完成。
- [新增模块契约](battle-sol-contract-tests.json)：contracts/architecture-boundaries 2文件37项通过。
