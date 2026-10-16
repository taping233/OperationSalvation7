# 无半身：mivt 0.9 / NAI 4.5

2026-10-16，按老板要求仅将上一张画师 `0.9::quasarcake::` 换为 `0.9::mivt::`，共享默认未改。生成前完整payload与上一张作替换后相等断言，保证其他提示词和参数一致。

模型nai-diffusion-4-5-full，832×1216，种子1771065016；CFG5.5、28步、Euler Ancestral、Karras、Rescale0、Variety+关闭。HTTP200，已实看：半身与主要配饰存在，额外出现双角、红色瞳孔与高领内搭。审美验收待老板反馈，未接入游戏。

原图在仓库根 `.tmp/nai/wu-half-mivt45-20261016.png`，超过1MB不入Git；完整请求、相对路径和SHA256见request.json。获取方式为本目录generate.py通过nai_gen/nai_guard生成，复现须使用新候选路径。无服务、未提交。
