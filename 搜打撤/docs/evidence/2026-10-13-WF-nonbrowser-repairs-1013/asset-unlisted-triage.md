# 未登记素材分组与 `.gitignore` 审计边界

2026-10-13 修复前只读核对；`auditAssets` 当时为 276 errors（全部 `unlisted`）、623 未变历史 warnings。按 `git ls-files` 交叉核对，19 项已跟踪、257 项未跟踪。下表是修复前的相对 `game/assets/` 路径分组；“直接引用”仅统计 `game/src/`、`game/css/`、`game/data/`、`game/index.html` 中完整 `assets/<路径>` 字面量，动态拼接会漏计，不能用 0 推断未使用。随后 `.gitignore` 误报已修复，现行结果见 [修复记录](asset-gitignore-fix.md)。

| 分组 | 未登记 | 已跟踪 | 直接引用 | 当前判断 |
| --- | ---: | ---: | ---: | --- |
| `fonts/` | 4 | 4 | 4 | 稳定文件与现行 CSS 引用可证；获取来源/子集过程缺记录，暂不登记。精确候选见下文。 |
| `ui/ak/` | 12 | 12 | 11 | 已跟踪且多处 CSS 引用；项目内未找到对应来源/授权记录，仍需逐项核对。 |
| `ui/photo-studio/` | 20 | 3 | 20 | 3 个已跟踪 mount SVG 均有未提交修改，另 17 项未跟踪；属于待归属/收拢状态。 |
| `icons/base-v3/` | 17 | 0 | 0 | 未跟踪；`hub.visuals.js` 动态拼接部分 companion 路径，不能按字面量计数认定未使用。 |
| `portraits/frames/` | 2 | 0 | 2 | 动画 JSON 被引用但未跟踪，需连同人物动画属地核对。 |
| `scenes/chests/` | 181 | 0 | 90 | 大量逐帧路径在 `run/chests.js` 中引用，全部未跟踪；含 1 个 `.gitignore` 误报，其余需与宝箱属地核对现行帧和候选帧。 |
| `scenes/` 其他 | 36 | 0 | 13 | 基地、战斗、入口、地图节点、奖励、商店等版本并存；含下述 2 个 `.gitignore` 误报。 |
| `ui/settings-shutter-1011.webp` | 1 | 0 | 1 | 已引用但未跟踪，待来源与归属核对。 |
| `vendor/base-courtyard/` | 3 | 0 | 0 | 未跟踪，需查具体用途与来源。 |
| **合计** | **276** | **19** | **141** | 字面量引用数不是全部实际引用数。 |

最清晰的独立候选组为四个已跟踪、未改动、被 `game/css/base.css:40-43` 直接引用的字体：

| 路径 | bytes | SHA256 | 随附许可证 |
| --- | ---: | --- | --- |
| `fonts/oxanium-latin-500-normal.woff2` | 9040 | `8ad0e754c0e87a6f134d1e172377408bcbda29727a2bfe56e2f3fa976af1dc35` | `fonts/LICENSE-Oxanium-OFL.txt` |
| `fonts/oxanium-latin-700-normal.woff2` | 8776 | `19ac72d5a8b3b31316133df3dc8e5b47f93dfc4b85245b776dd6d70fc4b3504c` | 同上 |
| `fonts/rajdhani-latin-600-normal.woff2` | 15732 | `433a7007e4747a02a790167a6efa2625855f013970ba49b9b739a5d3db8b2601` | `fonts/LICENSE-Rajdhani-OFL.txt` |
| `fonts/rajdhani-latin-700-normal.woff2` | 15688 | `5b7e4a6f97163c2636724d4de90304fc895653dcfe64c67a7a22f26331ca5c5f` | 同上 |

许可证文本标示 SIL OFL 1.1，字体内 name 表版权与许可证对应。Git 引入提交 `a5c997ab` 将字体和许可证一同落库，但 `fonts/README.md` 没记录这两族字体的下载位置、版本或是否重做子集；不能用许可证或 Git 提交代替素材来源。其余分组尤其未跟踪的 257 项不能凭现存文件或引用一键转正。

## `.gitignore` 误报定位（修复前）

当前有 3 个未跟踪 `.gitignore` 被判为 `unlisted`：`scenes/battle/winter-transit-1011/.gitignore` 忽略 `far.webp`，`scenes/chests/large-rig-v1/.gitignore` 忽略第 14～17 帧，`scenes/shop/.gitignore` 忽略一张商店候选图。`scripts/asset-audit-lib.cjs:6` 的 `isDocument` 只排除 `.md`、`.txt`、`.gitkeep` 和清单；`walkAssets` 在第 30 行以此筛选，故第 84 行将这些 `.gitignore` 判成 `unlisted`。`docs/asset-audit-debt.md` 把排除对象解释为非运行资产，没有要求把 Git 控制文件登记为游戏素材；现有 `tests/asset-audit.test.js` 也未覆盖 `.gitignore`。这是非运行文件被纳入审计的边界误报。

最小修复点是 `scripts/asset-audit-lib.cjs:6`：让共享排除谓词同时排除 basename 恰为 `.gitignore` 的文件。`selectedAssetPaths` 也复用该谓词，定向审计会一致排除它。对应在 `tests/asset-audit.test.js` 的增量门 fixture 加一例：空清单下新建嵌套 `.gitignore` 和 `new.png`，确认只报 `new.png` 为未登记，且选中 `.gitignore` 不产生资产路径；其他扩展名仍按现有规则受审。该修复预计只消除上述 3 个阻断项，不会解决其余未登记素材。
