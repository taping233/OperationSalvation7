# 四首确认BGM实装

老板确认当前四首试听并要求实装、只留四首。随后明确选择“保留文件，只停用”，故旧音频、草稿和历史制作证据保留，游戏现行音乐来源仅为四首文件配乐。

| 当前曲目 | 运行场景 | 运行文件 |
|---|---|---|
| 霜窗回声初版 | 首页、基地、成功/失败结算 | game/assets/music-demo/01-title-frostglass.ogg |
| 灰线行军初版 | 探索、营火、事件、祭坛、撤离等非战斗节点 | game/assets/music-demo/02-explore-ashline.ogg |
| 冷线交锋 | 普通战斗及全部首脑 | game/assets/music-demo/03-battle-coldfront.ogg |
| 灯下交易 | 商店 | game/assets/music-demo/05-shop-lamplight-deal.ogg |

标题/探索运行文件不改动；战斗取老板确认的冷线交锋30秒WAV，商店取灯下交易初稿30秒WAV，以现有FFmpeg编码96k Opus-in-Ogg。来源、路径、字节数和SHA256见 [audio-package.json](audio-package.json)。新增音频使用新文件名，旧战斗、旧商店及其余历史音频不覆盖、不删除。

`MUSIC_TRACKS` 仅有title/board/battle/shop四个条目。节点路由归入上述四类，所有首脑复用battle；临时卡牌/背包等浮层保留节点的曲目。音量、交叉渐变、音乐开关、页面隐藏暂停与战斗45% ducking保持既有行为。

停用设置中的冬境声景来源选择，旧`sdt-music-source=scape`偏好不再启用；兼容`setMusicSource`调用只能选择当前文件配乐。声景实现代码保留，现行音频不播放该来源。独立`game/music-demo.html`与游戏共用四首映射，名称和场景说明已同步。

## 验证与覆盖边界

音频播放器/路由及音频设置定向测试28/28通过；相关source/menu/test的ESLint与文档守卫通过。新增曲目在当前Codex内置浏览器的现行试听页中真实点击，四首均完成Howler解码并进入播放/交叉渐变，原始状态见 [browser-audio.json](browser-audio.json)。游戏首页真实点击进入设置，确认旧来源选择器消失，音乐开关/音量保留；未改音量或存档。

四首界面截图为 four-tracks.png。浏览器未使用外部Edge、CDP或headless，没有多尺寸检查，也没有通过注入函数模拟玩法。节点与首脑归类由定向路由测试覆盖，没有逐场景推进游戏存档。

全项目contracts与architecture-boundaries守卫有两项被其他会话新增的`game/src/ui/home-fx.js`第67行语法错误阻断。handoff确认该文件属于ZCode的WF-home-polish-1009完成未提交项；本轮未修改该文件。

增量资产审计报告17个其他资产未登记错误（卡图、字体及ui/ak素材），没有错误命中本轮新增的两个音频。新音频按准确字节数/SHA256登记，未覆盖其他清单条目。该结果不记为全库资产审计通过。

当前战斗/商店使用已经确认的30秒版本循环，保留句尾淡出，没有在本轮改写音乐或扩展曲长。制作指纹与接入验证不代表对完整音乐循环的再次作曲验收。

## 收官

现行音频说明同步到docs/audio-system.md，并保留该文件已有的来源说明修改。复用现有5200服务，没有创建或停止他会话进程，不build、不提交。旧文件按老板指示仅停用。完成未提交、编辑占用释放。
