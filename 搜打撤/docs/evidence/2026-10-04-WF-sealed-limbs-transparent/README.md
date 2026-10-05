# 四张封印肢体 · 自由设计透明素材（任务开始日期2026-10-04）

老板令不参考原图、自由重画封印肢体，并明确要求透明素材。实时卡名/ID对应：肢体1=tt8-curseimmune，2=tt8-energycap，3=tt8-nofocus，4=tt8-healplus；生物专属卡面沿现有creature-<id>.webp路径加载。只重画，不改封印/破封玩法或卡牌数据。

内置ImageGen分别调用四次，transparent_background=true，原始source-5/8仅宽笔画法参考，不输入旧卡。自由设计为张开影爪、攥紧影拳、折曲足肢、伸展足肢四个不同剪影，统一墨紫/深蓝、少量灰青面、灰色粗链和菱形封结；非血肉断肢，无流血、骨骼断面或实体环境。每张一件，周围留透明空间。全部工具返回图已实际查看展示，没有挑选一张冒充四张；完整实际提示词见generation.json。

四张原生PNG均为RGBA、alpha范围0–255（在编码时记录输入元数据），透明来自ImageGen，不抠黑底、不绘棋盘格。源PNG保存game/art-source/cards/creature-tt8-{curseimmune,energycap,nofocus,healplus}-transparent-20261004.png，1254×1254，仅本地保留；来源/bytes/SHA256见images.json，超过1MB者不进Git。

已同名实装game/assets/cards/creature-tt8-{curseimmune,energycap,nofocus,healplus}.webp与同名thumb，共八件RGBA WebP，原图1254×1254/缩略图448×448。编码q90/q82，缩略图沿现有烧色矩阵只处理RGB，保留每像素Alpha，完全透明像素不调色。旧八件备份originals-before-transparent/。art-mapping仅本4id revision，asset-manifest仅新增本8项来源/哈希及count；写入时复用最新清单338项，追加后346项，其他会话内容保留。

遵老板禁测令未测试/资产门/workflow verify/实页/build/提交，无新服务；游戏加载/战斗/CI未核。HEAD沿本会话有效425d03920e，远端未刷新。import-images.py与register-assets.cjs记录编码/登记动作，不调用测试或审计。
