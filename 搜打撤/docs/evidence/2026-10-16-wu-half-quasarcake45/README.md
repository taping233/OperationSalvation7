# 无半身：quasarcake / NAI 4.5

2026-10-16，按老板要求删除共享画法的 kitchen 及 glass and ceramic 子句；同步现行说明。其余共享正负提示词、默认画师链与默认模型保留。

本张显式使用 `0.9::quasarcake::`、`nai-diffusion-4-5-full`，832×1216，种子1771065016；CFG5.5、28步、Euler Ancestral、Karras、Rescale0、Variety+关闭。沿上一张的身份槽、半身构图、光色与负面词。由于模型、画师链与通用画法同时变化，属于整体方案试图。

HTTP200，已实看：半身与主要头部配饰命中，背剑柄未呈现，增加高领内搭。老板审美验收待反馈，未接入游戏。原图位于仓库根 `.tmp/nai/wu-half-quasarcake45-20261016.png`，大于1MB不入Git；完整请求、相对路径与SHA256见request.json。获取方式为本目录generate.py通过现有nai_gen/nai_guard生成，复现使用新候选路径。

共享构建器离线断言、git diff --check及docs:check通过。无游戏源码改动、无服务、未提交。
