# 素材清单定向修复：充能火山

2026-10-13，针对当前共享工作树审计。修订前 `npm run assets:audit -- --check` 退出 1：400 errors、623 unchanged historical warnings；全树问题为 unlisted 862、bytes-mismatch 62、sha256-mismatch 62、ghost 33、license-pending 4。400 个阻断项按类型为未登记 276、字节数不符 62、SHA256 不符 62。

本批只更正 `game/assets/asset-manifest.json` 中 `cards/hero-volcano.webp` 和 `thumbs/cards/hero-volcano.webp` 两条。两文件当前 SHA256 和字节数与 `docs/evidence/2026-10-10-volcano-builtin/receipt.json` 的 outputs 完全一致；该 receipt 还保存了前一版登记值及对应的 manifest_patches。故把两条的 bytes、sha256、source 调整为该 receipt 的 after 值；素材文件没有改动。本批不处理其他在途或候选文件，也不重置原有清单差异。

修订后 `npm run assets:audit -- --check` 退出 1：396 errors、623 unchanged historical warnings；全树问题为 unlisted 862、bytes-mismatch 60、sha256-mismatch 60、ghost 33、license-pending 4。剩余阻断项按类型为未登记 276、字节数不符 60、SHA256 不符 60。针对两条路径的 `auditAssets` 检查无 issue，检查命令退出 0；`git diff --check -- game/assets/asset-manifest.json` 退出 0。

剩余未登记项包含已跟踪且被 CSS 引用的字体、未跟踪的基地与场景版本、角色动画 JSON 等，需逐批核对来源和现行接入。剩余 60 组字节数与哈希不符集中于缩略图；不能仅凭当前文件指纹覆盖原登记的来源版本。
