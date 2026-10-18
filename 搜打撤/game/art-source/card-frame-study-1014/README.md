# 等宽卡框候选稿

13款独立透明框已用于参考板，并已生成运行WebP接入游戏共用cardHTML。使用内置 `image_gen` 生成：先重绘初始底框，再以该图编辑12个品质/职业版本，仅改颜色与纹章，保持同一框体几何和简略块面画法。

- 全部原始PNG直接复制，未重采样、未裁切或后期修图；`docs/previews/card-split-20261014/import-frames.py`仅复制文件并读取透明通道测量。
- 版本：initial、common、rare、epic、legendary、token、prism；wu、heixiang、baita、xingyue、changwuyu、neutral。
- 稀有框现用蓝色四边与蓝蔷薇重绘版；[本轮提示词](../../../docs/evidence/2026-10-15-rare-blue/request.json)与[导入记录](../../../docs/evidence/2026-10-15-rare-blue/receipt.json)维护当前来源，原银灰版提示词保留为历史。
- [完整提示词](prompts.json)记录底框请求和12个编辑请求。[几何与来源清单](geometry.json)记录每图路径、原始生成路径、SHA256、字节数、开口与框宽。
- 原PNG保留在本目录，以`.gitignore`排除二进制；单图超过1MB不进入Git。恢复方式：按`geometry.json`的`source`复制到`path`，核对SHA256；原始生成文件仍保留在Codex生成目录。
- 基准绘制输入：现有`game/css/card-frames/rose-painterly-1012/common.webp`，以及`artifact-template-anime-block-brush`技能的source-5、source-8、source-1画风参考。后续12款以新底框为编辑输入。
- 参考板以原图宽高比整体缩放，`height:auto`；不使用边框切片、独立横纵缩放或压扁花饰。以232px画窗宽度估算，左右框体宽度约24.89–25.88px，纹章交界和手绘边缘另有局部起伏。
- 费用栏、类型铭牌、卡图、卡名、规则文字与棱彩动态光效独立排版，不烘焙进框图。

参考板入口：`docs/previews/card-split-20261014/gallery.html`；运行图位于`game/assets/ui/card-frames/split-1014/`，通过`game/data/card-frame-layout.json`和card-frame-presentation.js接线。接入证据见`docs/evidence/2026-10-15-card-face-integration/`；10-14参考板时点的记录保留在`docs/evidence/2026-10-14-card-split-reference/`。
