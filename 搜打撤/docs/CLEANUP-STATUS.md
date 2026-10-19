# 清理后的文件与交付状态

本页维护2026-10-19这几批清理后的当前入口。历史报告中的文件路径、大小与“保留原稿/保留旧包”只描述报告当时，不代表文件现在仍在；具体删除授权、原始SHA与执行结果以对应回执为准。

## 当前保留交付包

本次整理的六份便携包中，仅保留本地资源修复版：`.tmp/exe-stability-1018/delivery/搜打撤-代号7-资源修复版-20261018.exe`，326036949字节，SHA256 `395b54650f7b724a62b79e2d10908c3c286defb54ac84ab4bf84da341b05fe0c`。该包不随Git分发；同目录的完整`win-unpacked/`保留，其余五份便携EXE已删除。

该包对应2026-10-18源码时点，不包含之后的游戏改动。网页版读取当前Vite工作区。旧EXE已不再提供本地下载；如需其他版本，应从相应历史源码和配置重新构建，不把当前保留包当作旧包的逐字节替代。未盘点的其他目录不由本页推断为已清理。

## 已执行批次

| 清理内容 | 当前状态与恢复入口 |
| --- | --- |
| 195旧资源、3旧音频实现及3专测、2旧基地CSS | 203文件已删除，运行映射、资源登记、缩略索引与相应契约已同步；精确路径和原SHA见[清单](evidence/2026-10-19-unused-cleanup/DELETE-LIST.md)，结果见[执行回执](evidence/2026-10-19-unused-cleanup/deletion-receipt.json) |
| 无失败战斗动画试作 | 已恢复上一版；`frames/wu/rig-v1/`与`art-source/characters/wu-battle-rig-20261019/`两目录220文件已删除；原制作会话已归档，见[回退记录](evidence/2026-10-19-wu-animation-revert/README.md)及[目录删除回执](evidence/2026-10-19-wu-animation-revert/deletion-completed.json) |
| 旧EXE解包副本与依赖缓存 | 批准的10目录20230文件已删除，约5.25GB；源码快照、原件、日志、工具和当前任务保留，见[精确目录](evidence/2026-10-19-temp-cleanup/DELETE-LIST.md)及[执行回执](evidence/2026-10-19-temp-cleanup/deletion-receipt.json) |
| 其余五份旧便携EXE | 已删除约1.48GB，仅保留上述资源修复包；精确路径与指纹见[交付包回执](evidence/2026-10-19-old-delivery-cleanup/receipt.json) |

旧卡图由`game/data/art-mapping.json`的现行覆盖映射解析到保留的定稿图；人物战斗序列以各角色`sprite-v1/animations.json`为准。退役图片不再能通过dev地址访问。需要恢复已删除素材时先查原始指纹与来源；清理回执提供来源和历史状态，不等于保留了一份可恢复的原文件。

## 阅读历史记录

历史验收结果和原始清单保留其时点含义。相关报告入口已补清理提示，原始快照、归档原文与有哈希契约的文件不改写。扫描中发现的其他历史缺件、旧路径或工具示例不因本轮清理自动恢复；当前使用说明从[文档导航](README.md)、[项目状态](STATUS.md)和对应源码进入。
