# 明日方舟音效文件参考

- Friday / Codex 当前会话；老板授权检查 Steam 2677984729，不便取得时自行寻找方舟音效文件。
- 属地：仅本目录；共享 REGISTRY 正由其他流程会话编辑，依根 AGENTS“共享记录占用则另记”在本目录留账。无工作树/服务/端口。
- 工作区基线 fd38468；不构建、不提交、不改游戏、不安装或订阅 Steam 资源包。
- Steam 页面经 Codex 内置浏览器核对：该包用于 Terraria 的部分音效替换，页面提供订阅入口，无普通文件下载链接；作者在 2025-12-07 留言称原文件遗失。未声称工坊包本体不可下载。
- 可读取的替代源：https://github.com/PseudoMon/arknights-audio ，分支 global-server-voices；源作者注明是游戏音频，部分目录保留自 Aceship，非最新版本完整库。
- 已读取目录：battle/b_ui（15 项）、battle/b_char（46 项）、avg（465 项）。本轮仅收集与试听方向相关的少量文件，不整库下载。
- 素材用途：原始声音参考，保留源文件名、URL、Git blob SHA 与 SHA-256；与原创样音分开存放。原游戏音频不作为本项目已获授权素材，也未接入运行素材目录。
- 参考标签仅按目录和文件名初筛，不宣称已经核对其实际游戏触发时点；未人工试听。
- 状态：收集完成、完成未提交；本目录编辑占用释放。10 个原文件共 2,528,136 字节，RIFF/WAVE 头、原始长度、完整解码与有限数值检查通过；详细来源和校验值见 sources-and-checks.json。
- 产物：10 个原文件、arknights-reference-10.zip（仅打包原 WAV）、22.441 秒 00-reference-preview.mp3。合集仅调整试听峰值和首尾淡化，各原文件字节未变；合集转码与解码通过。
- 试听顺序：b_ui_whoosh、b_ui_mark、b_ui_alarmenter、b_ui_rewardappear、b_ui_getcast、b_char_atkboost、b_char_dead、d_avg_button、d_avg_shufflecards、d_gen_transmissionget。
- 限制：这些是源仓库发布的游戏音频，具体原版客户端比对与实际触发场景未核验；未声称取自 Steam 包或来自官方授权音效库。未接入游戏，未订阅或安装资源包。
