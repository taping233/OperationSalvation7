# 职业卡十六张实装

已按老板“十六张全部实装”的明确指示，使用 request.json 列出的最终源图替换 16 张运行卡图及 16 张缩略图。使用 game-card-art-fast 的现有 import_cards.py 完成旧图备份、源 PNG 保存、WebP 编码、448 方形缩略图及既有烧色。

receipt.json 记录每张生成源、PNG 副本、旧卡图备份、原图/缩略图路径与 SHA256、素材清单局部更新和版本变化。game/data/art-mapping.json 的本批 16 个 cardArtRevisions 更新为 career-final-20261023；game/assets/asset-manifest.json 仅更新对应 32 条元数据，count 保持 1610。奥术残卷沿用其既有 cards/studio-expanded/tt7-arcanescroll.webp 覆盖路径。

版本选择：本轮五张采用 round3 最终修订，其他十一张沿用 round2 选定稿。风暴火球保持其上一轮候选，不追加修改。原 mapping 与 manifest 快照在本目录 *.before.json，逐张旧图在项目内 .tmp/imagegen/install-16-20261023/，准确路径与哈希见 receipt.json。

只完成本批素材接入和元数据同步；按老板“不用验证，做完就行”，未追加核验，未运行测试、资产审计、实页验收、构建或提交。反馈网页按老板指示保持原状。大于1MB或生成PNG等二进制只保留本地，提交时依项目规则排除，回执保留获取方式与哈希。
