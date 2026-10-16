# 历史画风试案：冬日动画绘景

游戏当前默认采用[2026-10-16 双图块面厚涂](ART-STYLE-V1.md)。本页仅保留 2026-10-16 雪原画风试案及其提示词，供明确指定该版本时复现；原始参考（本地 `game/art-source/style-winter-painterly-20261016/reference.webp`，候选原件保留）与[迭代记录](../../evidence/2026-10-16-winter-painterly-style/README.md)保留。[恢复记录](../../evidence/2026-10-16-restore-default-art-v1/README.md)记录此前恢复历史打包版的决定；后续双图修订见[现行默认记录](../../evidence/2026-10-16-default-art-style/README.md)。

## 核心画法

细线二次元人物与手绘写实绘景结合。透视、结构和材质可信，形体用有取舍的色面、笔触与边缘组织；人物脸眼较清楚，环境细节随距离和明暗收放。相似度由雪、金属、植被、天空和路面的具体画法共同建立，仅调成蓝色或增加颗粒不能成立。

- **人物**：细而克制的彩色轮廓线融进局部颜色，以清楚的赛璐璐明暗为骨架，局部有柔和中间调、脸颊排线和冷暖变化。眼睛通透，皮肤与衣料偏哑光。发束先组织成有体积的大组，再选择性补发丝；衣褶服从受力与主投影。脸部暗面保持细微层次，避免整张脸平涂成一块蓝灰。
- **边缘与笔触**：硬边、软边和局部消失的边缘交替。笔触沿体积转折、积雪堆叠和材料方向出现；形状、大小、间距各有变化。主体结构完整，局部边缘可融入邻近颜色；不要把所有对象描成同等清楚的闭合轮廓，也不靠全图模糊制造绘画感。
- **细节分配**：近处可有丰富颗粒和小笔触，但密度、大小与清晰度不均匀；反光或安静色面会压住纹理。中景逐渐概括，远景合并形体并降低对比。主次由画面焦点决定，避免整幅等精度、等纹理密度。
- **光色**：默认以低饱和灰蓝、青灰等冷环境色组织大面，少量柔和暖色建立温度与焦点。漫射光、有限逆光和局部反射相互一致；暖边断续出现，暗部有色彩与结构。具体光源、时段、天气及角色身份色服从场景，不给每张图强加粉色日落、雪花光点或固定冷暖比例。

## 环境材质的视觉锚点

| 对象 | 应采用的画法 | 需要修正的偏差 |
| --- | --- | --- |
| 积雪 | 顺地形、草和支柱堆叠；不规则白蓝折面与蓝灰阴影相扣，大小块交错，部分边缘融进雪地 | 护栏上重复排列、大小相近的圆白团；奶油般的光滑鼓包 |
| 金属护栏与交通构件 | 厚重暗面为主，宽窄不一的局部擦色与断续反光；雪、阴影和笔触打断轮廓 | 连续贯穿的亮边、整齐重复的高光与过度清楚的机械碎节 |
| 远处树丛、地形与建筑 | 蓝灰综合色中的不规则低对比轮廓，少数色痕交代高低与疏密，部分与邻近雪地合并 | 每棵树、每栋房屋独立描清；地平线上重复的小模块 |
| 田野与枯草 | 安静的大面上穿插疏密不同的灰赭短笔，近远尺度变化 | 均匀撒点、规则种植般的草列、到远处仍同样清楚 |
| 湿路面 | 连通的暗蓝中间调，宽而轻的反光、局部颗粒与磨损标线；反光边界有虚实且左右不必对称 | 满地等大的圆石颗粒、密集黑裂纹、硬边水坑、数条规则发亮的粉橙光带 |
| 天空 | 大层次灰蓝云气、柔和过渡，低处微弱暖光渗入；局部保持宽阔平静 | 密集花边小云、过饱和统一蓝色、地平线整条高亮橙带 |

## 适用范围与参考分工

- 明确要求复现本试案时采用以下画法；新作或重绘默认沿[双图块面厚涂](ART-STYLE-V1.md)。人物身份仍按[人设库](../../character-bible/README.md)，构图、姿态、服装、道具与用途沿当次要求；参考图中的人物、帽子、辫子、光环和乡村公路不继承为游戏设定。
- 游戏世界仍按[美术方向](ART-DIRECTION-BRIEF.md)维护未来科幻城市与冬季场景。雪、路面和护栏是材质锚点，可转译到城市构件；室内、宝箱或非雪景不强制积雪。卡面背景与分镜沿[视觉规范](VISUAL-BIBLE.md#卡面与出图参考)，保持抽象色块或元素意象。
- 本页不改 UI 的布局、字体、既有 SVG 或独立图标体系。现有运行资产按各自接入状态维护，本次更新的是后续制作标准与参考。
- 个人画风技能、NAI 画师链和配方是独立来源。明确复现本试案时核对风格词，避免把其他版本要求混叠；游戏默认以[双图块面厚涂](ART-STYLE-V1.md)为准。

## 可复用画风段

生图时实际附上原始风格参考；另外提供主体与构图参考，并标明分工。以下段落可换主体、场景、光源与材质，不将雪原示例的具体物件当作通用内容。

```text
Use the supplied master reference for actual painting grammar, not only color grading. Delicate colored anime linework and restrained cel-shaped character shading with subtle midtones, matte materials, expressive eyes and economical facial hatching. Organize hair into coherent volumes with selected fine strands; keep cast shadows and quiet cool-warm variation in the face.
Hand-painted believable environments with irregular interlocking color shapes, directional strokes and varied hard, soft and lost edges. Preserve structural perspective while varying shapes, spacing and contrast. Metal reads as weighty dark planes with intermittent broad rubbed highlights. Snow, when present, follows the terrain in uneven angular blue-white masses and muted shadow cuts. Distant vegetation and architecture merge into low-contrast atmospheric color masses.
Use selective fine texture: varied clusters in articulated near areas, quiet connected passages elsewhere, texture suppressed by reflections and distance. Broad soft reflections with broken edges; no evenly distributed round gravel, repeated snow blobs, continuous glowing rail edges or uniformly sharp distant objects. Spacious softly layered sky where visible.
Muted cool ambient colors with restrained localized warm accents, diffuse illumination and occasional soft broken rim light as appropriate to the scene. Match the requested light source and subject identity colors. Avoid glossy 3D, uniform vector fill, dense outline networks, all-over grain filters and saturated sunset ribbons. Preserve the specified subject, composition and clothing. No text, watermark or UI baked into the illustration.
```

审阅时先对照参考的雪、金属、远景与路面，再核对人物。检查形状重复、边线连续程度、远近对比、纹理疏密与暖光面积；新样本未获老板反馈前记录为候选。
