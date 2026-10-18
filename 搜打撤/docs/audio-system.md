# 音频系统说明

`game/src/audio/sound.js` 是 Vite 版音频入口，公开 `SDT.Sound` 接口：`sfx(name[, opts])` 播放短音效，`music(mode)` 切换标题、探索和战斗音乐，音量及静音设置独立控制。进入主页即加载并尝试播放音乐；浏览器限制自动播放时，首次点击或按键恢复 AudioContext 并续播。播放器在音频解锁后重试播放失败的当前曲目，静音、隐藏页面和离场曲目仍受原有开关控制。

原创场景配乐由 `SceneMusicPlayer` 按需加载独立 HTML5 媒体 Howl 实例（显式 `backend: html5`，不走整曲 WebAudio 解码），只使用四首：《霜窗回声》织体轮替修订版、初版《灰线行军》、战斗《影潮交锋》120秒无缝循环修订版、商店《灯下交易》60秒循环修订版。首页、基地及成功/失败结算复用标题曲；探索、营火、事件、祭坛、撤离复用探索曲；普通战斗与全部首脑共用战斗曲；商店使用商店曲。下一曲加载或等待播放解锁期间保留旧曲；收到下一曲真实 play 回调后旧曲淡出500ms、新曲淡入650ms，带代次保护并释放离场曲目。关闭音乐、全局静音和页面隐藏立即卸载当前及待播放音轨；音量滑条与战斗 ducking（45%）同步当前曲目。

曲目映射由 `sound.music.catalog.js` 的 `MUSIC_TRACKS` 维护，文件在 `game/assets/music-demo/`；临时卡牌/背包浮层保留节点所属曲目，离开节点恢复模式曲。独立试听页为 `game/music-demo.html`，与游戏使用同一份四首映射。标题曲来源与运行指纹见[首页配乐二轮精修记录](evidence/2026-10-13-WF-title-music-v12/README.md)，商店曲来源见[商店配乐轻快版记录](evidence/2026-10-13-WF-shop-music-v3/README.md)，初版探索来源见[四首接入记录](evidence/2026-10-09-WF-four-bgm-install/README.md)，战斗曲来源与运行指纹见[完整战斗曲接入记录](evidence/2026-10-12-WF-battle-bgm-install/README.md)。旧音频文件仅停用，历史文件和草稿仍保留。

全部运行短音效由 `sound.samples.catalog.js` 的106个明确事件及 `phase` 双方别名维护，`sound.samples.player.js` 只播放已解码文件。界面/提示以 Kenney Interface Sounds 为基底；钱币交易、检索翻页、点击选择、敌方前摇与安全格存取共11事件使用 Vehicle / Jan Schupke 同系列实录 Foley（CC0，原始 WAV），破甲/破盾补充 Kenney Impact Sounds；抽牌 draw 单事件使用 f4ngy 的 Dealing Card（CC BY 4.0，公开HQ MP3，保原字节）；其余原卡牌、战斗、治疗、宝箱、胜败使用已有许可档案完整的 CC0 池。当前文件、增益以采样catalog为准；[早期映射清单](evidence/2026-10-17-sample-only-sfx/mapping.json)于2026-10-18从抽牌替换前留存快照重建，来源指纹与原报告缺口见[重建说明](evidence/2026-10-17-sample-only-sfx/README.md)。旧 jsfxr、WebAudio 振荡器与噪声生成、合成失败回退已退出运行链。旧素材及独立试听代码保留，不删除文件；`sound.bank.js`、`sound.scape.js`、`sound.ui-samples.js` 不被当前音频入口导入。

首次解锁后以两路并发加载/解码，原始采样不做峰值拉升。单个文件失败只保留同事件已就绪兄弟样本；全部未就绪、失败或 AudioContext 仍挂起时静默，既有视觉反馈不受影响，也不会在解码/解锁后补播过去事件。多个变体顺序轮换。未知事件静默。

音频入口重复初始化时销毁旧实例；Vite 热更新释放播放器、所有短音效节点、缓存、AudioContext与监听。销毁时取消在途fetch、拒绝排队任务；不可取消的原生解码迟到结果被忽略。短采样结束、被高优先级声音替换或实例释放时均断开source/gain/filter。

音效开关立即控制 SFX 总线，已排程声音也受静音控制；关闭期间调滑条只更新保存音量，重开时恢复该音量。音乐播放请求实际开始时复核最新滑条和 ducking 目标；相同起止增益直接设置音量，避免 Howler 的零差淡变定时器常驻。

悬停与导航使用低增益 tick 短采样。原事件冷却仍生效；界面组最短35ms起音间隔、最多3并发，全短音效最多10并发，达到上限时高优先级可替换更低优先级声音，其余丢弃；不会穿透回旧声音。所有采样共享SFX总线、高频衰减和Master软限幅器（阈值-6dB、比例12:1）。护盾增加最长420ms、前摇最长220ms并渐隐，前摇保留快进速率限制。

音乐来源固定为这四首文件配乐，设置保留音乐开关和音量；旧存档中的冬境声景来源偏好不再启用。`setMusicSource` 兼容接口只选择当前文件配乐。冬境声景代码和历史音乐文件保留；音频入口不再导入或创建冬境声景，首脑战和压力接口也不启动旧合成层。

长曲加载失败不切换后端、不自动回退整曲 WebAudio 解码；保留仍可播放的旧曲并记录错误。同一失败场景不会随重复刷新请求重载，切换场景或关闭后重开音乐才重新尝试。浏览器播放阻止单独记录，首次用户输入/解锁可重试播放，旧曲在真实新曲开始前不退场。公开只读 `musicPlayback` 提供后端、请求/实际曲目、playing、播放位置、实际/目标音量、静音与失败信息，供 `?perfProbe=1` 性能面板展示；普通页面不显示该面板。

当前默认媒体后端是针对音乐开启附近 code9、关闭音乐后可完成同路径的对照结果作出的风险降低。尚未拿到内核终止原因或瞬时内存峰值，不能认定已证明OOM，也不能凭单元测试认定浏览器崩溃已消失。HTML5媒体仍占缓存/解码资源，实页须确认音乐在播放且位置递增，再复跑原崩溃路径。

## 素材与听验

Kenney Interface Sounds 1.0 与 Impact Sounds 1.0 官方原始 OGG 位于 `game/assets/sfx/interface-soft/` 与 `game/assets/sfx/impact-soft/`，各附原 License.txt（CC0，可商用、署名可选）。既有战斗素材来源见 `game/assets/sfx/battle/SOURCES.md` 与 additions/SOURCES.md。新增素材已登记资产清单及SHA256。

自动测试覆盖事件路由、失败静默、解码/释放、静音与并发契约；没有人工耳听或用户听感验收。2026-10-18的定向复核和原资料缺口见[重建证据](evidence/2026-10-17-sample-only-sfx/README.md)，原试听片段与历史测试日志未找回。

抽牌新增素材及署名见 `game/assets/sfx/f4ngy/SOURCES.md`；仅播放增益设为0.26，未裁切、转码或归一化，旧draw素材仍保留。来源收据、接入前快照与2026-10-18复核见[单抽牌重建记录](evidence/2026-10-17-f4ngy-draw/README.md)。

同作者实录增量6件/9事件的来源包元数据、精确映射与2026-10-18复核见[实录批次重建记录](evidence/2026-10-17-real-foley-batch/README.md)；原始下载包与历史A/B报告未找回。现存运行文件与收据指纹一致，仅运行增益变化，前摇沿用220ms渐隐。数值检测与同库来源均不代表听感已验收；本批未耳听。

安全格存入 safeStore / 取出 safeRetrieve 使用同一 Accessory 库的锁盒转动/解锁原WAV，仅运行增益0.18/0.22。原字节与精确两事件映射见 [安全格音效记录](evidence/2026-10-18-safe-slot-foley/README.md)；这是安全存取的反馈隐喻，未变更通用gain、卡牌获得或核心战斗声音，实际听感待审。
