# 正常星月职业卡：满月形态（2026-10-04）

老板要求：将满月形态按正常星月人设重绘，独立设计创意分镜，维持固定低细节画风。沿此前明确指示，不测试、不网页验收、不build、不提交。现行ID为tt3-nature-form，已是牧师职业法术卡；本轮保留分类、卡名与能量上限+1效果，只替换画面。

内置 ImageGen，沿 artifact-template-wu 画风模板：大块不透明色面、硬边明暗、概括斜切笔触、少量衣褶与发片，避免精雕、细发丝、繁纹与华丽光效。参考1只管画风，参考2是正常星月立绘：淡奶金发、平刘海、低位长辫、暖金双眼、观众右侧贴发白C形月饰、白金神官裙、深青绿披肩、深色半指护腕；不复制Wu人设，不用暗影形态。

分镜为偏低三分之四视角的转身起势：近景摊掌蓄势、另一手收于胸前，披肩与裙摆展开，长辫沿弧线摆动；背后哑光满月作为单一安静色块，以姿态和剪影表现形态变化，区别于浪掷风吟的扬手吟唱。工具返回图已目视查看，头手与角色身份清楚，无文字、卡框或水印。

生产资源已同名接入 game/assets/cards/spell-tt3-nature-form.webp（1254×1254）与 game/assets/thumbs/cards/spell-tt3-nature-form.webp（448×448，沿既有图库烧色矩阵）。art-mapping只新增tt3-nature-form缓存revision，asset-manifest只登记本两件；浪掷风吟两项及其他改动原样保留。旧图在 originals/；ImageGen大PNG留.tmp/imagegen/xingyue-fullmoon-20261004/fullmoon.png，不进Git。尺寸、体积、SHA256、获取方式见 images.json，完整提示词与参考分工见 generation.json，编码脚本 import-image.py。

实现交付，待老板验收。没有运行测试、资产门或实页验收；未提交/推送。HEAD425d03920e；远端差异、CI及网页表现未核。既有5200服务保留。
