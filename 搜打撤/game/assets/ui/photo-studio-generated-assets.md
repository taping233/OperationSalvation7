# 照相馆生成美术资产记录

生成日期：2026-09-19  
模型：NovelAI Diffusion V5 Full  
统一画风模块：`D:\素材\代号柒\.tmp\nai\style_modules\official_painterly_style.py` v1.0  
画师串：`1.2::miv4t::, 0.8::quasarcake::`

## 墙面

- 墙面最终采用 CSS 暗赭黄色旧墙纸，用径向渐变、纸张竖向接缝、钉孔与局部磨损建立细节，不再使用环境插画。
- NAI 黄墙纸样图 seed `995651898` 产生了中央规则网格，与「纯色旧墙纸」目标不符，未发布到游戏资产。

## 透明墙钉

- `photo-nail-v1.png`：seed `272566725`，512×512，alpha 0–255；正面旧铁钉帽，用于把每张照片直接钉在墙上。
- 原始文件：`D:\素材\代号柒\.tmp\nai\output\photo-nail-alpha-20260919\photo-nail_seed272566725.png`

用途：每张卡牌顶部中央独立叠放一枚墙钉；麻绳与夹子方案已取消，相关发布资产已移除。

## 影廊版素材（2026-09-19 深夜，照相馆 4.0 影廊改造）

老板拍板「酒红绒布影廊」方向后全新生成，`assets/ui/photo-studio/` 下五张 webp（quality 78，共约 159KB），
CSS 挂载点见 `expedition-library.css` 的 photo-studio-v3 段；图丢失时各挂载点均有渐变兜底层：

| 文件 | 原图 seed | 规格 | 挂载点 |
| --- | --- | --- | --- |
| wall.webp | 207888680 | 1216×832 | 卡格区背景墙（clib-main，cover） |
| sign.webp | 1928749931 | 1216×832 | 页头牌匾底纹（library-head，88-93% 暗化） |
| desk.webp | 438337378 | 832×1216 | 选片台台面（library-inspector，cover） |
| empty.webp | 120616023 | 1216×832 | 空态静物插画（clib-empty，cover） |
| back.webp | 1959446116 | 832×1216 | 大图背签相纸背面（#cardZoom .cz-note.has） |

出图脚本：`D:\素材\代号柒\.tmp\nai\cardlib_gallery_0919.py`（官方 painterly 模块 v1.0，
socks5h://127.0.0.1:7890 通道，45s 铁律/429/000 重试内置）。同批取代「塑料图钉/卷角/磨损斑」
旧拟物层：photo-nail-v1.png 自此无引用（保留未删，处置待老板定）。
