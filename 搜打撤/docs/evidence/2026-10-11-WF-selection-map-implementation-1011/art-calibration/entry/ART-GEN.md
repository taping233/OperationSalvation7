# 入城画法校准：NAI布局 → 卡面图输入精修

2026-10-11。当前新图与源码为候选，尚未获老板认可；商店认可图冻结、没有编辑。此前中央雪街/门廊v1/v2不作为本轮风格输入。

## 两轮图像与具体对照

1. NAI布局候选：1344x768，默认nai-diffusion-4-5-full、style1.3、seed1011367301、steps28/scale6.5/cfg_rescale0/k_euler_ancestral/karras/variety_plus。只一次网络请求，HTTP200直连channel0；最初Python字符串语法错误在解析阶段即停止，未送网络，修正后才发本轮唯一请求。实际输出是规整暖灰/暗青/赭红矩形，没有环境深度或宽笔触，只可作配色/布局草图。
2. 内置精修：Image1=NAI草图（只布局与配色），Image2=珍珠盒、Image3=红锦囊、Image4=潜行人物卡（后三张只画法/材料与选择性细化）。内置将矩形草图改为左暖灰门柱、右赭红侧门、中央暗青安静面及宽笔触地板；没有人物/雪/中央亮出口/长街/塔/烘焙卡面。珍珠盒与锦囊中的宽不均匀刷面、材料色组和重点边缘成为实际图像风格输入，不套无的人设。

专业依据：SHOP-ENTRY指定左右建筑支撑真实卡焦点；STS2 T01的整体主对象+集中奖励原则用于本项目已获得职业卡，背景没有另一个中央亮街主焦点。材料色组不再统一蓝灰或小三角；“环境安静”由连续画面与宽笔触承担，不是实心色板。最终卡牌/标题叠层仍须实页确认。

## 实际输入与完整记录

- NAI没有图片reference，nai-request.json中的naiImageReferences=[]。观察卡图的SHA只作文本分析来源，不是NAI图片输入。
- NAI完整prompt/UC/char_prompt、模型/seed/参数与调用记录：nai-request.json；调用脚本generate-nai-once.py。没有输出凭据或改变模型默认/config/guard。
- 内置本轮唯一调用image_gen.imagegen，真实四图片输入：
  - source/nai-entry-calibration-v1.png，布局/色组草图，SHA03822662ac73e5cc20ed3101d487fde43717be7c4ffc5c49039d1f932a5d4071。
  - game/assets/cards/equip-tt2-pearlbox.webp，材料块面/宽笔触，SHA2dd1921d7eda3f260ec74be23decc0a70cb6925812fd4e16d1ba0e1e7305e65b。
  - game/assets/cards/equip-tt3-crimson-pouch.webp，布料大明暗色组，SHA25ec4354678c02e55b720c0ee168b3a3490a6df83e274dbd6810f8f3ec042a78。
  - game/assets/cards/martial-tt7-stealth.webp，选择性细化/人物与背景区别，SHA以本轮nai-request.json记录为准。
- 内置模型/seed未返回，不填推测值；完整编辑词在下方。

## 输出

| 输出 | 尺寸/字节 | SHA256 |
| --- | --- | --- |
| source/nai-entry-calibration-v1.png | 1344x768/712747B | 03822662ac73e5cc20ed3101d487fde43717be7c4ffc5c49039d1f932a5d4071 |
| source/imagegen-entry-calibration-v1.png | 1659x948/1765853B | cfeb8d29498a24550a2ee54008036d785f7279398f425b1bb67d1060839022af |
| game/assets/scenes/entry/threshold-cardstyle-1011-v1.webp | 1659x948/68470B | e1c7bb54e0c62b43cf37051b29ec0600eef3fd54810af82fbf71701683b5418a |

工具原PNG：C:/Users/太平/.codex/generated_images/01a12a92-b505-7cd3-8cde-6b7393d6e77f/exec-6da6b4c0-d6c7-4632-89a1-0b5f8ab1c539.png。两个本地源图均在本域source/.gitignore；内置源>1MB仅本地+索引。运行WebP沿已有Pillow quality87/method6，只转格式，尺寸与构图比例不裁切/重采样；解码load与同尺寸检查通过。不是精确16:9原图，记录实际7:4比例，不虚报尺寸。

## 两轮源码设计差异与事件比较

- 上轮：完整大入城页已成立，但中央门洞/雪街与奖励竞争；全屏渐变最高约95%黑，压掉材料光色。
- 本轮：采用新的侧面建筑候选，减为上下边缘薄遮罩与局部状态条；中央实际两张/最多两张已获卡、详情与唯一继续保持焦点。没有更改抽取、扣仓、save/refresh时点或关闭结算。
- 事件此前叙事直接压在场景上。本轮沿T02的阅读与行动分工，叙事增加安静阅读板/边线与独立滚动槽；已有danger选项明确暖色边与详情，真实disabled选项附“不可用”文字。
- “不可用”只来自已有disabled属性，不从label文字猜币数或奖励条件；quartermaster币不足仍沿实际提供者detail与原处理流程，不擅自禁用/改变事件行为。真实资源条用于比较已知代价，未知概率/结果不提前展开。
- 事件叙述/选项与入城说明/已获得卡分别有语义区域，仍复用纯展示壳；没有新业务判断。

## 本轮检查

node-scene-view ESLint通过；departure-class-confirmation/r6-story-flow.repro/events-0919三文件12测试通过，覆盖当前关闭不重奖、保存失败提示与事件业务边界。没有build、全量、提交、发布，也没有将定向逻辑通过记为美术认可。当前根窗口入城/事件叠层截图待root提供定向反馈。

## 内置完整精修词

```text
Edit the first image into ONE coherent original game arrival-environment painting. Image 1 is only a rough COLOR-GROUP AND NEGATIVE-SPACE SKETCH, not a completed scene or a style authority: replace its flat perfect rectangles, thin black outlines and uniform canvas texture with a readable shallow sheltered entrance space. Images 2 and 3 are the PROJECT CARD-ART STYLE authority for broad opaque brush masses, painterly material planes and loose uneven hand-painted edges; use Image 4 only for selective refinement and anime painterly brush economy. Do NOT copy the pearl box, red pouch, girl, silver hair, blue ribbons, roses or weapons into the new scene. Paint a simple original city-arrival threshold: on the LEFT x0-25% one large warm-gray stone wall plane and a thick worn doorway upright; on the RIGHT x75-100% one muted ochre-red wooden side door plane and a dark-teal interior recess. The centre x28-72%, y12-82% must remain continuous calm warm-gray and cool-teal low-contrast space for an overlaid title and two large card images. Give the side structures believable shallow depth with just a few broad planes, not many columns, windows or a central gate. The lower centre is a matte floor with two broad brush-shaped light/shadow masses. Render solid form with 3-4 major value groups per material and long directionally meaningful opaque paint marks like the project card art; retain complete structure but simplify internal detail, and vary edge sharpness rather than using uniform triangles or repeated thin hatching. Keep the center and foreground quiet. There is NO central exit, bright window, street, tower, snow panorama or distant focal point. A tiny pale warm accent may be on a far side only, not a glow in the centre. Top10% and bottom12% are reserved low-detail UI-safe areas. No people, animals, invented emblem, text, numbers, cards, UI panels or buttons baked in. No photorealism, PBR, smooth 3D surfaces, detailed bricks, woodgrain, polygon mesh, small uniform facets, particles, bloom or blurred fog. Wide landscape 16:9-style composition, the architectural framing is secondary and the later actual reward cards will be the primary focus.
```
