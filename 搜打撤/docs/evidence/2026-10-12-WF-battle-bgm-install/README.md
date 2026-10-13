# 影潮交锋完整循环修订版实装

老板要求实装已确认的修订完整版。战斗映射现使用`game/assets/music-demo/03-battle-shadowtide-full-v2.ogg`，普通战斗与全部首脑共用该曲；首页、探索、商店仍使用原四首映射中的其他三首。旧战斗音频保留停用，没有删除。

## 来源与接入

运行文件从[完整循环修订版](../2026-10-12-WF-battle-full-loop-v2/README.md)的已确认OGG逐字节复制，没有重新编码。128 BPM、64小节、120秒、Opus-in-Ogg；2,738,407字节，SHA256为`51195783d125aa6205015de3442696ec9c7969d80396b9ea3ea379eed3a445b8`。来源、许可声明及运行资产条目见[audio-package.json](audio-package.json)；许可沿已有GeneralUser GS说明。

`sound.music.catalog.js`只改battle的静态URL；试听页战斗条目更新名称与120秒说明。`asset-manifest.json`只插入该曲条目及计数加一，程序逐项核对其他条目完全保留；没有覆盖共享清单的其他未提交修改。现行音频文档只同步曲名与来源链接，保留原有音频生命周期及主页悬停说明修改。

## 验证

- 运行文件与已确认来源SHA256一致，资产条目字节数/指纹/来源核对通过，完整FFmpeg解码和120秒格式检查通过，见[runtime-audio-check.json](runtime-audio-check.json)。源录音的无缝/精确帧数证据沿完整循环修订版，本次未改动编码字节。
- catalog的ESLint通过。音频测试及contracts/architecture-boundaries共49例，48通过、1失败；两个工程哨兵测试文件通过，普通战斗与首脑路由相关测试通过。
- 失败为`tests/sound-music.test.js:96`的旧静音断言，要求不调用unload；工作区此前已有`SceneMusicPlayer.set`在immediate静音时release/unload的修改。该用例使用假的event音轨，不读取本次battle音频URL；本轮未修改播放器或该测试。不能将本轮音频测试记作全绿。
- 全库资产审计返回400项错误、623项未变历史警告，涉及其他卡图、字体、UI资产等；本次新增曲目登记核对通过，不能将此结果记作全库资产审计通过。未顺带修改其他资产或债基线。

Codex当前窗口内置浏览器访问现有5200的`music-demo.html`，真实点击“试听 影潮交锋”；战斗条目`decoded=true`、`playing=true`、`volume=0.45`，状态为“循环试听中”，下载链接指向新运行文件。原始DOM证据见[browser-playback.json](browser-playback.json)，截图为`browser-playing.png`。使用同一catalog与SceneMusicPlayer的真实解码/播放链路，没有注入播放函数或模拟按钮事件。

没有推进玩家存档或逐个进入首脑战；场景归类由路由测试覆盖，本次实页仅验证共用试听播放器。没有实际听辨，也没有等待完整一轮来声称浏览器接缝听感已通过。最终清理时原临时标签页已不可访问，内置浏览器标签列表为空；未操作其他标签页，控制台日志未取得。

## 收官

现行音频说明同步，文档守卫按收官检查结果记录。完成未提交、编辑释放；复用5200，未创建或停止他会话服务，没有构建、提交、推送或发布。
