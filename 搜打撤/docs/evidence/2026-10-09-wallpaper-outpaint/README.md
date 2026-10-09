# 第一壁纸扩图

- 来源：game/assets/reconstruction/wallpaper-wu-1004.webp（当前首页壁纸一）。
- 使用内置 imagegen 对原图左右扩景，保留人物、雪林书架与冰面画风。
- 产物：game/art-source/home-wallpaper-outpaint-1009/wallpaper-one-expanded.png；2048×768；3137294 字节。
- SHA256：01D2D82079985DBBD5B2CA1BC49613303BCFC2B140F122F715415C5CA1D58D50
- 获取方式：本聊天内置 imagegen 输出，复制保存到上述项目路径。
- 视觉复核：人物与裙摆完整，玫瑰、长剑、书页保留；左右雪林、书架、冰面连续。生成编辑存在细部重绘，非像素级无损拼接。
- 老板随后授权替换原图：已转为2048×768 WebP（515672字节），替换原路径，同步清单与缓存串 snow-expanded-1009；旧图备份在 output/imagegen/wallpaper-one-before-outpaint-1009.webp。
- 定向测试5/5通过；本壁纸清单字节数与SHA256一致，定向资产问题0项；资产检查整体因其他17项素材未登记而失败，详见 verification.json。
- Codex内置浏览器当前1523×956窗口刷新复核：第1张新图显示，背景引用新缓存串，console error 0；截图 home-expanded.png。沿用既有居中与cover裁切，不改布局；未提交。
- 大于1MB的产物仅本地保存，不进git。
