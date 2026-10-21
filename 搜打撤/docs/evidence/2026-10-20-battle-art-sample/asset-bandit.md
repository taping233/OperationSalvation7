> 状态：本轮方案已撤回，以下仅为历史记录。素材、模块与测试已移出运行目录，两处既有源码已恢复；本文不代表当前实现或已完成验收。

# 战斗样板敌人素材：bandit

- 工具：内置 `image_gen.imagegen`，两次调用，`transparent_background=true`；未使用 NAI、外部 API 或图像修补。
- 输入 1（身份、服装、姿势）：`game/assets/portraits/enemies/bandit.webp`，SHA256 `4676BB8BB067BFB85DDA17F22577E30E41968488F54B723EC8823F8C42ECA247`。
- 输入 2（全身画法）：`docs/evidence/2026-10-16-default-art-style/reference-full.png`，SHA256 `0800BCEAE0D4DC2EF986A3FB4741E1CB1BB3A700F6E7024D29A8D4B39608662D`。
- 输入 3（局部画法）：`docs/evidence/2026-10-16-default-art-style/reference-detail.png`，SHA256 `E65A46495CF6C9B6C562BE49B7E6EF9A91A5C1AA2976A7E0B949BFD4FCB5C985`。
- 原始候选 1：`.tmp/battle-art-sample-1020/bandit-candidate-1.png`，SHA256 `38EF4F83340EA7935689C930339FF10A6F5C21510D1F4AB0F97E676897F0B3FB`，1,491,862 字节。
- 原始候选 2（选用）：`.tmp/battle-art-sample-1020/bandit-candidate-2.png`，SHA256 `67F3EB0867F3547CF7E711E83DF77AE2B2249FB0845162916A47030B66750F1C`，1,300,842 字节。
- 运行资源：`game/assets/portraits/battle-enemies/bandit-painted-1020.webp`，SHA256 `E43BFA38D46917EB63A86CE5C038C2FBD618CC392FB6E88E5C76478BA7816C81`，219,338 字节。对候选 2 仅做 WebP 编码，Pillow `quality=82, method=6, exact=True`。
- 获取方式：输入均为项目本地现有文件；原始候选由内置 ImageGen 生成并从 `C:\Users\太平\.codex\generated_images\01a15894-e58f-7012-ab2c-b8b31b413315\` 复制到项目 `.tmp`；运行图由候选 2 编码。
- 核验：WebP 1038×1515 RGBA，alpha 极值 0–255，四角均透明；非零 alpha bbox `(0,23,1023,1497)`，alpha≥64 主体 bbox `(42,110,1016,1435)`。朝画面左，完整单刀和拳、双脚可见；200px 高缩图见 `.tmp/battle-art-sample-1020/bandit-small-preview.png`，轮廓可读。边缘有少量孤立低 alpha 彩点，供主会话实页验收时核对。

## 首次完整提示词

```text
Use case: stylized-concept.
Asset type: transparent full-body enemy combat portrait for a 2D Japanese anime game.
Input images: Image 1 is the target character's exact identity, outfit, weapon and combat pose. Images 2 and 3 are technique-only painting references: full-body brush/shape treatment and close-up line/face/cloth handling. Never transfer the woman's identity, hairstyle, clothing, pose, accessories, or white background.
Primary request: redraw Image 1 as the SAME young adult male bandit, recognizably preserving his vivid red-orange short spiky crest hair with shaved sides, burnt-orange work jacket and pants, brown neck scarf, multiple chest utility pouches, heavy lace-up boots, wrapped right forearm, and exactly one broad rough blade in his left-side hand pointing diagonally down-left. He leans toward screen left in an aggressive bent-knee battle stance, head and gaze facing screen left, torso angled left, with his other clenched fist fully visible. Keep his athletic build, grinning defiant face, recognizable clothing construction, and the complete body silhouette. One male, one blade.
Style/medium: hand-painted anime illustration with opaque layered color blocks, firm light/shadow boundaries, visible directional long and short brush strokes following hair and garment folds, selective dry-brush and chromatic overpainting. Calmer broad clothing planes with selective dense detail. Hand-drawn contours vary in weight and disappear into painted edges. Eyes, face, fingers and weapon grip have clear structure. Matte cloth, restrained metal highlights; no photorealism, no vector-flat fill, no plastic airbrush.
Color/lighting: quiet burnt orange and gray-orange large clothing shapes instead of fluorescent orange. Cool gray-blue shadows and cool upper-left skylight appropriate to a snowy battle setting, warm skin and red-orange hair as concentrated bright accents. Preserve a coherent readable silhouette at 200px displayed height.
Composition: tall portrait canvas approximately 1024×1536, transparent background. Full hair, both fists, both boots, and the entire blade tip strictly inside the image with 3–5% transparent safety margin on every side. Feet at about 96% canvas height. Center the body's standing weight near canvas horizontal center while allowing the blade to project to screen left. Do not crop or mirror. No ground, cast-shadow shape, environmental background, scenery, text, logos, signatures, watermark or UI. Genuine alpha transparency across the empty canvas.
Priority: image 1 controls identity and pose; images 2 and 3 control only paint technique.
```

## 留边迭代完整提示词

```text
Use case: precise-object-edit. Edit target is Image 1, the already generated transparent bandit battle portrait. Make one controlled composition correction only: reduce the full character and single sword uniformly to about 90% of their current scale and reposition so the leftmost sword tip and rightmost wrapped fist each have at least 4% fully transparent margin, hair has at least 4% top margin, and boot sole rests about 95–96% down the canvas. Keep a tall approximately 1024×1536 portrait canvas and genuine alpha transparency. Preserve the SAME male character exactly: red-orange spiky shaved-side hair, face and grin looking to screen left, burnt-orange jacket and pants, brown scarf, chest pouches, right forearm wraps, two heavy boots, one broad rough blade slanting down-left, aggressive forward bent-knee stance, paint texture, muted burnt-orange palette and cool shadows. Preserve anatomy, facial identity, outfit construction and all existing details. No cropping, no mirror, no new object, no second weapon, no ground or shadow shape, no background, no letters, logos or UI.
```
