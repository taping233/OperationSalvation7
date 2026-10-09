# 音频系统说明

`game/src/audio/sound.js` 是 Vite 版音频入口，公开 `SDT.Sound` 接口：`sfx(name[, opts])` 播放短音效，`music(mode)` 切换标题、探索和战斗音乐，音量及静音设置独立控制。首次输入解锁 AudioContext 并启动音乐。

原创场景配乐由 `SceneMusicPlayer` 按需加载独立 Howl 实例，只使用四首：初版《霜窗回声》、初版《灰线行军》、电子战斗《冷线交锋》、商店《灯下交易》。首页、基地及成功/失败结算复用标题曲；探索、营火、事件、祭坛、撤离复用探索曲；普通战斗与全部首脑共用战斗曲；商店使用商店曲。下一曲加载期间保留旧曲；就绪后旧曲淡出500ms、新曲淡入650ms，带代次保护并释放离场曲目。关闭音乐和页面隐藏立即静音/暂停；音量滑条与战斗 ducking（45%）同步当前曲目。

曲目映射由 `sound.music.catalog.js` 的 `MUSIC_TRACKS` 维护，文件在 `game/assets/music-demo/`；临时卡牌/背包浮层保留节点所属曲目，离开节点恢复模式曲。独立试听页为 `game/music-demo.html`，与游戏使用同一份四首映射。当前来源与运行文件指纹见[四首接入记录](evidence/2026-10-09-WF-four-bgm-install/README.md)。老板要求旧音频文件仅停用，历史文件和草稿仍保留。

短音效优先使用 `assets/sfx/battle` 采样池，缺少素材或解码未完成时使用 WebAudio 合成音。新战斗 cue：`cardSelect`、`discard`、`burn`、`kill`、`danger`、`energyUp`、`energyDown`、`shieldUp`、`shieldBreak`、`phase`、`rarePlay`、`curseEnd`。其中 `phase` 支持 `{ side: 'foe'|'self' }`；选牌、弃牌、护盾增加和击杀使用新增 CC0 采样，其余使用短合成音。护盾增加采样以较低增益播放，截短至 420ms 并淡出；护盾增加 cue 有 220ms 冷却。

高频操作和装饰音按事件冷却；45ms 内超过四个声音时，后续低优先级操作声会被抑制，战斗结果和危险提示仍可播放。合成音与采样共享 SFX 总线和 Master 软限幅器（阈值 -6dB、比例 12:1）。采样峰值归一化至约 95%，各 cue 再按独立增益混合。

音乐来源固定为这四首文件配乐，设置保留音乐开关和音量；旧存档中的冬境声景来源偏好不再启用。`setMusicSource` 兼容接口只选择当前文件配乐。冬境声景代码和历史音乐文件保留，不作为现行BGM播放。
