# A 方舟轻调版 · 十个动作

- Friday / Codex 子任务；2026-09-30；基线 HEAD `fd38468`。父会话负责共享登记、统一播放器与内置浏览器验收。
- 自有改动仅本证据目录及 `game/assets/sfx/alternatives/arknights/`；无服务、端口、构建或提交。
- 产物：10 个 48,000 Hz 双声道 Vorbis OGG、`library.json`、10 个处理后 24-bit WAV，以及 `00-A-arknights-ten.mp3` 顺序试听合集。文件已冻结交父会话。
- 保留现成录音的音色与动作主体。仅裁掉静音、剪取一段洗牌动作、1 阶 25 Hz 高通与 17.5 kHz 低通、2 ms / 8 ms 首尾淡化、按用途峰值配平；不变调、不叠层、不添加合成声或混响。准确裁切点与增益逐文件记录。

| ID | 来源文件 | 本版用途与证据范围 |
| --- | --- | --- |
| click | Cromemadnd `public/click.wav` | 仓库 README 明确写点击音来自游戏录制；`BaseButton` 的 onClick 播放该文件。 |
| confirm | misaka10843 `voice/button.wav` | 主界面复刻站按钮音，关闭提示 / 好友窗口等调用；作为确认候选，未核原版确认触发。 |
| card | `avg/d_avg_shufflecards.wav` | 截取 0.284646–1.034646 秒洗牌录音用于单次出牌。 |
| attackSlash | `player/p_atk/p_atk_blade_n.mp3` | 刀刃攻击目录素材。 |
| parry | `player/p_imp/p_imp_blackshield_n.mp3` | 盾牌命中目录素材映射格挡候选；未核具体角色或触发。 |
| shieldBreak | `avg/d_avg_glass_break.wav` | 玻璃破裂剧情素材映射屏障碎裂候选，未称原版破盾声。 |
| heal | `player/p_atk/p_atk_heal_n.mp3` | 治疗动作目录素材。 |
| eventEnter | `battle/b_ui/b_ui_whoosh.wav` | 界面过渡素材，仅映射事件进入。 |
| chestBurst | `battle/b_ui/b_ui_rewardappear.wav` | 奖励出现素材映射开箱反馈；没有新增爆炸声。 |
| bossReveal | `battle/b_ui/b_ui_alarmenter.wav` | 警报进入素材映射 Boss 预警候选，未核原版 Boss 登场触发。 |

来源与权利事实：[PseudoMon 音频仓库](https://github.com/PseudoMon/arknights-audio/tree/global-server-voices) 自述收录游戏音频并仅用于教育；[Cromemadnd 主界面复刻仓库](https://github.com/Cromemadnd/ArknightsUI-React-Template) 自述点击音来自游戏录制、版权归鹰角；[misaka10843 主界面复刻仓库](https://github.com/misaka10843/arknights-h5) 记载添加按钮点击音。代码的 MIT 许可不建立对原游戏音频的项目使用授权。本套明确是方舟素材 / 录音的轻调试听候选，未称原创或已获得项目使用授权。

- `new-source-metadata.json`：新取三个原文件的准确 URL、Git blob SHA、SHA-256 与按钮调用 / 来源说明行号。原文件保存在 `originals/`；其他七个直接复用此前参考目录原文件，未修改。
- `checks-and-processing.json`：十个来源、源 SHA-256、裁切与滤波 / 配平参数、输出 SHA-256、实际解码时长及合集定位。
- 验证：十个 OGG 均为 Vorbis / 48 kHz / 双声道，完整解码通过，数值有限，解码削波样本为 0；峰值范围 -14.08 至 -8.51 dBFS。合集 MP3 完整解码通过。
- 未完成项：未人工试听，未核原版客户端触发，浏览器播放与统一页面验收由父会话完成。
