# 成就徽章五风格图册

26个成就的五风格已接入游戏：出图阶段新增23张，初出茅庐、猎手、传说典藏三张直接复用。每张从左到右为01厚涂、02笔势、03水墨、04剪纸、05负形。

原图统一保存于项目 `.tmp/imagegen/achievement-five-styles/`，单张2172×724。图片大于1MB，不进Git；各 `receipt-<成就ID>.json` 记录相对归属、实际路径、源文件、SHA256和获取方式（内置image_gen生成后复制，保留原文件）。

实际提示词与参考见 [remaining-request.json](remaining-request.json)；每张完整提示词在对应receipt中。前三张为先前已完成样板，不在本轮生成列表。

出图阶段逐张查看工具返回画作；文件核对26/26、成就ID覆盖26/26、SHA25626/26、原图可解码26/26。该阶段只验画作；接入验证见下文。

| 成就 | 五风格原图 | 本轮状态 |
| --- | --- | --- |
| 初出茅庐 | [firstExtract.png](../../../.tmp/imagegen/achievement-five-styles/firstExtract.png) | 原样保留 |
| 猎手 | [kill10.png](../../../.tmp/imagegen/achievement-five-styles/kill10.png) | 原样保留 |
| 传说典藏 | [collectLegend.png](../../../.tmp/imagegen/achievement-five-styles/collectLegend.png) | 原样保留 |
| 老练搜刮者 | [extract3.png](../../../.tmp/imagegen/achievement-five-styles/extract3.png) | 本轮新生成 |
| 破壁者 | [firstBoss.png](../../../.tmp/imagegen/achievement-five-styles/firstBoss.png) | 本轮新生成 |
| 净化征服者 | [allBoss.png](../../../.tmp/imagegen/achievement-five-styles/allBoss.png) | 本轮新生成 |
| 小有积蓄 | [rich30.png](../../../.tmp/imagegen/achievement-five-styles/rich30.png) | 本轮新生成 |
| 仓廪充实 | [stash20.png](../../../.tmp/imagegen/achievement-five-styles/stash20.png) | 本轮新生成 |
| 能工巧匠 | [bagMax.png](../../../.tmp/imagegen/achievement-five-styles/bagMax.png) | 本轮新生成 |
| 最忠实的伙伴 | [safeMax.png](../../../.tmp/imagegen/achievement-five-styles/safeMax.png) | 本轮新生成 |
| 崭露头角 | [class3.png](../../../.tmp/imagegen/achievement-five-styles/class3.png) | 本轮新生成 |
| 珍品收藏家 | [collectGold.png](../../../.tmp/imagegen/achievement-five-styles/collectGold.png) | 本轮新生成 |
| 博物学家 | [collect5.png](../../../.tmp/imagegen/achievement-five-styles/collect5.png) | 本轮新生成 |
| 驯养新手 | [petHatch1.png](../../../.tmp/imagegen/achievement-five-styles/petHatch1.png) | 本轮新生成 |
| 孵蛋专家 | [petHatch3.png](../../../.tmp/imagegen/achievement-five-styles/petHatch3.png) | 本轮新生成 |
| 心有灵犀 | [petMax.png](../../../.tmp/imagegen/achievement-five-styles/petMax.png) | 本轮新生成 |
| 宠物满堂 | [petAll.png](../../../.tmp/imagegen/achievement-five-styles/petAll.png) | 本轮新生成 |
| 无限能源 | [unlimitedEnergy.png](../../../.tmp/imagegen/achievement-five-styles/unlimitedEnergy.png) | 本轮新生成 |
| 武器大师 | [weaponMaster.png](../../../.tmp/imagegen/achievement-five-styles/weaponMaster.png) | 本轮新生成 |
| 符文爱好者 | [runeFan.png](../../../.tmp/imagegen/achievement-five-styles/runeFan.png) | 本轮新生成 |
| 拯救者 | [savior.png](../../../.tmp/imagegen/achievement-five-styles/savior.png) | 本轮新生成 |
| 好美的花瓶！ | [beautifulVase.png](../../../.tmp/imagegen/achievement-five-styles/beautifulVase.png) | 本轮新生成 |
| 借过 | [excuseMe.png](../../../.tmp/imagegen/achievement-five-styles/excuseMe.png) | 本轮新生成 |
| 实验数据·铜 | [labScore1.png](../../../.tmp/imagegen/achievement-five-styles/labScore1.png) | 本轮新生成 |
| 实验数据·银 | [labScore2.png](../../../.tmp/imagegen/achievement-five-styles/labScore2.png) | 本轮新生成 |
| 实验数据·金 | [labScore3.png](../../../.tmp/imagegen/achievement-five-styles/labScore3.png) | 本轮新生成 |

前一轮泛化厚涂整库图未采用；本轮没有重新生成已有三枚。

## 接入与分类切换

每次打开成就陈列室等概率随机选择五套中的一套，26枚、列表、集中陈列、详情和侧栏水印共用该套。分类和搜索不重抽；重新打开会再次抽取，允许重复。分类切换执行220毫秒淡入和上移，连续切换可重播；系统或游戏的减少动态效果设置关闭该动画。

运行素材为 `game/assets/ui/achievement-styles/` 下五张WebP图集，共130枚。直接从确认图提取主题区域，去掉底部编号，不重新生图；保留原画的纸面底色。SVG单格裁切防止邻格出现在宽窄留白处。[integration-receipt.json](integration-receipt.json)记录26张原图SHA256、130个提取范围及五套运行图集SHA256。

接入和动画修改后定向45/45通过（achievement-gallery、contracts、architecture-boundaries）。本轮五张素材审计零问题，见[own-asset-check.json](own-asset-check.json)；全局素材审计仍有21项范围外错误，见[asset-check.txt](asset-check.txt)，没有修改对应素材或债基线。

Codex内置浏览器真实点击验证分类、连续切换、猎手详情、返回并重新打开、集中陈列；分类变化保持同套，重开实际从symbol抽到painted，26项同套，页面error0。CSS读取确认动画名、0.22s时长及中间透明度/位移，记录见[browser-checks.json](browser-checks.json)；[集中陈列](browser-grid.png)、[猎手详情](browser-detail.png)。未设置viewport覆盖；记录保留当时窗口尺寸，未作多尺寸对比。未build、未全量、未提交。
