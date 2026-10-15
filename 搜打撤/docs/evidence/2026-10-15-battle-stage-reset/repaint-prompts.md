# 内置重绘提示词

模式：内置 `imagegen` 编辑；每层独立调用。后景参数 `transparent_background=false`，地板与前景为 `true`。原始文件路径、SHA256、编码后文件和透明通道检查见 `repaint-assets.json`。下列为实际请求原文。

## 后景

输入：`nai/backdrop.png`，作为编辑对象。

```text
Use case: style-transfer. Edit target: the attached NAI BACKGROUND layer draft, not a finished composite. Create ONE wide landscape 16:9 BACKGROUND asset for an anime 2D card battle, canvas 1792x1024 or matching the input wide aspect. Keep the camera, central distant vanishing point, broad modern modular transit buildings on both sides, and overhead monorail connection. Make it a beautiful quiet winter FUTURISTIC city with large asymmetrical architectural masses, layered elevated transit and a few suspended automated modules, snow resting on roof edges, distant pale blue towers and a cold soft slate sky. Important: BACKGROUND ONLY; do not add a foreground, close pavement, playable floor, characters or UI. Below about 55% leave only quiet distant blue-gray atmosphere; a separate ground layer will cover it. Reduce the source's dense linear railings, perfect symmetry, and sterile vector/3D look. PAINTING GRAMMAR: hand-painted anime opaque economical color masses, deliberate firm handmade edges, a handful of broad curved or elongated directional coverage strokes, three or four grouped value planes per building, quiet large interiors, selected irregular stroke endings and overlaps. Broad coherent silhouettes, muted cool gray and blue with tiny warm amber window accents. No all-over grain, triangular mosaics, photorealism, airbrushed gradients, castle/medieval/old brick factories, text, UI, watermark, people. Preserve readable distant structures and an unobstructed central vista. This is one independent back layer, NOT a full battle illustration and NOT a three-panel sheet.
```

## 地板

输入1：`nai/ground.png`，作为编辑对象。输入2：上一步内置后景原图，只作配色与透视参考。

```text
Use case: precise-object-edit / style-transfer. Image 1 is the NAI GROUND draft to repaint; it accidentally contains a person: REMOVE THE PERSON COMPLETELY, including their reflection, all people, and all character-like shapes. Image 2 is only the already approved-in-this-production BACKGROUND companion for palette and horizon matching, DO NOT COPY ITS BUILDINGS. Deliver ONE independent ground-plane asset on TRUE TRANSPARENT alpha, same wide 16:9-ish canvas and camera as Image 2. Top 48% of canvas MUST BE EMPTY TRANSPARENT (no sky, white, city or buildings). Starting near y=48%, paint a wide empty science-fiction transit-plaza pavement in perspective, extending continuously across both sides and beyond the bottom edge. Soft irregular painted horizon edge with a tiny amount of transparent feathering to sit over companion backdrop. Standing line at y=61% is level, clear and unobstructed from x=12% through x=90%; leave space for combat sprites. Broad matte slate-blue composite slabs with very few quiet converging joints, cold winter skylight. Sparse pale snow only hugs the extreme side edges. Source has too many narrow horizontal stripes: replace them with a few LARGE calm grouped planes. HAND PAINTED ANIME BLOCK BRUSH: opaque economical broad coverage strokes, firm handmade edges, quiet interiors, few irregular directional marks, coherent muted cool gray masses, no dense linework, no tiny texture, no grain, no glossy floor or plastic reflections. DO NOT draw background, foreground props, vertical objects, people, UI, text or border. All floor itself is solid opaque, ALL area above floor genuine alpha. This is an independently drawn GROUND layer; do not create a composite or multi-panel sheet.
```

提示词中 `approved-in-this-production` 指本轮助手继续制作时选用的配套后景，未获老板审美认可；不能据此登记为老板通过。

## 前景

输入1：`nai/foreground.png`，作为编辑对象。输入2：内置后景原图，只作配色与材料参考。

```text
Use case: style-transfer / background-extraction. Image 1 is the NAI FOREGROUND draft to repaint, Image 2 is ONLY the companion scene's palette and modern material reference. Deliver ONE independent foreground overlay on genuine transparent alpha, wide canvas matching Image 2. Repaint the two existing sparse edge objects as restrained near-camera snow-covered futuristic transit-plaza fixtures: at extreme lower left a SHORT dark blue-gray modular railing BASE, and at extreme lower right a LOW snow-capped composite curb. Keep each object entirely in its own bottom corner, left object within x=0..15% and y=69..100%, right object within x=86..100% and y=72..100%. Extend objects naturally beyond the image edges. The entire center 70% of the canvas MUST remain true transparent empty space from top to bottom. The entire upper two thirds MUST remain true transparent empty space. Do not draw any continuous snow strip across the bottom, continuous pavement, skyline, ground or background. No extra furniture, foliage, structures, people, UI, text, checkerboard, backdrop or shadow rectangle. Hand-painted anime block brush: economical opaque large value masses, firm handmade silhouette, a few broad elongated snow strokes, quiet matte blue-gray surfaces, sparse subdued amber/cyan tiny fixture accents. Match the cold overcast winter daylight and blue-gray large planes of Image 2. Simplify narrow outlines and repeated tiny segments from Image 1; clean chunky readable form. This is ONLY the FOREGROUND overlay, NOT a full scene and NOT a sheet of layers.
```

输出偏差：地板的透明边界约在高度42%，前景物件比要求的角落范围更宽。当前合成中站脚区和操作区未被遮挡；分层与空间可用通过不代表老板审美通过。
