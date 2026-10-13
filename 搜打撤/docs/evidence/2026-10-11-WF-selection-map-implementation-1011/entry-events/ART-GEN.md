# 入城背景生成与定向对照

2026-10-11。两版均通过内置imagegen生成/编辑，运行图已解码和看图。状态：v2接入本域CSS，待最后当前窗口与老板统一审阅；不以测试代替美术验收。

## 方向

源自T01的整页开局焦点/奖励集中，L1/M1的冬境安静冷灰氛围、L2低纹理文字区域；Wu默认模板仅作为手绘块面画法。原创雪城门廊，不复制Neow或新增人物/业务叙事。上部门廊为场景身份，下部中央留真实职业卡面，顶/底不画关键对象或UI。

## 版本与字节

| 版本 | 原图/大小/SHA256 | 运行图/大小/SHA256 | 本轮用途 |
| --- | --- | --- | --- |
| v1 | source/winter-arrival-1011-v1.png，1672x941/1887970B；e788c14518758f11114d265472fdee204bc3c2134c846ff9a7ce6deb0011bb9c | game/assets/scenes/entry/winter-arrival-1011-v1.webp，112604B；1d44a932b6f6f78a11cf72d59eb3d20f9a6c1fbe1445000c56e4a438e7e5a894 | 首轮整页构图样本保留比较 |
| v2 | source/winter-arrival-1011-v2.png，1672x941/1674972B；dd8a237115450d4da8bf0a1ea76601c9e0b943fc18f2b566407951c09b286419 | game/assets/scenes/entry/winter-arrival-1011-v2.webp，88082B；68540f6eec3ba0278fbe9b7e1214ce33790ea077ee9f56598c11edd6f02deb7b | 本轮接入候选 |

v1工具原路径C:/Users/太平/.codex/generated_images/01a12a92-b505-7cd3-8cde-6b7393d6e77f/exec-25d8beb0-2b7f-4f8a-9e52-68c8c8014dbb.png；v2同目录exec-d283e150-8ffe-4d01-8b52-015d110d0dbd.png。模型/seed未返回，不填推测值。

v1唯一图片输入：C:/Users/太平/.codex/skills/artifact-template-wu/assets/reference.png，SHA256 58ca8ec7125b1149c190491643caf1c41b9f22a664e0dfd859e31bc90844cfac，仅画风。v2编辑输入为已查看的v1运行WebP，保留構图/光色/留白，只简化上半建筑内部细碎面。

两张PNG源图>1MB，由source/.gitignore精确排除；运行WebP用已有Pillow环境quality87/method6，RGB、不裁切或重采样，保留1672x941构图。解码load及尺寸一致通过。没有安装、覆盖原稿、映射/manifest修改或build。

## 有依据的比较

- v1：大门轮廓与下部卡牌安全区成立；砖面/木梁/碎雪数量偏多，违反L1内部简略大色块方向，容易在完整页里和奖励对象竞争。
- v2：只减少砖木表面碎面；大门、街道透视、窗暖光、下部留白仍在原位。上半墙体形成较整块的冷灰明暗面，采用v2为本轮候选。实际卡面/文字叠层仍待最终实页，不宣称全页美术通过。
- 界面第二轮自审：沿T01/T02状态持续可见原则加入真实生命/金币/背包格，便于事件已知成本与现有状态比较；不新增未知后果，不改条件。文字和选项顶部对齐、叙事独立滚动保持。
- 统一继续过场采用既有city-cut field场景，只补调用presentation参数，没有新造API。

## 完整词 v1

```text
Generate a new wide landscape 16:9 painterly anime winter-arrival scene for a full-page card-game opening reward screen. Image 1 is strictly DRAWING STYLE reference only: economical opaque broad painted blocks, angular simplified brush marks, coherent complete silhouettes, hard-edged light and shadow, low detail density. Do not include its girl, clothing, hair, sword or accessories. Original environment: a quiet snowy city entrance through a monumental weathered stone-and-timber gateway, snow accumulated on broad ledges, cold blue-gray walls and a glimpse of a pale winter street beyond, one restrained warm window accent. Composition: a single large clearly readable architectural gateway silhouette focused in the upper-middle, x25%-72%, y12%-48%; its open doorway suggests a calm route forward without crowds. Lower-middle x24%-76%, y45%-86% is deliberately a very quiet shadowed gray-blue ground plane without objects, snow flecks or detailed pavement, reserved for two large actual card images layered later in code. Top 0%-10% and bottom 88%-100% have no important scene objects, for live resource controls and the continue button. Make the scene fill the entire picture and feel like arriving in a winter place, not a small UI wallpaper vignette. Complete architectural structure, broad readable perspective, simplified snow and wood surfaces, calm serious but inviting atmosphere, cool-gray shadows and sparse warm light. No new story characters, no creatures, no whale or Neow, no faction marks. No cards, no UI frames, no numbers, no prices, no lettering, no logo, no watermark. Avoid photorealistic textures, smooth 3D rendering, airbrush gradients, complex brickwork, busy props, glossy bloom, sparkles, particles or excessive fog. Use large opaque painted color planes and visible simplified hard-edged brushwork throughout.
```

## 完整编辑词 v2

```text
Edit this winter city-entry background with ONE targeted change: simplify the upper-half architectural detail into larger opaque painted light/shadow planes. Keep the exact wide 16:9 composition, gateway location and dimensions, open doors, central street perspective, cold gray-blue palette, small warm left window, and completely quiet lower-middle card-reveal area unchanged. The current upper walls and timber roof contain too many small broken brick faces, beams and repeated snow specks for the approved low-detail painterly anime style. Group those into a handful of broad structural masses with hard-edged shadows and visible economical brush marks; keep the gateway silhouette structurally complete and convincing, not blurry or unfinished. Preserve the large snow shapes and foreground perspective, simplify only internal surface/brick/wood fragmentation. Do not add/remove the gateway, alter crop, place characters or cards, draw UI, numbers, lettering, logo or watermark. Do not airbrush, smear, add fog or change the lighting.
```
