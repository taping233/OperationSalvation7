# 音频清单（批次 7a）· 网页版 sound.js ↔ Godot GameAudio 对齐

> 真源：`搜打撤/game/src/sound.js`（452 行，2026-09-12 通读）。资产源：`搜打撤/game/assets/`（只读，本批复制出）。
> Godot 落位：`SoudacheGodot/assets/sfx/**` + `SoudacheGodot/assets/bgm-*.mp3`，实现：`src/App/GameAudio.cs`（+ 同目录音频配套文件）。
> 本文件由批次 7a（wave1-C）产出；7b 设置项/按键绑定在此基础上扩展。

## 0. 数量口径说明

任务口径「53 个 wav+ogg」与实盘差异：网页版全部音频文件 = **49 个 wav/ogg + 2 个 mp3 = 51**（`find 搜打撤/game -name "*.wav" -o "*.ogg" -o "*.mp3"` 实测，无 node_modules 之外散落）。53 无法对上，疑为把 LICENSE/README 计入；本清单按实盘 49+2 登记，逐字节校验 `diff -rq` 全部一致。

| 目录 | 文件数 | 内容 |
|---|---|---|
| `assets/sfx/`（根） | 17 wav | click×5 / rollover×6 / switch×6（Kenney UI Audio，CC0，含 LICENSE.txt、kenney-license.txt） |
| `assets/sfx/battle/` | 27 ogg | 战斗/开箱采样（Kenney Impact/RPG/Jingles，CC0，含 kenney-license.txt） |
| `assets/sfx/jsfxr/` | 5 wav | 程序化生成（`scripts/jsfxr-generate.cjs` 可再生，无版权，含 README.md） |
| `assets/`（根） | 2 mp3 | bgm-sour-orange-earth.mp3（3.7MB，战斗/行军曲）、bgm-liejie-fuhe.mp3（6.3MB，标题曲） |

## 1. SFX 文件清单 → 类别 → 触发点对照表

### 1.1 UI 类（wav，预载池，同类随机选一）

| 文件 | sound.js 键（类别） | 播放增益链 | 触发点（网页版 文件:行 → 语境） |
|---|---|---|---|
| click1~5.wav | `click` | ×1.8 → 压缩器(threshold -14dB, ratio 4) → sfxGain | 全局委托 sound.js:423：任意 `<button>` pointerdown；game.bag.js:589 |
| rollover1~6.wav | `hover` | ×0.12 → sfxGain | 全局委托 sound.js:428：button pointerover（去重/禁用跳过）；battle.view.js:1011,1117；game.boot.js:299（地图结点悬停）；game.cardslib.js:33；ui.js:186（卡牌特写弹出） |
| switch1~6.wav | `switch` | ×0.5 → sfxGain | 全局委托 sound.js:439：任意 checkbox change |

### 1.2 战斗/开箱采样类（ogg，池优先，随机选一 + ±5% 变调 + BATTLE_GAIN）

| 文件 | sound.js 键 | BATTLE_GAIN | 触发点（网页版 文件:行 → 语境） |
|---|---|---|---|
| hit-1~4.ogg | `hit` | 0.55 | battle.core.js:1376（hitFoe 对敌伤害结算成功） |
| hurt-1~2.ogg | `hurt` | 0.55 | battle.core.js:1812（玩家被反击受伤）；1913（随从替主人承伤） |
| parry-1~2.ogg | `parry` | 0.4 | battle.core.js:1339（元素庇幕免伤）；1371（潜行未命中） |
| curse-1~2.ogg | `curse` | 0.35 | battle.core.js:1823（变异巢母狂乱附诅咒）；1832（elCurse 异变体附诅咒）；1931（灼烧行为附灼烧） |
| heal-1~3.ogg | `heal` | 0.45 | game.session.js:95（game.heal 恢复生命） |
| chestshake-1~2.ogg | `chestShake` | 0.5 | 开宝箱摇幌阶段（sound.js:267 合成回退同键； chests.js 流程音） |
| chestburst-1~3.ogg | `chestBurst` | 0.65 | 开宝箱爆开（chests.js:170 `pick` 后的爆开段） |
| reveal-1~3.ogg | `reveal` | 0.45 | chests.js:258（逐卡揭晓） |
| legend-1~3.ogg | `legend` | 0.55 | chests.js:259（传说卡）；ui.js:148（传说卡全屏演出） |
| victory-1~2.ogg | `victory` | 0.5 | battle.core.js:2147（finish(true)）；game.run.altar.js:526（祭坛通关） |
| defeat-1.ogg | `defeat` | 0.5 | battle.core.js:2147（finish(false)）；game.menu.js:605、game.session.js:118（战败结算） |

### 1.3 jsfxr 采样类（wav，语义独立，**不回退合成音**，×0.6，归一化）

| 文件 | sound.js 键 | 触发点（网页版 文件:行 → 语境） |
|---|---|---|
| pickup.wav | `gain` | game.bag.js:362（使用物品）；game.run.scenes.js:214（场景获得物品）；game.run.shop.js:186,202（购买成功） |
| confirm.wav | `confirm` | game.menu.js:288（菜单确认）；688（按钮确认类 data-confirm） |
| error.wav | `deny` | battle.view.js:195（安全格满）；game.bag.js:357,372（背包满/不可用）；game.run.scenes.js:291,341（背包满）；game.session.js:234（addItem 背包满） |
| levelup.wav | `levelup` | meta.js:55（角色熟练度升级） |
| hit.wav | `strike` | battle.core.js:1612（背包砸击 resolveSlam，固定伤害） |

### 1.4 纯合成类（sound.js WebAudio tone/noise，无采样文件；Godot 等价 = 运行时合成 AudioStreamWAV，参数逐键移植）

| sound.js 键 | 合成参数摘要（tone: 波形/起→止频/时长/vol；noise: 时长/vol/滤波扫频） | 触发点（网页版 文件:行 → 语境） |
|---|---|---|
| `open` | noise .14s/.028/600→2200 + tone sine 440→660 .12s/.025 | ui.js:401（弹窗打开/换页） |
| `close` | noise .13s/.024/1800→500 + tone sine 620→420 .11s/.02 | ui.js:417（弹窗关闭） |
| `error` | tone square 190 .09s + square 150 .13s 延迟 .1s | game.run.altar.js:479；game.run.shop.js:173,180,196（购买失败）——注意 `error` 是合成键，与 jsfxr `deny`（error.wav）语义并存 |
| `pick` | noise .06s/.04/2000→800 + tone triangle 520→720 .07s | chests.js:170（开箱）；game.bag.js:606；game.run.scenes.js:208 |
| `drop` | noise .07s/.045/1200→400 + tone triangle 480→300 .09s | game.bag.js:680（丢弃物品） |
| `card` | noise .13s/.055/2600→700 + tone triangle 520→300 .1s | battle.core.js:1241（execPlay 打出一张牌） |
| `coin` | tone triangle 1250 .09s + triangle 1870 .14s 延迟 .06s | game.session.js:254（gainCoins 获得金币） |
| `dice` | 多段随机碰撞嗒声（0~.52s 循环随机 noise/tone，末段 .54s 落定重音；老板留言 #56，匹配 640ms 翻滚期） | 掷骰流程（game.run.flow 掷骰动画，经 UI 调 Sound.sfx('dice')） |
| `scene` | noise .32s/.032/1300→280 | game.run.flow.js:231；game.run.scenes.js:110（场景切换） |
| `flee` | noise .26s/.04/700→2600（上行扫频） | battle.core.js:2031（烟雾弹撤退）；2041（主动撤离视为失败） |
| `ding` | tone triangle 880 .12s + triangle 1318 .18s 延迟 .09s | chests.js:259-260（史诗卡）；game.cardslib.js:34；game.menu.js:733,737,750（设置开关反馈） |
| `victory`/`defeat`/`hit`/`hurt`/`curse`/`parry`/`heal`/`chestShake`/`chestBurst`/`reveal`/`legend` 的合成体 | sound.js:243-277 各键合成式 | 仅作 1.2 池加载失败时的回退；Godot 侧池资源随包预载，回退路径保留在 PlaySfx 内 |

注：renderer.fx.js:60 `FX.feedback(..., {sfx})` 为动态转发键，grep 全库无调用者传 `sfx` 实参 → 预留参数，无实际触发点。

### 1.5 全局事件委托（sound.js 尾部，Godot 由 BindButtons + 类别 API 对应）

| 网页版事件 | 音效 | Godot 对应 |
|---|---|---|
| 任意 button pointerdown | `click` | GameAudio.BindButtons（现有机制保留） |
| button pointerover（去重） | `hover` | GameAudio.BindButtons |
| checkbox change | `switch` | UI 层调 PlaySfx("switch")（7b 设置页接线） |

## 2. BGM 双轨结构（对照 sound.js:5-12, 334-420）

| 项 | 网页版 | Godot 对应 |
|---|---|---|
| 战斗/行军曲 | `bgm-sour-orange-earth.mp3`（Howl html5 流式, loop, preload:false, volume 0） | `res://assets/bgm-sour-orange-earth.mp3`（AudioStreamMP3 Loop=true，Godot 桌面版无流式必要，加载即播等价） |
| 标题曲 | `bgm-liejie-fuhe.mp3`（《「离解复合」主界面》，同上不预载） | `res://assets/bgm-liejie-fuhe.mp3` |
| music(mode) | `'title'`→标题曲；`'battle'/'board'/'base'`→主曲（activeBgm 只分 title/非 title） | Music(mode)：`"title"`→标题曲；`"battle"/"board"/"base"`→主曲；SetContext(screenKey) 桥接：menu→title，run/map/battle→board/battle |
| 切曲交叉淡化 | 新曲 fade(0→target, **420ms**)；旧曲 fade(vol→0, **280ms**) 后 300ms pause | 同参数（0.42s/0.28s Tween + 0.30s 延迟 Stop） |
| ducking | 战斗期间 BGM ×0.45（setDucked，battle.core 进出战斗调） | SetDucked(bool)，参数一致 ×0.45 |
| 播放门控 | musicMode≠null && !muted && !musicOff && userGestured（浏览器自动播放策略） | 同四条件；桌面版无自动播放限制，Kick() 保留 API 兼容语义 |
| music mode 调用点 | title: game.menu.js:26,606 / game.run.altar.js:527 / game.session.js:119；battle: battle.core.js:976,2132；board: battle.core.js:2165 / game.session.js:480(读档),591(出发)；base: game.hub.js:19 | 见 §3 战斗事件挂钩登记 |

## 3. 战斗事件挂钩（对照 battle.core.js，逐一登记）

| 网页版调用点 | 时机 | Godot 触发方式（本批落地情况） |
|---|---|---|
| battle.core.js:960 `setDucked(true)` + :976 `music('battle')` | start() 开战 | SetDucked(true) + Music("battle")；现由 SetContext("battle") 桥接（快照无独立开战信号） |
| battle.core.js:2131 `setDucked(true)` + :2132 `music('battle')` | restore() 读档恢复战斗 | 同上 |
| battle.core.js:1241 `sfx('card')` | execPlay 打牌 | 快照 HandCardLabels 变化可推，本批登记：PlaySfx("card") API 就绪，待 A 线事件流（见接口需求） |
| battle.core.js:1339,1371 `sfx('parry')` | 免伤/潜行未命中 | PlaySfx("parry") 就绪；快照无信号，登记接口需求 |
| battle.core.js:1376 `sfx('hit')` | 对敌伤害成功 | OnBattleSnapshot 敌方 HP 下降 → PlaySfx("hit")（已接） |
| battle.core.js:1612 `sfx('strike')` | 背包砸击 | PlaySfx("strike") 就绪；无快照信号，登记 |
| battle.core.js:1812,1913 `sfx('hurt')` | 玩家/随从受伤 | OnBattleSnapshot 玩家 HP 下降 → PlaySfx("hurt")（已接，hit/hurt 区分：玩家降=hurt，敌方降=hit） |
| battle.core.js:1823,1832,1931 `sfx('curse')` | 附加诅咒/灼烧 | PlaySfx("curse") 就绪；无快照信号，登记 |
| battle.core.js:2031,2041 `sfx('flee')` | 撤退/撤离 | PlaySfx("flee") 就绪；无快照信号，登记 |
| battle.core.js:2147 `sfx(victory/defeat/flee)` | finish(win) | OnBattleSnapshot StatusText「胜利/失败」→ victory/defeat（已接，沿用现有判定） |
| battle.core.js:2163 `setDucked(false)` + :2165 `music('board')` | finish 战斗结束 | SetDucked(false) + Music("board")；SetContext 离开 battle 屏时桥接 |
| game.session.js:95 `sfx('heal')` | game.heal | OnBattleSnapshot 玩家 HP 上升 → PlaySfx("heal")（已接） |
| game.run.altar.js:526-527 `sfx('victory')+music('title')` | 祭坛通关 | PlaySfx("victory") + SetContext("menu")（已由屏路由覆盖） |

注：OnBattleSnapshot 现有 HP-diff/StatusText 机制保留（不破坏 B 线）；parry/curse/strike/card/flee/dice 等细粒度事件需要 Core 领地提供信号，已在 PROGRESS.md「接口需求」登记。

## 4. 音量/静音键语义（localStorage → Godot user:// 配置）

### 4.1 键位映射（cfg：`user://audio.cfg`，节 `[audio]`；键名去掉 `sdt-` 前缀）

| localStorage 键 | 网页版取值 | cfg 键 | 默认 | 语义 |
|---|---|---|---|---|
| `sdt-muted` | '1'/'0' | `muted` | false | 全局静音（侧边栏齿轮）：master 增益 0，BGM+SFX 全哑 |
| `sdt-music-off` | '1'/'0' | `music_off` | false | 只关音乐（设置页勾选） |
| `sdt-sfx-off` | '1'/'0' | `sfx_off` | false | 只关音效（设置页勾选） |
| `sdt-music-vol` | 浮点 0~1（parseFloat，越界/非法则忽略保留默认 1；滑条 0..100 ÷100） | `music_vol` | 1.0 | 音乐音量滑条 |
| `sdt-sfx-vol` | 同上，默认 1 | `sfx_vol` | 1.0 | 音效音量滑条 |

### 4.2 叠加规则（sound.js:16-20, 340-343, 405；公式照抄）

- dB 曲线：`dbGain(k) = 10^((k-1)×30/20)` → k=1 ⇒ ×1.0（0dB，基准）、k=0.5 ⇒ ×0.178（-15dB）、k=0 ⇒ ×0.0316（-30dB）。端点语义：0=近静音、1=基准；等比可闻曲线。
- **BGM 有效线性增益** = `0.45 (BASE_MUSIC) × dbGain(musicVol) × (ducked ? 0.45 : 1)`；播放前提 = musicMode≠null && !muted && !musicOff && userGestured，否则静音/暂停。
- **SFX 有效线性增益** = `2.5 (BASE_SFX) × dbGain(sfxVol)`；静音前提 = muted || sfxOff。
- **click 专用链** = ×1.8 → DynamicsCompressor(threshold -14dB, ratio 4) → sfxGain（归一化尖峰防破音）。
- muted 独立于 musicOff/sfxOff（三级开关任意组合：全局静音 ⊃ 音乐关/音效关）。
- 写盘时机：五个 setter（SetMuted/SetMusicMuted/SetSfxMuted/SetMusicVolume/SetSfxVolume）即时生效并即时落盘（替代网页 localStorage 同步写；Godot 侧 ConfigFile.Save）。音量 setter 先 clamp 到 [0,1] 再存。
- Godot 落地：线性→总线 dB `20×log10(v)`；Music/SFX 总线用 AudioServer.SetBusVolumeDb 代码配置（不改 project.godot）；muted 走 AudioServer.SetBusMute(Master)。

## 5. Godot 侧实现映射（本批落地）

| 网页版机制 | Godot 等价 | 差异说明 |
|---|---|---|
| 两路并发解码队列（MAX_CONCURRENT_DECODES=2，sound.js:50-73） | Godot 资源随包预载（GD.Load 一次，常驻缓存） | 任务拍板：不需模拟解码队列 |
| 峰值归一化 95%（normalizeBuffer，wav+ogg 全做） | wav 池（click/hover/switch/jsfxr）加载时对 AudioStreamWAV.Data 归一化；ogg 池无法运行时改采样 → 直接用 BATTLE_GAIN | BATTLE_GAIN 本就是「归一化后压回」系数，ogg 侧合并为单次增益，听感接近；差异已登记 |
| 每音效新建 BufferSource（无限并发叠加） | SFX voice 池（8 voice round-robin，不打断进行中的音效） | 网页版同刻多音效可叠加；8 voice 覆盖实际触发密度 |
| ±5% 播放速率随机（battle 池） | AudioStreamPlayer.PitchScale 0.95~1.05 | 一致 |
| 合成音 tone/noise | 运行时合成 AudioStreamWAV（16-bit PCM，参数逐键移植 §1.4 表） | biquad 扫频滤波以一阶滤波近似；dice 每次即时合成（本就随机序列） |
| BGM 流式 html5 | AudioStreamMP3 直接加载 | 桌面版无移动网络带宽约束，无需流式/延迟加载 |
| beforeunload/自动播放门控 | Kick() 保留 + 7b 落盘策略 | 7b 处理退出强制落盘 |

## 6. 首次导入注意

复制的 wav/ogg/mp3 尚无 `.import`（Godot 编辑器首次打开项目时自动生成；dotnet build 不依赖）。旧骨架资产 `assets/audio/**` 本批未动（不在 7a 领地），GameAudio 已改用新路径，后续可由资产所有方清理。

## 7. 导出环境根修记录（批次 7a-fix，wave4-C，2026-09-12）

针对 6c 登记的两条 [6c→C]，在导出模板 exe（release template + 嵌入 pck）管线取证后根修：

1. **战斗音效基准路径补 `battle/` 段（GameAudio.cs）**：6c 曾以嵌入 pck 别名条目（`assets/sfx/<name>.ogg` → battle 内容）临时补运行时，但别名是 raw ogg、没有 `.import` 边车，运行时 `ResourceFormatImporter` 找不到元数据直接报 `No loader found`，27 个战斗 ogg 全部落进 jsfxr/合成回退（基线日志实证：27 条 No loader found + 27 条 sample missing，wav 0 失败）。根修=LoadPools 的 battle 池文件名全部改带 `battle/` 前缀（与 jsfxr/ 的相对路径写法一致），`LoadSingle` 基准 `res://assets/sfx/` 不变；pck 重建工具（`_planning/evidence/6c-battle/rebuild-embedded-pck.py`）的别名段已由本批移除回收（工具头注释同步）。
2. **ogg 走 `.import` 产物而非 raw 直载**：核实结论——本导出环境对 `.ogg`/`.mp3` 没有 raw 加载器（wav/png/ttf/tscn 有），`AudioStreamOggVorbis` 必须按官方导出姿势装载：pck 内含 `<file>.ogg.import` 元数据（`[remap] path="res://.godot/imported/<file>-<md5>.oggvorbisstr"`）+ 对应编译产物，`GD.Load` 经 importer 重映射取回真流。落点=rebuild-embedded-pck.py 直装导入产物：解析 assets/** 全部 `.import` 的 remap path，把 `.godot/imported/` 编译产物（oggvorbisstr/mp3str/ctex/fontdata/sample）从磁盘一并装入 pck（132 个，不再依赖基座 `.godot/` 是否新鲜）；不转 wav、不做运行时转码。rider：BGM 两首 mp3 同管线获得真流（此前 `AudioStreamMP3` 直载 raw mp3 在导出环境同样会 No loader found，仅因懒加载+无手势未在 6c 日志显形）。
   - 证据：GameAudio 新增启动审计行 `AUDIO_POOLS battle_keys=11/11 battle_streams=27/27 ogg=27 jsfx=5/5 ui=3/3 bgm_title=AudioStreamMP3 bgm_battle=AudioStreamMP3`（ogg=27 即 27 条 AudioStreamOggVorbis 真流计数），battle/menu 两屏 smoke 均 0 条 `No loader found`/`sample missing`/`fell back to synth`/`SCRIPT ERROR`；另加 PlaySynth 守卫——battle 增益键若跌进合成回退会打 PushWarning（正常合成键如 card/coin/dice 不受影响）。
