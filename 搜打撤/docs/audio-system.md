# 音频系统说明

`game/src/sound.js` 是 Vite 版唯一的音频入口，公开 `SDT.Sound` 接口保持兼容：`sfx(name)` 播放短音效，`music(mode)` 切换标题/探索音乐，`setMuted`、`setMusicMuted`、`setSfxMuted` 与两个音量设置控制独立开关。

首次指针或键盘输入才会调用 `kick()` 解锁 AudioContext 并启动已选择的 BGM；静音、音乐关闭和音效关闭都在播放前拦截。标题曲和探索曲各自只保留一个 Howl 实例，切换时旧曲 280ms 淡出，新曲 420ms 淡入，避免叠播。战斗通过 `setDucked(true)` 将音乐降到 45%，离战恢复。

短音效优先使用 `assets/sfx/battle` 与 Kenney 采样池，按事件随机取样并做轻微变速；解码失败时回退 WebAudio 合成。所有合成音进 SFX 增益和 Master 软限幅器，Master 压缩阈值为 -6dB、比例 12:1，为连击和骰子多段声音留出峰值余量。点击、悬停和场景切换分别有 28/55/110ms 节流，避免 DOM 委托在高频 pointer 事件下堆叠声音。
# 冬境声景

默认音乐来源是“冬境声景”（可在设置切换为“原有曲目”）。声景由 sound.scape.js 生成：标题/基地为疏朗冰晶和弦，board 为低通风噪与稀疏钟音脉冲，battle 为低频克制节拍和紧张持续音。它随 music(mode) 交叉淡入淡出，节点只创建一次并在销毁时统一 stop/disconnect；页面隐藏时自动暂停增益，重新显示后恢复当前场景。声景总音量固定较低并复用音乐音量设置，不影响 SFX 与静音开关。
