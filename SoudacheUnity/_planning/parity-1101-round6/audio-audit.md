# BGM加载失败与手动重试

2026-11-01，Root授权接续本轮音频状态修正。只改 `AudioService.cs` 的BGM状态/请求与 `CurrentSettingsPage.cs` 的音频状态/重试订阅；先前Hub八源保持冻结。新增检查源尚未执行，没有编译、测试、Unity或Player进程。

## 来源与确证缺口

现行MIGRATION明确：首曲失败保持静音，后续新曲失败保留上一有效曲，不回退历史配乐。Vite `audio/sound.music.player.js` 的desired/current/failedScene分开，`ui/settings-audio.js:17-20,42-46`显示当前请求失败和上一有效曲状态，并提供明确手动重试。

旧Unity先改_musicMode，再加载新曲；失败时旧clip仍存在，设置只检查MusicAsset为空，误报新请求就绪并藏重试。旧设置重试还先PlayBgm(null)，在重新加载失败前就停止上一曲。

## 最小实现

- `PlayBgm(string)`签名保持，可继续作为Action<string>方法组使用。普通切曲与新的 `RetryBgm()`复用私有LoadRequestedBgm；同scene重复请求只同步现有播放状态，不自动重载或重复发加载警告。手动重试仅处理失败请求，不先清空。
- `MusicLoadFailed`描述当前请求结果。失败保留上一有效source/clip；成功清失败标记，继续原双AudioSource淡入淡出。曲库、MusicGain/duck曲线、静音/音量持久化及SFX总线均未改。
- `_loadedMusicMode`不是另一个资源缓存：仅标记是否仍有逻辑上选中的有效曲。显式PlayBgm(null)清此标记并按原入口停止曲目；虽然AudioSource保留已加载clip引用，再请求缺失曲也不能复活这个已清空的clip。SyncBgm与MusicAsset据此区分“保留上一有效曲”和“仅有不应播放的缓存clip”。
- `MusicStateChanged`在请求完成/失败、显式清空及全局侧栏Mute时更新活跃设置状态。设置原Update没有音频轮询，仍不添加轮询。音乐音量/音乐开关继续由现有AudioWrite即时更新与持久化，避免同一路径重复发事件。
- 设置每次Build先移除本组件旧订阅再登记一次；分类切换不新增订阅，Release立即退订，OnDestroy幂等释放。重试事件绑定当前栈顶owner/未释放音频订阅、该次具体按钮身份/当前音频分类与可用状态，旧分类、被覆盖/已关闭页面或同页新区域的旧UnityEvent不能借新按钮加载。

## 受控真实检查源

入口 `Sdt.Editor.CurrentAudioRetryRound6Checks.Run()/Assertions`，Root提供隔离profile与Play模式。检查读取正式title/board两首Resources音频；仅临时替换运行时CurrentAssets.Music字典中board路径为合法缺失路径，finally恢复，绝不改磁盘媒体或模拟播放器。

覆盖首次缺曲静音、同请求无重载/警告、实际设置重试、旧曲source/clip/原播放状态保留、请求失败状态/按钮、实际Pointer音量滑条与音乐开关及偏好落盘、全局静音恢复、真实资源恢复后的正常切曲/淡出、显式clear不复活缓存、分类往返单订阅与旧事件拒绝、正式关闭立即退订。检查资源和组件状态，不声称扬声器听感、逐样本声学、OS输入或FPS。

当前只冻结检查源，未写Passed。文件原字节及LF指纹见 `audio-freeze.json`，由Root统一接线与集中验证。
