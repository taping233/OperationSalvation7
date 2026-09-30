# C · 动作材质

2026-09-30；仅改本证据目录与 `game/assets/sfx/alternatives/cc0-action/`。来源以作者自发布的 CC0 音效与有机录音为主；不使用旧程序合成声，不生成噪声、振荡器或统一附加声。全部十个一遍式 OGG 与 `library.json` 已交主会话接入试听页，音频冻结；未提交、未启动服务、未修改游戏调用。

## 可试听输出

- [试听库配置](../../../../game/assets/sfx/alternatives/cc0-action/library.json)
- [处理参数、源文件哈希与十个技术检查](processing-and-checks.json)
- [原包下载地址、哈希与目录](source-inventory.json)
- [独立铁门录音与完整许可证的下载记录](extra-source-inventory.json)
- [随音频保留的来源与许可](../../../../game/assets/sfx/alternatives/cc0-action/LICENSES.txt)

| ID | 现成材料与动作安排 | 秒 |
| --- | --- | ---: |
| click | 剪刀闭合短扣 | 0.165 |
| confirm | 金属手铐锁扣落定 | 0.487 |
| card | 真实书页滑动 | 0.747 |
| attackSlash | 塑料管挥动空气 + 双刀滑切 | 0.530 |
| parry | 双刀硬碰，保留自然短响 | 0.427 |
| shieldBreak | 金属冲击 + 玻璃裂散 | 0.422 |
| heal | 拔药瓶塞 + 药液流动 + 水滴收尾 | 1.022 |
| eventEnter | 抽屉滑动与木质摩擦 | 1.135 |
| chestBurst | 转锁 + 箱体落扣 + 金币散落 | 1.325 |
| bossReveal | 铁门摩擦展开 + 金属锤击落定 | 1.415 |

动作映射是本版的设计选择。首脑采用工业金属重量、治疗采用药瓶，不宣称是参考游戏中的真实触发或素材。

## 核验过的使用来源

| 作者 / 包 | 使用关系 | 发布页面与许可证原文证据 |
| --- | --- | --- |
| StarNinjas — 20 Sword Sound Effects (Attacks and Clashes) | attackSlash、parry；作者称以两把刀互相运动后编辑 | [作者发布页](https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes)；[下载时原始 HTML](starninjas-swords-source.html)，许可证栏为 CC0 |
| Vehicle — Fantasy Sound Effects (Tinysized SFX) | 剪刀、锁扣、纸页、挥动、药瓶、水、抽屉、锁盒、金币、锤击 | [作者发布页](https://opengameart.org/content/fantasy-sound-effects-tinysized-sfx)；[原始 HTML](vehicle-tinysized-source.html)；[原包 readme](materials/vehicle-tinysized/readme.txt)，明确 Creative Commons Zero |
| rubberduck — 75 CC0 breaking / falling / hit sfx | shieldBreak 的金属冲击和玻璃破碎 | [作者发布页](https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx)；[原始 HTML](rubberduck-breaks-source.html)，许可证栏为 CC0 |
| DenisChardonnet / BigSoundBank — Grinding Metal Gate #1，编号 303 | bossReveal 的铁门摩擦；工作室立体声录音 | [音频发布页](https://bigsoundbank.com/grinding-metal-gate-1-s0303.html)；[原始 HTML](bigsoundbank-metal-gate-source.html)；[许可页面](https://bigsoundbank.com/licenses.html)及[许可原始 HTML](bigsoundbank-license.html)，明确 CC0 / 允许编辑与再分发 |

四个实际使用来源均在发布页面明确使用 CC0；自愿保留作者和页面，CC0 不要求署名。正式法律文本来自 [Creative Commons CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en)，下载时的[完整法律文本 HTML](CC0-1.0-legalcode.html)在此保留。

`80 CC0 RPG SFX` 也已核验并下载，属于未选用的候选包；其[原发布页](https://opengameart.org/content/80-cc0-rpg-sfx)与[原始 HTML](rubberduck-rpg-source.html)保留，最终十个 OGG 没有使用该包文件。

## 改动与技术验证边界

`render_c.py` 只执行本地编写的素材编辑：按相对峰值 0.004 裁起尾并保留 8 ms 起音余量与 35 ms 尾部；重采样到 48 kHz；35 Hz 二阶高通去录音低频；2 ms 起音 / 通常 18 ms 收尾淡化；分层延时和峰值配平。首脑铁门用 0.88 倍速度、5.8 kHz 低通、45 ms 收尾；锤击用 0.94 倍速度、7.2 kHz 低通，其余素材不改播放速度。每层裁剪与增益、最终混音增益都在 JSON 留证。

原始 StarNinjas 两个选用 OGG 的浮点解码峰值大于 1；本次保留浮点解码数据后缩放，不先做整数截断。输出用现有 ffmpeg 的 libvorbis quality 5；各文件解码峰值约 -14.2 至 -7.3 dBFS，有编码余量。

十个输出全部通过 OGG/Vorbis 解码、48 kHz、双声道、有限样本、正时长、帧数一致、峰值小于 0.8 与最后 10 ms 静音检查。工具与环境：现有 `D:\Python\Python38\python.exe`、numpy 1.24.4 / scipy 1.10.1 / soundfile 0.13.1 与现有 ffmpeg；未安装依赖，没有执行下载包里的代码。

没有人工试听或浏览器验收；当前通过项只证明编码与数字信号条件。素材适配、动作是否易辨识和相对响度仍待真实试听。主会话负责同页集成与当前窗口的内置浏览器检查。
