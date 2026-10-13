# 继续整条远征界面与美术：有效上下文交接

2026-10-11，旧聊天 `01a12a56-fff8-7393-a312-6f8f01036d55`，标题“评估选人到地图节点体验”。老板因上下文过长要求新对话承接全部有效上下文。**继续做，不重新立项、不从头盘点、不因一张图通过而停下。** 本文件是旧根会话整理的任务交接，不是整个改造完成声明。

项目 `D:\素材\代号柒`；仅开发子目录 `搜打撤` Vite。Git HEAD交接时为 `cdd5c1a83695ec901225c7c76eebcd56e63d3ecf`。未提交、未推送、未build。所有既有其他会话改动保留。

## 1. 老板的目标与持续授权

最初要求实际体验从选人、整备、入城到地图/节点，对比优秀二游的美术、展示、UI、动效、逻辑。随后要求先查实际素材、网上学习资料和标准，建立增加/删除/合并框架，再反复细化，**不能凭感觉直接列方案或生图**。

老板明确要求交给GPT-6.1-sol子代理，并要求多开几个。旧根用了三个6.1-sol：人物/入城/事件、地图/背包/宝箱美术、商店/奖励/战斗实现。新对话应重新派三位6.1-sol（旧子代理属于旧树，已经要求冻结），分属地继续；主代理负责协调、资料与画面比较、剩余素材、整套交付。

老板逐项扩展要求，以下都仍有效：

1. 人物/整备：清楚人物玩法与真实携带；卡面自带名字，不要卡面外再重复名字。明显重复设计和文字可删除/合并。
2. 地图与底部导航整体重做，参考明日方舟**最新肉鸽IS7**及其他二游美术；机制绝不改（本项目2D邻接、迷雾、回溯、四层，不能变成方舟单向DAG）。
3. 商店UI/背景参考方舟肉鸽重做，可以重新生成美术。左商人、右商品是已看真实参考结构；本项目九货位5/4、收购服务是适配，不移植投资/打劫机制。
4. 入城奖励必须大整页，参考杀戮尖塔2开局，可复用事件代码；不能小条弹窗草草揭晓。
5. 事件主要信息与留白整体重做，参考方舟肉鸽/尖塔事件。
6. 继续对局接回项目现有统一city-cut过场。
7. 战斗主界面完全重做，含新背景、能量、技能、下方手牌；参考多种成熟方案。战斗触发的支付/消耗/发现/注能/抉择/目标、编组/牌库/墓地/战斗背包/设置/临时获得等额外界面不能漏掉。
8. 背包整体重做，含随身、安全格、消耗口袋，参考类似二游。
9. 奖励界面整体重做：高等级卡获得满足感不足；去掉无关顶部横图、大量无用设计/文字；透明宝箱重出。
10. 宝箱必须多帧，包含真正的打开过程动画；先把箱体画好看、符合卡面画风，再做一致帧，不是静图晃动。老板要求**NAI+内置生图组合，提示词直接参考其他游戏真实宝箱**。
11. 每界面按优秀案例/美术原则多轮比较修改，测试通过不等于美术通过。老板说“不要着急统一反复验收，现在只管调研和反复去做，最后我来过目统一验收”。必要定向检查与设计用实页截图仍做，避免每轮全链测试或机械跑次数。

## 2. 最新美术约束（最高优先级）

- 老板明确：“**我们项目的画风基本在卡面图里**”。实际 `game/assets/cards` 是物件/环境画法基准，不能拿Wu一张人物模板包办全部。
- 世界是**未来科幻城市**，不至于霓虹赛博朋克，但肯定不能古城石柱/城堡/旗帜/古木门/中世纪金锁箱。科技感通过现代合成材料、模块化建筑/自动设施/立体交通体现，不靠霓虹满屏。
- 老板最新：“**要考虑天气，现在是冬天**”。场景是冬季未来城市：冷天光、远部/屋顶/街缘积雪、稀疏枯枝；主踏足地面清楚。宝箱作为独立透明道具不因此强制满身雪；已批准室内商店图保持，不反复重绘。
- 画法提炼：大主形/主色、有限大明暗面、方向明确的宽不透明笔触、完整轮廓与选择性细化。不要均匀灰色小三角/低多边形模型、密木纹砖纹、PBR高光或整图柔光。
- 当前权威来源 `docs/production/art/ART-DIRECTION-BRIEF.md` 已加卡面/未来城市最新条款（冬季补充还需新会话同步）。认可人物身份/原画与白塔坐姿保持，不为天气或新场景擅改人设。

## 3. 唯一明确批准且冻结的本轮新图

老板对最后商店校准图说：“现在这个可以了吧，不用改”。只冻结这张图，不代表整个任务完成；旧根误停后被老板批评，已经明确继续其余部分。

- 批准原PNG：本目录 `art-calibration/shop/source/shop-card-style-approved.png`。
- 原SHA256：`6fc83d105774afbc0a0d688338a505d9c7dba0757f3c015b0ebb670eed3fc649`。
- 无损运行WebP：`game/assets/scenes/shop/shop-cardstyle-approved-1011.webp`，1659×948，1181460B，SHA `d150710921cd395438f44d98798312e71c9e10f15df887d528909c83e4f335d2`。
- PNG→WebP回解码像素相同，无resize/crop/repaint。超过1MB的WebP已被同目录`.gitignore`精确忽略，按项目规则仅本地保留+SHA/获取方式；别为了压缩又重绘批准图。
- `expedition-shop.css`两处URL已换此图，主商店70%全屏黑罩已移，局部商品/服务/页头承托文字。旧winter-caravan不再引用。
- `art-calibration/shop/{APPROVED,runtime-receipt,nai-request,builtin-request,builtin-layout-request}.json`及ART-GEN保存来源/词/过程。原图是NAI一张→内置卡面画法修正→柜台宽度位置修正。

## 4. 已否定素材，严禁因“文件存在”直接采用

- 最早雪箱整套：强绑雪、蓝色角色特征，画风不符。
- 赭红木箱家族：老板说依然难看；`chest-small-cardstyle-1011-v1.webp`等不是批准图。
- 青黑拱盖箱组合：NAI+STS2+卡面仍被说丑/不符；`art-calibration/chest`只历史候选。
- 古城战斗图：石柱、旗帜、穹顶，违背未来城市。旧根 `exec-d408...`已标废弃，不能接。
- `winter-street-1011-v2.webp`单張冬街图被否定，不能拿壁纸冒充后景/地板/前景。
- 商店winter-caravan与入城winter-arrival/threshold-cardstyle候选未获认可，入城还因题材更新需现代冬季版。

所有旧文件保留，**不要删除**。批准的是商店原图，其他“候选/根曾判断方向可继续/源码检查通过”均不是老板美术验收。

## 5. 当前源码已实现（仍要真实画面迭代）

本批 `WF-selection-map-implementation-1011`，任务元数据stage仍doing。`REBUILD-SCOPE.md`为范围索引，但早期状态有滞后，以本交接及各线最新报告/实时源为准。

### 人物/整备/入城/事件（原roster）

`run/game.run.altar.js`、`hub/game.hub.depart.js`、`departure.view-updates.js`、新`departure.summary.js`、`base-camp-rework.css`（真实加载！）/`departure-cover.css`。

已有人物定位/机制/代表卡查看、成长折叠、五头像、快速切换保外壳；删旧重复机制简介与卡外名字。整备从实际starterSha/pet/stash/stackCap显示已知数量/容量，最多两张不同职业牌入城后真实揭晓，首次损耗说明前置。真实卡、扣仓、保存/失败/取消/idempotence保持。

入城已改整页、实际卡详情与唯一继续；新`ui/node-scene-view.js`、`css/entry-events.css`复用纯展示壳。`game.run.scenes.js`只事件/nodeShell与entry分支；事件叙事/选项分区、长文独立滚动、真实已禁用标识，不能从文案猜币数/概率。

`ui/game.menu.js`继续档位hasSavedRun分支只补`presentation:'city-cut'`一行，其他110行旧完成diff保护；已有统一city-cut保留。`ui/expedition-feedback.js`仅火堆条，entry小条已去。火堆实际回复/复原、满血0与重入不重复。

### 地图/导航/背包（原map）

`renderer.js`只drawIcons/drawNodeLabels/drawLinks/drawCurrentNodeFrame视觉；`expedition.view.js`只展示/缓存/临时DOM，不改四层目标与邻接业务。未来允许替换背景须再定位实际引用、协调范围，不能改geo/迷雾/生成。

已按IS7中央地图、右节点/相邻决策、116设计px薄工具条重构；节点圆形承托/类型剪影/状态、细连线/深名牌、薄层进度，隐藏底栏devPanel与重复miniMap但标题开发工具可达。临时DOM不入game/save。`hud.js`和`game.boot.js`日志默认折叠且尊重显式0/1，clearLog不覆写偏好。

`hub/game.bag.js`仅showBackpack展示+`expedition-inventory.css`：随身/安全/消耗按用途，容量就近，各网格滚动、固定返回、删重复标签。data-act/data-stack/data-safe/UID/拖拽/使用/容量规则保留。

### 商店/奖励/战斗（原node）

`run/game.run.shop.js`、`chests.js`、`hub/game.bag.settle.js`只WeakMap实际CardOutcome采样展示；shop/rewards/battle CSS；battle.view/overlays/piles.view展示；cinematics只战斗回执。

商店卡面查看与独立购买、持有/价格/差币、服务区、固定离开/反馈、局部重绘焦点；随机/货位/容量/收购业务保持。

奖励去顶部车队横图、重复箱图/编号口号；金币/容量、卡面、真实损耗按需展开、固定收取；Cards.rarityOf含棱彩分层与短揭晓。逐张收取不整层重播、保滚动/焦点。

战斗主/附加壳已重排能量/技能费用/手牌/结束；发现按真实act(play/playKeep/pouch/dup)/n/modifier解释，编组/牌库/消耗完整卡面网格，战斗背包使用/保护分工。UI入口均要继续样板，不只测试。

`ui/cinematics.js`渲染时算data-combat与有效稀有度；战斗临时获得为右上局部回执，去外重复名字；原队列/SFX/时长/非战斗保持，下一张跨地图reset。

## 6. 两个关键空接口：不算素材已接入

1. `battle.view.js`的BATTLE_SCENERY far/mid/ground/foreground URLs**目前为空**，有桥接但仍fallback旧冬景。前三是真img同world；foreground为overlay直属img/z7，确实盖过`#unitFrames/z6`；同token/resize/hidden/mode/HMR清理，UI矩形几何mask只保护规则，不冒充场景画法。四图decode齐才切，最后decode PromiseAll守卫尚未完整复看。
2. 五CHEST_FRAME_SETS目前全空，支持configureFrameArt(kind,{frames,fps})。原780ms/turbo搜索后开帧，最终才实际卡；click skip/reduced跳结果，next/suspend/跨mode/HMR取消，ctx.revealed+timer保证唯一次。权重/抽取/授予/容量/coins handlers不变。

## 7. 四景层资产已保存，需冬季修正、还没运行

`handoff-art/source/`原图及`assets.json`/`prompts.json`是旧根刚生成的共同1672×941候选，已复制进项目避免只留Codex缓存：

- future-stage-composite.png：未来城市平台整体构图。
- future-far.png：不透明城市远景/高架交通，当前晴蓝云天。
- future-mid.png：透明现代支撑/后缘/少量绿植。
- future-ground.png：透明横向地板/前沿，踏足带约y0.70–0.78。
- future-foreground.png：透明下角服务罩/低近物，中央透明。
- rejected-ancient-stage.png：仅错误对照，不能用。

前五形成专业景层分工、共同canvas与几何位置，**冬季还没做**：far改冷灰冬天光/远屋顶少雪，mid绿植改枯枝/边缘雪，ground保持清扫清楚主踏足带，foreground顶部边缘少量雪。不要退回古城、堆全屏雪/霓虹，也不能把同一壁纸复制四份叫分层。

新图目前没WebP runtime，也没有给node填URL。需先看原图/卡面/专业例，再做具体天气修正和真实叠层。透明图alpha边可能有细色边，按真实合成看，不以alpha0–255自动判完美。

场景结构参考实际HoYoLAB2023玩家空间站摄影（只取现代合成构件，不搬太空站主题/人物/UI）：`art-research-reset/future-city/hsr-station-amelia-{01,02}.webp`、sources.json，帖子https://www.hoyolab.com/article/23382676。旧Prima图请求被Cloudflare挡，没取得不能当已看参考。

## 8. 宝箱最新主样与动画连续性缺口

`art-calibration/modern-chest/`为目前最新白橙现代补给匣：NAI文本按真实方舟白橙箱结构→内置同时看NAI目标/真实箱/实际珍珠盒与锦囊画法。不是已批准。

`source/modern-supply-frame-00..04.png`全部1254² RGBA、真透明：闭合→解锁→约12°→约45°→全开。原图/词/SHA在frames-receipt.json、frame-prompts.json、README。

已发现03/04后铰链明显下漂：局部RGB匹配约60–92源px（240–360设计宽时约11.5–26.4设计px），方法非刚体追踪。01基本0、02±4；前护角/底线较稳定。一轮同Prompt定向修图未解决，**不能叫连续帧合格，更不能先接再藏缺陷**。

下一步先实际并排/小尺寸播放，决定是否用独立箱身与箱盖透明绘画资产+固定铰链几何播放，避免每帧另造身份和无上限重生。node已具帧接口，rig方案尚未开始，若改变仅展示，不改奖励。主箱好看且动画稳定后再扩medium/large/class/boss，不能只染色或省略其开盖。

## 9. NAI/内置工具与安全输入

已有`tools/nai_gen.py`、`nai_style.py`1.3、`nai_guard.py`；Python/Pillow/curl已可用，不安装或改config。NAI默认4.5full、28steps、scale6.5、k_euler_ancestral/karras；1344×768/832×1216在客户端小图阈值内，但不把本地阈值当远端计费保证。V5需显式传，未经要求不改默认。

NAI只收prompt/UC/char_prompt，**没有图片reference形参**。既有脚本记SHA不是图片送入；图像参照实际在内置imagegen阶段输入。多个请求已HTTP200，所以本地链路可用，不能继续沿旧“远端未验证”当当前阻塞。

凭据默认由客户端读仓库根`D:\素材\代号柒\.tmp\nai\token.txt`或NAI_TOKEN；不要读/输出/写进交接其值。守卫45秒跨进程节流、429冷却、大图配额、403立即停规则保留。先通过build_asset_prompt/build_uc写实际案例结构，不散拼模板。内置图编辑要先看本地目标、标每图role，实际卡图只画法不复制人物/物件身份。

## 10. 当前窗口与服务现场

只用Codex当前平台IAB、当前实际窗口；不得换外部Edge/CDP/headless、多尺寸需要老板明确要求。窗口自然变过1280×720/1523×956，未设viewport；单张尺寸以截图/DOM元数据为准。

最新根截图 `current-window/21-battle-ui-before-layers.jpg`（开发者真输入，不写档）自然1280×720，**战斗UI有明显设计问题**：手牌堆到左下、技能压卡、结束回合横铺，未体现意图中的三组操作台；需要排查实际后置CSS/作用域与当前DOM，不再只修改未加载样式。背景是旧fallback，不是四新图。

最新只读矩形：stage1280×720；topbar0–40；arena top40/bottom556.54、高516.54；hud top556.54/高163.46；玩家figure底500.81、敌figure底512.81；unitFrames overlay直属z6。真实脚线是imgBottom+帧alpha锚，非unit bottom24；目前桥接用figure/img底代理+宽踏足带，不能声称精确改过播放器。

主线5200/PID21616归他人/共享，保留。旧根自建隔离副本`.tmp/selection-map-observe-1011`，Vite5337最终PID29048/exec52204已在交接前确认身份停止，端口表只剩5200；新会话可用自己的53xx严格端口/记录重新启动，不继承旧PTY。副本是纯src/css/data/assets快照，watch忽略避免主线HMR杀会话；**副本落后最新源/新素材，先精确同步，不能在副本开发当主线成果**。配置用独立vite.config.mjs，不跑build。

旧四层登记5359/PID18660属于旧会话，原根没清理；最新监听没见5359，不能据此擅杀历史PID或销他人账。

真实存档边界：5200的localhost档位04是旧体验第二层，别覆写；127.0.0.1:5337旧有01/02对局、03基地未覆盖，旧根从空04/05建测试，04仅基地不出征、05自然实走到第一层商店购买并保存（3币/32HP，可能正在门旁），别自动重开。不同origin存储不同，先读UI。

## 11. 验证与已知不足，不伪装成整套通过

早期12文件119项仅旧骨架集成基线。各线后来有直接定向：node最新收取/容量两文件19，之前三文件24；cinematics/teardown5；战斗四规则22；roster7文件70及后续helper12；map导航/log54/背包53。原boot整文件有照相馆3项失败（非本域），没顺手修。这些都是行为/语法证据，不是视觉通过。

旧实页18张体验和首骨架21张截图只是参考/旧版本。没有完整新图/全部附加界面实际审阅，没有天气最终图、箱连续动画合格包、最终首脑/终层/长文/容量满覆盖。老板要多轮设计后自己统一验收，勿机械重复全链测试、勿因为表格有三轮源码就称美术完成。

## 12. 保护属地、当前其他活跃会话

读取根AGENTS与项目docs规则，日常跨域`npm run handoff`定向核对。已知其他未提交全部保护，禁止git clean/checkout回滚、删除/提交/推送/发布。原根未安装依赖、未改全局config。

旧four-layer expedition.view用户明确允许保留原改动接手，先F07方向/cache后只展示扩展；旧四层target业务保持。旧`game.menu.js`110行基地/设置完成diff、`base-camp-rework.css`基地既有内容、scenes统一过场、动作播放器frame/catalog/lifecycle均保护，不能整文件覆盖。

截至交接`list_threads`另外两聊天活跃：**“调整游戏缩放比例适配”**（01a12b47-077d-7922-8849-d2319b758975）、**“基地 UI 按绝区零样板继续细化”**（01a12b26-919c-7300-aa9b-e2a97244fb78）。与global缩放/基地CSS可能交界，接手先handoff+具体diff；不要擅改1920×1080统一等比约定或竖屏。旧根没有授权向这些其他聊天发消息，不能因交接包提了它们就自动消息别人。

工程还有ZCode招式/数值改版、三人动作接线等原登记；战斗核心/effects/cards规则、frames/catalog/lifecycle和原画不是本批属地。cinematics已定向核无精确占用，只有showCardReward展示获许可。

## 13. 从哪些文件继续，避免重读整个聊天

优先读本文件、`task.json`、`HANDOFF-STATE.json`（交接冻结清单）和各域实施记录；研究已够用，缺口才查原资料。文件>300行先rg后读相关片段。

- 原审查：`../2026-10-11-selection-map-experience/README.md`，18张JPEG/浏览器provenance。
- 原框架：`../2026-10-11-selection-map-plan/{MODIFICATION-PLAN,REFERENCES,DISPATCH}.md`；R01/02星铁、R05/09/10/11R99、R07/08方舟实际图；设计师未采用稿R03/04只材质层次，R06宣传图排除。
- 新研究：`art-research-reset/{README,CHESTS,BATTLE-LAYERS,SHOP-ENTRY,INTEGRATION-CONSTRAINTS}.md`；实际STS2官方、背景作者原图/访谈、DD/Hades、项目卡面已看，不用再“学习”空转。
- 各线：`roster-departure/README.md`、`NODES-RESULTS.md`、`map-battle-art/README.md`；`map-redesign`、`bag-redesign`、`shop-redesign`、`entry-events`、`reward-redesign`、`battle-redesign`各PLAN/REFERENCES/IMPLEMENTATION。
- 批准shop、最新entry/chest见`art-calibration`；旧被否定group见`generated-art/assets.json`与各receipt。
- 主流程登记`docs/PARALLEL-REGISTRY.md`自有WF行；当前元数据doing，**目标没完成，不标complete**。

建议新对话第一动作：核冻结清单/作用域后派三6.1-sol，让图像/源码/当前窗口比较并行；先解决实际battle操作台CSS与冬季四层接入、现代箱好看+开盖一致、未来冬季整页entry/events，map/nav/bag再拿真实新屏对照IS7/二游细化。商店图不再改，只迭代其商品/服务/按钮叠层。一直推进到整套可供老板统一过目；有批准单图只冻结那张，不再次停下。

三个旧子代理已逐项确认无在飞工具、无其创建的服务，并保持idle。roster确认现代冬季入城新稿尚未开始；map确认箱身/箱盖拆分方案未开始，最新地图/背包布局仍缺实际新屏比较；node确认四景层URL、五箱帧组仍空。

旧会话曾向已完成idle的代理只用send_message布置续做，该调用不会触发新轮，是一项调度失误。新对话派新代理使用spawn_agent；对已idle代理续做用followup_task，不能把send_message成功当成开始制作。旧代理不能由新树继承，不再等待它们继续。
