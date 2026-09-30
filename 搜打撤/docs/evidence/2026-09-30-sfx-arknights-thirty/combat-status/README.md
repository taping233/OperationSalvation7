# 战斗状态十项：A2 轻改试听候选

2026-09-30，Git 基线 `fd38468`。本切片只写本证据目录与 `game/assets/sfx/alternatives/arknights-expansion/combat-status/`；不接入游戏、不启服、不 build、不提交。父代理管理登记与内置浏览器验收。

十个动作各用一个不同的现成方舟素材主体；无合成声叠层、混响或旧 A2 十源复用。`cues.json` 是试听页可读取的动作清单；`sources/` 保存下载原文件；`source-probe.json`、`processing-checks.json` 保存 SHA-256、解码、原声长度、裁切和处理参数。`make_combat_status.py` 复用父目录 `process_common.py`。

| 动作 | 原素材 | 目标峰值 dBFS |
| --- | --- | --- |
| 受伤 hurt | b_char_darkharm.wav | -10 |
| 击杀 kill | b_char_dead.wav | -9.5 |
| 护盾增加 shieldUp | b_char_addshield.wav | -11.5 |
| 破甲 armorBreak | b_char_rockexplo.wav | -10 |
| 能量增加 energyUp | b_char_battery.wav | -11.5 |
| 能量消耗 energyDown | b_char_energyharm.wav | -12 |
| 增益获得 buffUp | b_char_atkboost.wav | -11.5 |
| 增益到期 buffDown | b_char_boostclose.wav | -12 |
| 诅咒施加 curse | b_char_cursedoll.wav | -11 |
| 诅咒解除 curseEnd | b_char_emp_2.wav | -12 |

base 是相同原声片段经边缘淡化、25 Hz / 17.5 kHz 极轻边界滤波与动作层级峰值校准后的对照；adjusted 在同片段基础上仅改 -0.5 至 +0.25 半音、1.02–1.05 倍 tempo、高频轻收 0.5–1 dB 与 35–45 ms 尾音。base 不冒称字节原样原声，下载文件与逐项 URL 保留可回查。

来源：[PseudoMon/arknights-audio 的 battle/b_char](https://github.com/PseudoMon/arknights-audio/tree/global-server-voices/battle/b_char)，分支 `global-server-voices`。仓库 [README](https://github.com/PseudoMon/arknights-audio/blob/global-server-voices/README.md) 自述这些是方舟全球版本音频，仓库用于教育目的；未核验项目再分发或商业使用授权，轻调不改变权利归属。

原角色、原游戏实际触发点与语义映射未核验；动作标签和短描述是本项目候选定位，不视作方舟官方触发说明。没有完成人工试听；音色适配与听感质量交由父代理试听页及老板判断。技术通过仅代表本批文件可解码、数值有效、无超限峰值；浏览器播放证据由父代理记录。

已完成技术产物：10 个独立 SHA-256 原素材、20 个 OGG。adjusted 时长 0.876–3.237 秒，4 倍过采样真峰值 -12.212 至 -9.508 dBFS；20 项解码与有限值/峰值检查通过。诅咒施加 2.888 秒、诅咒解除 3.237 秒保留原主体尾音，是否适合频繁触发仍待试听；未为缩短指标截断主体。`frozen-files.json` 记录交接时自有全部产物的 SHA-256，后续修改应更新证据。
