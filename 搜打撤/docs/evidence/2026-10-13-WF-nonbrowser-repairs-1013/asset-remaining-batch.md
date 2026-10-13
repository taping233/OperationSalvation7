# 素材清单：透明缩略图余项

2026-10-13。修订前全树审计为 356 errors、623 未变历史 warnings，其中新增未登记 276、bytes-mismatch 40、sha256-mismatch 40。针对每个指纹不符条目，逐项核对清单原 SHA256 = `docs/evidence/2026-10-11-studio-alpha-repair/assets.json` 的 beforeSHA256，当前文件 SHA256 = 同记录的 afterSHA256，并读取当前文件实际 bytes；40 项全部满足，无跳过。该 [修复记录](../2026-10-11-studio-alpha-repair/README.md)说明了透明通道修复范围与处理方式。

本批仅修改 `game/assets/asset-manifest.json` 的 40 条 bytes、sha256、source，source 统一指向上述 `assets.json`，原 license 不变。40 条原登记来源均为 `docs/evidence/2026-10-05-WF-web-5200-1005/manifest-backfill-2026-10-05.json`。其中 `thumbs/cards/` 31 条、`thumbs/scenes/` 9 条；逐条路径、修改前后 bytes/SHA256、原来源见 [核对表](asset-remaining-40.json)。素材文件及未登记项未动。

修订后 `npm run assets:audit -- --check` 退出 1：276 errors、623 未变历史 warnings。新增阻断全为未登记 276；bytes-mismatch 与 sha256-mismatch 均为 0。全树另有历史 unlisted 586、ghost 33、license-pending 4。针对本批 40 路径的 `auditAssets` 无 issue，检查命令退出 0；`git diff --check -- game/assets/asset-manifest.json` 退出 0。
