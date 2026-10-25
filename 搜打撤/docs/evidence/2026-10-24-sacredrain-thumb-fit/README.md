# 浪掷风吟小图适配

浪掷风吟换成横版插画后，卡牌库仍命中旧的完整展示配置，使用 contain 及靠上对齐，在方形照片区域留下大块黑底。移除 `PHOTO_FOCUS` 中的 `tt8-hero-priest` 旧覆盖后，沿用默认 cover、居中裁切填满小图区域。原图及缩略图像素不变，放大图保持完整。

依据：老板提供的卡牌库截图，以及 `game/src/hub/game.cardslib.photo-props.js` 的 `photoFit` / `stablePhotoStyle`。按老板要求未检测、未测试、未 build、未实页验收，未提交。
