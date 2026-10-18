# 三档宝箱开箱动画与特效

后续状态：老板已授权接入，三档常规箱与独立特效已安装到 `game/assets/scenes/chests/supply-opening-v6/`。实现和停检边界见[实装记录](../../../../docs/evidence/2026-10-16-WF-chest-install-v6/README.md)；下方原始制作说明保留。

每箱4个640×640关键帧：闭合、解锁、半开爆光、全开余辉。箱内青白/紫白/金白光束与稀疏光粒已画在对应箱体帧中；另有一组可单独使用的4帧闪光特效。所有实际帧为真RGBA透明素材，无黑色承托、地面或矩形背景。

| 对象 | 动画预览 | 单帧 |
| --- | --- | --- |
| 小型物资箱 | [WebP](small/opening.webp) / [APNG](small/opening.png) | `small/frame-00` 至 `frame-03`，PNG/WebP各一套 |
| 密封物资箱 | [WebP](medium/opening.webp) / [APNG](medium/opening.png) | `medium/frame-00` 至 `frame-03`，PNG/WebP各一套 |
| 军用保险柜 | [WebP](large/opening.webp) / [APNG](large/opening.png) | `large/frame-00` 至 `frame-03`，PNG/WebP各一套 |
| 独立闪光特效 | [WebP](fx/opening.webp) / [APNG](fx/opening.png) | `fx/frame-00` 至 `frame-03`，PNG/WebP各一套 |

箱体预览每轮1.8秒，由600/160/140/900ms四个关键姿态组成，末尾回到闭合便于循环审阅；这些是四姿态预览，没有生成中间补间帧。独立光效为蓄光、起闪、爆光、余辉四态。若使用独立光效叠加，需按实现控制强度，避免与帧内特效重复叠亮。

`*-sheet.png`保留内置image_gen生成原图；`prompts.json`保存提示词与中箱排版修订；`source-map.json`保存原始生成文件映射。`export-frames.py`仅做等分裁切、等比例缩放、位移对齐与编码，不重绘、不改色、不抠图、不用代码补光。箱身下部投影中心对齐x320、底边对齐y560，实际像素因重采样约1–2px浮动。独立光效按高亮核心对齐。

`animation.json`包含逐帧路径、时间与对齐参数；`delivery-manifest.json`包含45个二进制文件的路径、大小、SHA256与获取方式。`review-board.png`是带棋盘格的验收总览，棋盘格不在实际帧里。PNG/WebP由.gitignore排除，不进入Git。

已逐帧实看总览，并验证16帧透明边缘、静态无损编码、8个四帧动画文件的透明度与可见像素。尚未接入游戏；本轮不修改运行贴图、开箱逻辑、奖励或存档。
