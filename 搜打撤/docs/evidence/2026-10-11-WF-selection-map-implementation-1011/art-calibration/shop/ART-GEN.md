# 商店画风单张校准：NAI阶段

2026-10-11。状态：一张NAI候选经内置卡面参照精修及位置定向修正后，老板确认当前商店背景“不用改”。已原样保存source/shop-card-style-approved.png，见APPROVED.json；图像停止迭代。该认可只针对当前商店背景图，不代表整个界面已验收。本步骤未接游戏、未改shopCSS/JS/映射。上一shop/entry v1/v2均非画风锚点。

## 本轮依据与输入

按art-research-reset/SHOP-ENTRY.md：原创临时室内铺位，左28%商人/柜台，右商品安全区，大主色与有方向宽笔触，无雪/亮中央出口/均匀小三角环境。

已实际看卡面：game/assets/cards/martial-tt7-stealth.webp、equip-tt2-pearlbox.webp、equip-tt3-crimson-pouch.webp；作为文本画法观察。当前tools/nai_gen.py没有图像reference形参，**这些图片没有发送给NAI**。NAI输入只有完整prompt/UC/char_prompt，naiImageReferences=[]；观察卡图SHA记录在nai-request.json。后续内置精修才可使用真实卡面图片作为视觉输入。

## 实际调用

- 客户端：tools/nai_gen.py generate_image，一次调用；HTTP200、直连channel0，无手动重试/第二NAI请求。
- 风格：tools/nai_style.py v1.3；使用build_asset_prompt和build_uc，未散改配方。
- 模型：nai-diffusion-4-5-full默认；seed=1011353401；1344x768 landscape。
- 参数：steps28、scale6.5、cfg_rescale0、sampler k_euler_ancestral、noise_schedule karras、variety_plus=true；其余请求体由现行客户端构造。
- 客户端现行RequestGuard负责预约/节流/额度与失败关闭；本轮未更改guard、config、模型默认或安装依赖。尺寸处于本地FREE_PX_CAP之内，不把本地阈值等同远端计费承诺。
- 原图：source/nai-shop-calibration-v1.png，664147字节、1344x768；SHA256 ee80c7d0bcda4c75acbe32a06ddae3636bf9ec3abff2d1d9b7a03e0826c2ea7e。客户端PIL尺寸/verify检查通过，并view_image实际看图。
- 可复查文本/调用：nai-request.json与generate-nai-once.py；未记录/输出凭据。源图为本地候选，由本域source/.gitignore精确忽略，不自动落库。

## 看图结果与下一步

可见事实：商人在左、脸/手/帽围巾清楚，赭红内衫有主色；柜台延至约36%宽，右侧约76%几乎为单一实心暗青面，衣服有细线排/小褶。未见雪、中央亮出口或烘焙UI。

判定：有清楚主色与人脸，但还没有目标卡面的宽不均匀材料笔触；商品留白过于字面化，柜台仍侵入安全区。它是精修底稿，不能记为风格通过。

下一步建议：内置imagegen只在此原图上定向精修，保留原创NPC与主色；柜台压回左28%，右侧给两三个连续低对比墙/布大面，按实际珍珠盒/锦囊/人物卡改宽方向笔触与选择性细化。具体图片输入要逐张标角色/构图或画法，不把卡面物件/无的人设带进商店。未自行第二次NAI；是否由root或本代理精修待协调，避免双重生成。

## 完整文本输入

### Prompt

```text
1.2::miv4t::, 0.8::quasarcake::

An original indoor temporary supply stall. One adult anime shopkeeper, short brown hair, warm brown eyes, a plain dark knitted cap, muted scarf and charcoal work coat with a small dull terracotta-red cloth accent. The shopkeeper stands calmly behind one compact counter at the far LEFT edge; a clear expressive face and two coherent hands resting naturally on the counter. No named character or story role.

One wide landscape game-art style calibration image, not a finished game screenshot. The subject is a temporary shop interior. No interface is drawn.

Strict asymmetric layout: merchant silhouette entirely within LEFT x6-26 percent and y18-65 percent. Counter, hands and one small warm lamp are contained entirely within LEFT x2-28 percent, with no tabletop extension crossing into the centre. RIGHT x32-97 percent and y16-82 percent is a continuous quiet merchandise-safe plane formed from only two or three broad interior curtain/wall masses, no shelf clutter, no boxes, no openings. Upper 12 percent and lower 14 percent are calm and contain no important props. A wide horizontal indoor scene, no central exit or receding street, no snow. Avoid symmetry and avoid a centrally placed character.

Use warm gray, deep muted teal, neutral charcoal and one modest ochre-red cloth group. Distinguish cloth, counter and metal through broad color groups. Build each major material from three or four large confident light/shadow planes with broad directionally meaningful painterly strokes, loose uneven hand-painted edges and complete readable silhouettes. Selectively refine the face, eyes, hands and counter contact; simplify all clothing folds and environmental surfaces. The right merchandise field has low contrast, not black emptiness. A small amber lamp has a precise small highlight without bloom. This is economical opaque anime brush painting, not an environment made of uniformly sized little triangles or faceted polygons. No photorealistic material textures, no detailed brick or woodgrain, no PBR, no shiny floor.

masterpiece, best quality, painterly, sketch, visible brush strokes, loose hand-painted texture, broken edges, blocky volume modeling.

A complete illustration with the freshness of a painted sketch, not an unfinished draft. Soft directional light reveals the planes of forms. Build volumes from confident planes of light and shadow with visible brush edges, while letting selected outer contours remain open. Use broad flowing paint masses, dry uneven strokes, and crisp small highlights appropriate to each material. Vary the brush size and edge sharpness between different materials. Preserve deliberate brush marks instead of smoothing every surface.
```

### UC

```text
flat cel shading, smooth airbrush, no brush texture, clean closed lineart, fully rendered polished painting, plastic texture, waxy texture, blurry fingers, extra fingers, missing fingers, fused fingers, text, watermark, signature, frame, collage, multiple views, snow, snowflakes, exterior, blue ribbon, blue bow, roses, silver ponytail, white hair, goggles, Wu, Neow, bucket helmet, silver cape, central bright doorway, bright window, long counter, counter crossing center, shelf clutter, stacks of crates, products, cards, card frames, interface, ui, prices, lettering, numbers, woodgrain, brick texture, pbr, photorealistic, shiny floor, reflections, lens flare, bloom, particles, low poly, polygon mesh, uniform triangular facets, tiny repeated brush strokes, many small color fragments, symmetrical composition, centered person
```

### Character prompt（文本）

```text
An original adult human shopkeeper with short brown hair, a plain dark knit cap and muted scarf, charcoal coat, clear expressive face and coherent hands, behind a compact counter at the far left.
```
