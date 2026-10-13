# 战场与宝箱接线约束

2026-10-11。状态：仅研究当前源码/旧素材/已核实画风，未修改游戏源码、未接新图、未新跑游戏/构建/测试。老板否定的雪箱与winter-street-1011-v2保持未接入。cinematics仍只读。

**当前战场只有一张底图与遮罩，没有独立绘制的后景、地板、前景。** 序列动作层还在overlay直属的独立Pixi画布，因此“加三个类名/三层CSS渐变”不能完成场景分层或前景遮挡。下述接线方案是供研究代理/根收拢的约束，不是已实施状态。

## 一、实际战场树与更新边界

当前battle.view.js:375–424生成 `.battle-stage.sts.battle-redesign`，顺序为shade、可选道具、topbar、arena、注能/道具目标条、hud。arena内保留caption与self/allies/foes三个unit mount。battle.layers.js:427以后按battleToken维护差分单位；self占位被真正selfUnit替换，不能因找不到旧占位就重建单位。

`showBattleStage`（battle.view.js:143）同场/同token复用根舞台，模板签名相同直接跳过；只同步顶部/上下文/能量/技能/战术槽。assetKey或boss字段改变才整层重建。新增静态景层应在首建随场次产生，不能让一次出牌触发景层/动作层重挂。跨场/区域换景须进入明确的模板与来源关系。

地图renderer不是战场底图绘制器：game.boot.js:469用UI._hasBattleStage判断battleBehind，主循环这时抑制背景Canvas活跃绘制；renderer.js:552的draw仍服务地图backdrop/路线。独立战场景层应接在battle DOM/Pixi所属场次，不能把地图renderer渐变写成战场地板接线。

## 二、后景/地板/前景的真实素材接口

| 层 | 当前实现 | 独立绘制素材接线约束（未实施） |
|---|---|---|
| 后景 | 整个stage CSS background。普通战由expedition-battle.css前段指向winter-expedition/outskirts.webp；battleAssetKey普通为battle-normal，首脑按general/orc/element取键。 | 独立后景位图：建筑/远山/天际，不画角色/脚下接触阴影/界面字。可作为arena后景DOM image或单独stage层，但先锁绘制坐标与裁切法。单张新壁纸并不等于多景层。 |
| 地板 | 目前底图地面加CSS阴影/伪元素，未有独立地板位图。 | 与后景同透视/光向、地平线一致的独立地板位图；角色站立区必须是实际绘画的可承重平面。需留独立alpha或严格对齐的叠放边界，不能用CSS线性/径向渐变冒充地面绘制。 |
| 前景 | 当前无独立前景位图；stage ::after是首脑色调/特效蒙层。 | 独立透明前景位图，按实际遮挡目标放到动作层之前/之后。只有低矮前景可遮脚，主角脸/武器、敌意图/血条与点击热区不能被图堵住。pointer-events:none。若前景必须遮Pixi玩家，需处理overlay级同坐标/同场次层，不能只在arena内部加一个高z-index类。 |

CSS陷阱：expedition-battle.css的 `stage > *:not(shade):not(ambient)` 把普通直属子节点设为position:relative/z1。新增景层若挂stage直属且没有明确例外，会被该旧规则改掉定位。它们若在arena内部，arena自身还参与stage/overlay层叠；不能只比较数字z-index就断言能盖过overlay直属Pixi层。

stage使用isolation:isolate；既有CSS shade、boss ::after是纯色调/反馈层，应与绘画层分工。新素材接线需明确删减哪张旧全景引用和哪层遮罩，而不是叠着所有旧底图、黑网格、色调层继续加素材。

## 三、动作层、脚线与遮挡

battle.frames.js:158–181创建overlay直属 `#unitFrames`，透明Pixi canvas铺满overlay，pointer-events:none、z-index:6，sprite anchor=(0.5,1)。其注释约定盖过单位区2与普通手牌，低于hover牌9+、aimArrow60、伤害闪70、飘字80。具体层叠仍受祖先stacking context影响；本轮未实页取最终合成顺序，不把源码数字当实页通过。

frames layout:298–318通过UiScale rect取当前 `.sts-figure`，以静态立绘占比/帧alpha包围盒计算角色显示高；imgBottom、centerX来自真实figure矩形，fixedFrameRole会按帧box.y1修脚锚。无/常无欲/三角色帧目录有各自画布，不允许为了新地板改帧画布/裁脚/武器安全区。白塔坐姿原姿态保留。

关键区别：`unit bottom`不是脚线。page-battle-ui.css:42–45把单位/敌人组/随从组bottom设24px!important；figure下方还有名牌/生命/装备等。地板实际接触线应对齐figure/imgBottom与帧alpha底，而不是把全场按固定“全屏70%”作脚线。注能上下文变高、手牌操作台变化会改变arena可用高度，后景/地板共享的裁切与地平线必须能解释这个变化。

当前横向约束：我方left约4–7%、width190–320；敌组left后置规则44%、right4%，普通敌宽124–176，首脑自身宽190–290；随从组从16–30%附近展开。多人/随从/大首脑需要的安全区不同。参考STS2多人图只支持共地面关系，不授权本项目组队规则改变。

附加overlay（编组/牌库/消耗/背包/抉择/支付/发现）沿现生命周期隐藏frames；重回战斗恢复原挂载。前景若接overlay直属，也必须只随当前battleToken出现/退出，不残留到这些决策界面/地图。

## 四、五类宝箱实际展示条件

chests.js:23–31的CHEST_ART对应small/medium/large/boss；isClass优先用class图（覆盖kind）。next()在搜索前rollContents，idx递增；renderSearch只显示来源/箱图，尚不公开真实稀有度。搜索按钮原data-act=chestReveal，780ms经turboMs缩放自动揭晓，也可点击立即揭晓；代次守卫防旧箱/收尾后的过期回调继续弹回。只读发现：同一箱点击立即揭晓的回调没有推进searchSeq，也没有取消自动timer；因此仅揭晓但尚未收取/离开时，原自动timer仍可能再次render并排揭晓音效。这是本轮源码推断，未新跑实页确认；本轮不修源码，后续演出方案需处理同箱唯一揭晓而不改奖励结算。

**当前揭晓页不再展示箱图。** 本轮之前已授权的奖励重做移除了车队横图与`.chest-reveal`重复箱图，卡牌/真实金币/容量成为主对象；因此新五箱接入只影响搜索阶段，不能把旧`.chest-reveal` 170–230px规则写成当前实际展示。箱图不会在逐张收取时重放。

| 旧实际路径（game/assets/scenes/） | 原图像素 | 模式/alpha | 搜索显示 |
|---|---:|---|---|
| scene-chest-small-anime-v1.webp | 1066×630 | RGBA、alpha0–255 | 与其他箱同CSS尺寸 |
| scene-chest-medium-anime-v1.webp | 1076×683 | 同左 | 与其他箱同CSS尺寸 |
| scene-chest-large-anime-v1.webp | 1120×693 | 同左 | 与其他箱同CSS尺寸 |
| scene-chest-boss-anime-v1.webp | 1083×678 | 同左 | boss key，仍同CSS尺寸 |
| scene-chest-class-anime-v1.webp | 1006×544 | 同左 | isClass优先，不依赖实际掉落稀有度 |

以上只读Pillow原图元数据。旧alpha非零包围盒均距原图边约8px，未达到前轮建议的12%内缩；拥有alpha不等于对象边缘已干净。已view_image实际看旧小/大箱：含一整块石台/地面、细光线、大片纹理，大箱有伪字。下一次设计需先解释箱体大形/材质/开合方向，透明cutout不带实景地板，否则重复绘画地板和界面影子混成一件对象。

搜索CSS真源scenes.css:328：width=clamp(240px,32vw,360px)，height:auto；设计参考1920视宽时宽360，当前1523视宽同样达到上限360，但项目整体zoom会继续缩放最终屏幕量。五类高度因原图比例不同，大约183–229设计px；这不是本轮实页测量。新图若强行换成16:9大片，会缩小箱体有效高度；应先定主体占画布比例与透明余边，再给像素规格。

搜索图CSS是1.5s循环轻摇（最高约±1.8°、上移3px），实际搜索780ms通常只播放前半且turbo会缩短搜索时间；hover不应提前揭示等级。系统/本地减少动态需复用现机制。CSS drop-shadow为显示辅助，不写进位图光柱/黑底；原asset alpha全透明背景要求继续，但没有预定“雪箱越厚越好”。

揭晓卡用真实Cards.rarityOf分层（含hero棱彩），普通220ms、史诗360ms、传说480ms、棱彩560ms是现样板试验值，不是外部作品时序。稀有度/概率、卡量、三选一/全收、容量和金币结算都与箱子形状无关；画得高档不能提前承诺高档掉落。

## 五、画风与实际对象设计核对

老板最新明确“项目的画风基本在卡面图里”：新箱与战场绘画以实际现行卡面画法为主要基准。外部案例只学习箱体造型、专业景层、构图和展示；不调用Wu人物模板替代物件/场景风格，也不拿写实雪景当整体风格。已重新核对ART-DIRECTION-BRIEF与VISUAL-BIBLE：M1作为已认可氛围，不能压过最新卡面画风指示；无现选人立绘、白塔坐姿和其他角色身份保留只约束这些人物，并不把人物模板套到所有素材。

已实际看本项目 `cards/expedition-starters/basic-attack.webp` 与 `cards/martial-cc-chase-slash.webp`：前者由两把完整交叉刀的大形、冷灰块面和中心短亮点建立动作；后者由明确方向的几道宽斩面、分层冷灰地面/树线建立作用，不靠碎饰铺满。它们可支持大形/光色/笔触语言，不能作为立体宝箱锁扣/透视或专业战场分层的充分结构参考。

本轮已有B01/B02 STS2官方战斗与B03 1999实机支持敌我共地面/操作层分工，已看原图；它们不提供本项目冬境具体地板/前景分件。专业场景与箱体具体设计须等根的两研究代理实际作品/分层证据收拢，再确定绘画样板；被否定的雪箱与winter-street-1011-v2不作为现采用基准。

## 六、待根定稿的最小接口清单

1. 后景/地板/前景应是独立素材文件，定义同一透视/绘画坐标与透明重叠边界；先给真实参考和分件图，后决定布局锚点，不把CSS类名算作成品。
2. 明确前景是否真的遮挡Pixi玩家。若是，需overlay级同battleToken资源层及UI/箭头/飘字之下的明确层叠，不擅改在途frames/生命周期。
3. 普通战与三首脑场景主题/景层是否各自绘制、还是共享地板家族；不能从一个普通战平景样本推定三首脑都成立。
4. 五箱是否同套物件语法、class/boss独立身份如何保持；搜索展示与奖励最高实际稀有度分开，不按箱外观变掉落或重排卡片。

本文是只读接线约束，不是新美术方案获认可/运行验证通过，也没有授权删除旧素材文件。