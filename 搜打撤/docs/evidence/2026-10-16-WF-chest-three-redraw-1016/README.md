# 常规三类宝箱重画候选

后续状态：本版灰白工具箱已被老板明确否定，保留为历史候选。新一轮见 [明日方舟方向彩色重画](../2026-10-16-WF-chest-arknights-v2/README.md)。

2026-10-16，老板要求物资箱重画并询问是否有三种。核对 game/data/map.json：常规为 small「小型物资箱」、medium「密封物资箱」、large「军用保险柜」；另有 boss「首脑保险柜」及 isClass 职业补给变体。当前 chest-opening-art.js 将五种外观共用 safe-simple-v7 开合帧。

本轮使用内置 image_gen 分别生成三张闭合透明候选，延用项目默认块面画法与既定灰白、石墨黑、少量朱红。小箱为扁平便携手提箱，中箱为厚实密封硬壳箱，大箱为立式军用保险柜，通过轮廓区分。三图均已实看，1254×1254 RGBA，透明度范围0–255；主体不透明边界完整，画布边缘无不透明像素。微弱半透明边缘像素未做后期清理。

交付路径：`game/art-source/chests/three-kinds-redraw-1016/{small,medium,large}.png`。完整提示词见该目录 `prompts.json`，逐图来源路径、大小、SHA256与获取方式见 `receipt.json`。原始PNG由同目录 .gitignore 排除，不进入Git；本地文件保留供预览与后续处理。

状态：候选已交付，编辑占用释放。尚未替换运行贴图，也未生成开箱动作；掉落、箱型规则、manifest 和现有开箱帧均未修改，无新服务、不build、不提交。
