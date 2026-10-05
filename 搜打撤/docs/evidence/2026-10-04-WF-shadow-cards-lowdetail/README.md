# 暗影星月低细节卡面重绘（2026-10-04）

老板反馈上一张恶魔之力过于精致，要求按上传的 Wu 参考图重绘吞噬、嗜血术、绕敌（保持原构图）、禁言术，并使用暗影星月身份。本轮也收简恶魔之力，共五张。实际库名对应为噬血术、扰敌；ID通过当前5200的Cards只读定位，未修改卡牌名字、数值或效果。

## 画风与角色

匹配的画风技能为 artifact-template-wu，参考上传图优先；项目 docs/ui-art-overhaul/SKILL.md 和 tools/nai_style.py 仅作为既有流程/旧配方线索，不让旧的精致度倾向覆盖新要求。内置 ImageGen，每张独立生成。画风参考置于首位，禁咒I仅供身份：银灰发、紫眼、贴发黑月饰、黑色高领、黑紫披肩、黑手套。没有继承 Wu 的护目镜、高马尾、黑蔷薇、蓝星裙或剑。

全部采用大色块、硬边明暗、概括笔触，缩减碎发、衣纹、魔法细线与光晕；已目视检查工具返回画作。扰敌保留左侧施术者、上下双手、向右牵线、右侧两只敌人互攻的构图。吞噬改为俯视对角线与缺口月蚀吸收；噬血术以三片宽红魔力带表达吸收/恢复；禁言术用横向封缄带封住声音；恶魔之力用几块角形魔力替代精细怪兽与满屏丝线。

## 接入与保留

五张原图同名替换在 game/assets/cards/，相应缩略图同步写入 game/assets/thumbs/cards/，保持约4:3；原图1448×1086，缩略图448×336并沿既有图库烧色矩阵。art-mapping.json仅更新五项缓存revision；asset-manifest.json仅登记本轮十件的bytes/SHA256/来源，保留其他增量。旧图备份在 originals/，不删除。完整提示词/参考角色与生成源路径见 generation.json，生产及原件尺寸、SHA256、获取方式见 images.json；再现编码脚本为 import-images.py。

ImageGen原始PNG及上传画风参考保存在 .tmp/imagegen/shadow-cards-lowdetail-20261004/；超过1MB原件不进Git，只记路径/哈希/获取方式。最终WebP均小于1MB。

老板已明确“不测试、直接改”，本轮没有运行测试、资产门、网页验收或build。实现交付，待老板验收；未提交/推送。HEAD 425d03920e；远端差异和实页效果未核。5200既有服务保留。

| 卡名 | 最终文件 |
|---|---|
| 恶魔之力 | game/assets/cards/spell-cc-demon.webp |
| 吞噬 | game/assets/cards/spell-tt3sp-devour.webp |
| 噬血术 | game/assets/cards/spell-tt7-bloodpotion.webp |
| 扰敌 | game/assets/cards/spell-tt7-provoke.webp |
| 禁言术 | game/assets/cards/spell-tt7-silence.webp |
