# 冷感科技UI：三个候选样音（2026-10-18）

老板要求先找点击、确认、奖励三个样音，风格靠近二次元战术游戏的冷感、轻量科技反馈，避免再次整套替换。此次只提供候选，不改游戏、catalog、清单、音量设置或现有试听页。

来源为 [UI SFX](https://uisfx.com/) 的同系列 Sci-fi 预渲染音频，作者 Yuki Capital / romainsimon，源包版本0.4.0。作者将其描述为干净的全息提示和克制的数字余光。该系列为确定性声音设计程序预先渲染的文件；本轮直接从其在线仓库下载OGG，没有运行或安装来源代码，也没有在游戏中启用合成。

- `01-click.mp3`：press，来源标注214ms，按作者默认增益0.20试听。
- `02-confirm.mp3`：success，来源标注617ms，默认增益0.23。
- `03-reward.mp3`：reward，来源标注534ms，默认增益0.22。

保留原音色和尾音，仅将作者默认增益写入MP3试听副本，避免聊天内播放器满幅播放。原件仍在sources，源文件与试听副本SHA256、下载URL和转换说明见receipt.json。音频不进Git。

音频许可为CC0 1.0，原文在 `sources/uisfx-LICENSE-AUDIO.txt`。网上原始下载地址、时长/增益来自保留的官方manifest。本批未做测试、浏览器验证或人工听感确认；不声称与明日方舟声音相同，也不声称老板已认可。声效是否合适由老板试听决定。

R4orce Sci-Fi UI Free Essential Pack为初筛候选，但下载接口返回QuarantineLightbox，未绕过、未下载或使用其音频；GitHub目录API403后改读公开raw文件，无配置/代理变更。
