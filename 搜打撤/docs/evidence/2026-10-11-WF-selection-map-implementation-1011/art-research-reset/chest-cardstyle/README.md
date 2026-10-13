# 卡面画法宝箱首样本

2026-10-11，老板继续授权五类透明箱。先只生成small普通箱，根方向审阅待返；未扩展，未改CHEST_ART/manifest，接线由节点代理负责。

**后续状态覆盖：老板明确否定“依然非常难看”，这套不合格，不再扩展或接CHEST_ART。** medium/large/class/boss工具候选仅留生成历史，不能沿首图技术透明通过称美术合格。新阶段只一只NAI→内置实图结构/卡面画法组合，记录见../../art-calibration/chest/README.md。

输入仅实际卡面珍珠盒/红锦囊，角色资料和被否定雪箱没有作为图片输入。外部结构研究见../CHESTS.md。首样本已实际看图：赭红矮宽箱体、灰铁宽箍、米金大锁板，盖缝清楚，宽色面有方向笔触，无雪/角色装饰/场景/光柱/白描边。是否符合老板审美尚未通过；不是正式替换认可声明。

- 生成工具内置imagegen，transparent_background=true；模型/seed未返回。
- 源PNG1254×1254、RGBA、1231891B，>1MB只留source精确.gitignore，SHA256 `2e5244e7880263cf9eef64c460cb848096766e3380f92192c8335635b998ac05`。
- 新产物`game/assets/scenes/rewards/chest-small-cardstyle-1011-v1.webp`，815604B，SHA256 `ce11a73fa18d93700c93b4ef8fb518e1925be3af4261b142eafded0cba89042a`。
- Pillow仅保存lossless=True/exact=True WebP，无裁切/重采样，回解码逐字节RGBA与PNG相同；alpha范围0–255、透明通道逐字节相同。git check-ignore确认源PNG被精确排除。
- 输入文件SHA及生成原路径见receipt-small.json；未build、提交、覆盖旧图。

## 完整生成词

```text
Create ONE original ordinary CLOSED treasure chest as a standalone game prop with a fully transparent background. Reference image 1 (pearl box card) and reference image 2 (crimson pouch card) are strictly PAINTING STYLE references: broad opaque hand-painted color blocks, loose economical directional brush marks, a complete legible silhouette, a few hard-edged light and shadow masses, selective detail. Do not reproduce the pearl, jewelry-box shape, silk pouch, straps or background from those cards. Subject: a squat wide travel chest, gentle shallow curved lid, sturdy simple box body, two broad iron reinforcement bands, one large readable lock plate. Three-quarter front view, visible top/front/right side, width about 1.8 times body height; closed lid seam clearly readable. Original simple construction, no copied commercial design. One dominant warm reddish-brown wooden material, muted gray iron bands and a small soft brass lock, subtle blue-gray shadow planes. Use 3 to 4 broad value groups to explain the form. Keep the main wood panels quiet with only two or three construction seams; broad irregular painted reflection patches on metal, not glossy gradients. The pearl-box card's relaxed painted edges and the red-pouch card's large uninterrupted color masses are the decisive style. This is a hand-painted object, not a smooth 3D model, not a flat vector icon, not pixel art. Fill around 78 percent of a square canvas width and 55 percent height, centered, with clean transparent breathing room all around. Entire chest must be opaque and its outer contour fully filled. Nothing else in the picture: no snow, no ice, no blue ribbon, no rose, no character emblems, no decorative symbols, no jewels, no scenery, no floor, no cast shadow plane, no white outline, no luminous aura, no particles, no light beam, no text, no watermark, no UI. Avoid dense tiny scratches, repetitive rivets, realistic grain, excessive broken polygon facets or ornate filigree. Make the lock and lid/body distinction readable at a 300px-wide display.
```
