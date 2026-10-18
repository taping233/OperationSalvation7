# 短音效文件采样化：证据重建

重建日期：**2026-10-18**。原 README、逐事件 mapping 与历史测试日志缺失；本页从现存源码、清单和收据恢复可核实内容，不补写历史验收或耳听结论。

## 可核实来源

- [inventory.json](inventory.json)保留旧合成事件、旧 jsfxr 事件、停用模块和106个映射事件名。
- [抽牌替换前 catalog](../2026-10-17-f4ngy-draw/before/sound.samples.catalog.js)含完整106事件文件/增益/分组配置；其 SHA256 `e06c50a41cbc78268ddef215725b40aab740e70dbc3e2129610e5398ca475eb4`与[抽牌收据](../2026-10-17-f4ngy-draw/receipt.json)的 `before_catalog_sha256` 一致。
- [mapping.json](mapping.json)由上述留存 catalog 的 `SAMPLE_CUES` 逐项导出，事件名与 inventory 完全一致。它是抽牌替换前快照的重建映射；当前运行又替换了抽牌1事件、实录 Foley 9事件、安全格2事件，因此不能将它当作当前映射。
- 当前配置以[运行 catalog](../../../game/src/audio/sound.samples.catalog.js)为准；[采样播放器](../../../game/src/audio/sound.samples.player.js)只播放已解码文件，[音频入口](../../../game/src/audio/sound.js)接入该播放器，未导入旧合成/声景/界面采样模块。

## 本次重建复核

`node docs/evidence/2026-10-17-sample-only-sfx/rebuild-record.mjs`校验留存快照指纹、106事件名、12个后续变更的合并结果，以及9件后续音频运行文件的收据指纹；结果见[verification-2026-10-18.json](verification-2026-10-18.json)。脚本只写本目录的重建映射和复核记录。

2026-10-18运行以下现有定向测试，**4文件、125项通过**，机器报告见[reconstructed-tests-2026-10-18.json](reconstructed-tests-2026-10-18.json)：

```powershell
node node_modules/vitest/vitest.mjs run tests/sound-sample-only.test.js tests/sound-f4ngy-draw.test.js tests/sound-real-foley.test.js tests/sound-safe-slot-foley.test.js --maxWorkers=1 --minWorkers=1
```

其中采样播放器116项覆盖106事件播放、失败静默、挂起/迟到不补播、声部上限、节点释放、运行链无合成和文件存在；另外三组各3项核对抽牌、实录 Foley 和安全格接入。

## 证据缺口

原试听片段、历史完整测试输出、最初生成 mapping 的原始报告未找回。本次测试使用替身 AudioContext，文件指纹核对也不能代替真实浏览器混音、解码或人工听感验收；本次未耳听。
