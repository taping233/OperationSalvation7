# 无：修腿版四动作候选帧

基于本聊天提供的精致立绘重绘四组动画，各六张关键帧。待机按老板追加要求，仅轻微呼吸与双手细小摆动。当前是可播放候选；内置浏览器的棋盘背景显示人物外大部分区域透明，没有生成缩略图中显示的大片灰雾。透明通道统计仍有低透明残留，尚未做最终边缘精修；未替换游戏现有帧。

| 动作 | 关键帧 | 一次时长 | 播放方式 |
| --- | --- | --- | --- |
| 待机 | 6 | 1560ms | 循环 |
| 攻击 | 6 | 600ms | 蓄力、斩击、收势，结束返回待机 |
| 受击 | 6 | 400ms | 后仰、稳住、恢复，结束返回待机 |
| 死亡 | 6 | 880ms | 下沉、跪撑、侧倒、躺倒，保持最后一帧 |

每张导出帧均为576×560。`idle/`、`attack/`、`hurt/`、`death/` 内有逐帧 PNG、无损 WebP、`sprite.json` 和动画 WebP 预览。`index.html` 在项目现有 Vite 服务上访问：`http://127.0.0.1:5200/art-source/characters/wu-slim-sprites-20261010/index.html`。

四张 `*-source.png` 保留生成器原始输出。`pack_frames.py` 仅裁格、扩展透明画布和导出，不用平移或变形伪造动作；第四攻击帧保留跨格剑尖，第五攻击帧排除前一格剑尖，受击上排额外保留16像素鞋底。所有非待机动作首帧直接复用待机首帧；攻击和受击末帧也复用它，PNG字节一致。关键姿势之间未自动生成补间，快速动作仍需要审阅节奏与尺寸稳定性。

`validation.json` 记录尺寸、透明像素与端点一致性。`receipt.json` 记录相对路径、大小和SHA256。超过1MB的本地产物列入本目录 `.gitignore`，获取方式为本次内置 imagegen 生成后复制、或执行 `pack_frames.py` 重导出；未提交。

使用内置 imagegen，选用提示词见 `requests.json`。待机初稿 `idle-draft-source.png` 保留作对照，不参与当前播放。被弃用的带文字攻击示意图不作为帧素材。

参考原有 `wu-idle-sprite-20261009/v2`、`wu-attack-sprite-20261009/v3`、`wu-hurt-sprite-20261009`、`wu-death-sprite-20261009` 的动作与端点衔接。网络参考 [Spineboy 官方示例](https://esotericsoftware.com/spine-examples-spineboy) 的脚部固定与上身独立运动；[游戏动画原则文章](https://www.gamedeveloper.com/production/the-12-principles-of-animation-in-video-games)的预备动作与惯性节奏。只借鉴动作方法，未下载或复用其角色素材。
