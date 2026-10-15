# 旧验收副本与音乐中间文件清理

老板批准的两类清理已完成：四份固定旧验收副本已移除，18份中间WAV已删除；脚本、报告、音乐工程、音源、最终混音和母带已保留。未启服或终止任何进程，未修改主线游戏源码，未暂存或提交Git。

## 范围与结果

以下路径相对 `D:/素材/代号柒/搜打撤`：

- `.tmp/zzz-base-observe-1012/`
- `.tmp/WF-battle-ui-runtime/`
- `.tmp/selection-map-observe-1011/`
- `.tmp/selection-map-repair-1012/`
- `docs/evidence/2026-10-12-WF-battle-full-loop/` 与 `2026-10-12-WF-battle-full-loop-v2/` 内，固定18个 `*-loop-native.wav`、`*-two-cycles.wav`。

原四份副本共10013个文件。对源码、脚本、配置和报告全部另存；媒体只有在与主线同路径素材的SHA256逐字相同时才按重复副本处理，否则也另存。保留包按SHA256去重保存792件、68133239字节（约64.98MiB）。另有一条与主线音乐共用的只读硬链接，移至保留包而不清除共享只读属性，哈希与属性核对一致，见 [硬链接记录](moved-hardlinks.json)。

实际删除10030个文件、2245124274字节（约2.09GiB），另归档1条硬链接。旧目录内无未计划文件后，仅逐个删除已核对的文件和空目录，没有使用递归删除命令。所有最终绝对路径均核对在上述固定范围内。删除收据见 [deletion-receipt.json](deletion-receipt.json)。

## 保留与验证

5300个原位文件及792件另存文件、1条归档硬链接，删除后SHA256全部与删除前一致。包含两版音乐中除18份中间WAV外的全部文件、现行重复素材原件，以及 `.tmp/music-workstation/` 和 `.tmp/salamander-title-1009/` 的完整内容。音乐工程、音源、最终OGG/MP3与v2 WAV母带仍在原位。

旧服务配置端口5335/5337/5338/5346在删除前后均无TCP活动，历史服务PID37600不存在；未因历史PID或无主记录结束进程。见 [删除前服务状态](services-before.json)、[删除后状态](services-after.json)、[最终保留校验](verification.json)。

清理后整个 `D:/素材/代号柒` 按文件大小合计约8.09GiB，详见 [体积记录](project-size-after.json)。部分旧素材是硬链接，文件大小之和不等于可释放磁盘块；删除阶段D盘可用空间增加约1.87GiB，该计数发生在保留包提前另存之后，且同机其他会话仍可能写入。

原始逐文件清单与校验记录的路径、大小、SHA256及获取方式见 [收据索引](receipt-index.json)。大于1MB的清单和二进制保留包均由本目录 `.gitignore` 排除，实际内容保存在本机 `preserved/` 与 `.local.json`/`.local.jsonl` 文件中，不自动上传或提交。
