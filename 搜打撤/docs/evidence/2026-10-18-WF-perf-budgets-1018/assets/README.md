# 旧宝箱帧发布与真实预热审计

结论：本轮不实施 86 帧排除。它能减少 61.50 MiB 发布字节，但当前游戏启动不调用全量清单预热，未证明普通游玩请求、解码或缓存收益。按老板本轮优先游玩体验的指示，保留全部生产代码、测试、原素材和预算。

只读复用上次 EXE 冻结副本 `.tmp/page-perf-1018/exe-build/project`，没有重建、浏览器或联网。现行宝箱两份选择器与既有审核指纹一致。素材图片与副本一致；6 个文本元数据的原字节差异均仅为 CRLF/LF。

## 发布字节方案（未实施）

[asset-audit.json](asset-audit.json) 保存每个精确路径、字节数、SHA256、源码引用和现有排除情况。

| 项目 | 核对结果 |
| --- | --- |
| 既有排除 | 195 项全部生效，产物零残留；不能重复计入新增收益 |
| 遗漏原分辨率 rig | 86 张；`large-rig-v1` 14 张，其余四组各 18 张 |
| 可减少发布字节 | 64,482,788 B（61.50 MiB），保留源文件与现行 safe/supply 动画 |
| 包体预测 | 212,695,157 → 148,212,369 B（141.35 MiB），仍高于 112 MiB 上限 |
| 重复字节预测 | 10,419,979 → 134,099 B；减少 10,285,880 B |
| 人物帧库 | 39 张未使用旧帧已排除；剩余 263 张发布图片均由现行 catalog 使用，另 2 个必要键已有同字节别名 |

若以后重新授权发布体积优化，最小方案为：在 `runtime-asset-redundancy-review.mjs` 添加精确 86 项；在 `runtime-asset-redundancy.mjs` 将退休 rig 目录匹配精确扩展至原分辨率与 640 两套。保留选择器指纹、未知动态来源恢复、完整 Rollup 引用后验及前后清单一致性检查，不使用目录通配删除或素材压缩。当前没有修改这两份文件。

## 游玩收益核实

[runtime-preload-check.json](runtime-preload-check.json) 复用交付构建的实际函数与 JS chunk，运行受控 VM；只替换 fetch、Image 和调度器，无真实网络或原生内存测量。

- 上次生成的 `art-manifest.js` 确含 86 张旧帧，清单理论可由 1023 降至 937 项。
- 编译产物 AST 只有两条分支的 `prefetchBatched` 调用，全量 `collectManifestAssets`、`collectThumbnailAssets`、`warmBatched` 调用均为零。
- `game/src/game.boot.js:806` 从 6 个常见场景构造启动计划，加现行通用卡框共 19 个唯一 URL。`core/art-preload-plan.js` 没有并入全量清单。
- 受控运行真实启动计划及 `prefetchBatched` 函数，排除前后均为 19 次 fetch、峰值 4 并发；旧 rig 请求均为 0，Image 构造与 decode 调用均为 0。该结论限定为启动预取路径，不代替浏览器整局测量。
- 86 张旧帧的文件尺寸合计 135,236,376 像素，若逐张解码为 RGBA8 是 540,945,504 B。当前路径未调度这些解码；这是潜在像素口径，不能写成真实 RSS、显存或本次节省。

受控脚本均退出 0，原文留存：[audit-runtime-assets.mjs.txt](audit-runtime-assets.mjs.txt)、[check-runtime-preload.mjs.txt](check-runtime-preload.mjs.txt)。没有修改共享生产/测试文件、预算或 index，未读取共享工作区在途事件源码。

上述资源发布审计收官后，主会话另行授权了与游玩切换相关的图片生命周期修复，独立记录在 [personnel-preview-lifecycle.md](personnel-preview-lifecycle.md)；没有实施旧宝箱帧排除。
