# 当前五人战斗帧链迁入

迁入当前 `搜打撤/game/src/battle/view/battle.frames.js` 所用的五个 `sprite-v1/animations.json` 与引用图；264 张 PNG 与源 WebP 解码后的 RGBA 像素逐张一致，共 35,078,786 字节，最大单张 327,072 字节。未生成新图、裁切、重设计或移除旧资源。原稿与 PNG 的 SHA256、尺寸和取得方式见 `assets-receipt.json` / `sync_frames.py`。

| 人物 | 原始画布 | idle 槽 | atk | hurt | death | cast |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 无 | 512 × 342 | 72 | 10 | 8 | 21 | 1 |
| 长无语 | 768 × 512 | 72 | 12 | 19 | 28 | 12 |
| 白塔 | 512 × 342 | 72 | 10 | 8 | 21 | 10 |
| 黑香 | 512 × 342 | 72 | 10 | 8 | 21 | 1 |
| 星月 | 512 × 342 | 72 | 10 | 8 | 21 | 10 |

当前源 `buildTimeline('idle')` 明确保持第一个 idle，即 neutral；没有播放清单中的呼吸循环。迁入保留该行为、重复帧槽、逐帧原始毫秒、攻击/施法/受击完成后回 neutral、死亡末帧锁定。无和黑香的 cast 本来只有 neutral，不补造动作。战斗帧不随阵容页皮肤切换；敌方仍沿源静态立绘，bandit 用现行攻/伤变换样例，其余沿无帧前冲/受击兜底。

固定画布按当前 CSS 的 body-height/body-fill 得到 figure 高度，以 neutral 的四分之一样本 alpha>=8 包围盒固定脚底；所有动作沿同一画布和脚底，死亡不重新放大。采样复现 Canvas 默认低质量四点双线性；没有使用 Pillow 带抗锯齿的宽滤波核，也没有逐帧视觉挪位。Future Unity imports 继续经过现有 `CurrentArtImportPolicy` 保留 NPOT 原始尺寸。

## 正式触发与生命周期

`BattleActorPresentation.cs` 只记录正式执行入口的表现数据：同一卡的每段 windup、AOE 分组、连续子牌、命中前后生命/防御副本、敌方攻击、毒伤、自伤、护卫、盟友攻击和真实死亡。数值来自已经结算的命中，不由 UI 重算，也不调用快照 getter 或随机数。

`BattlePresentationQueue` 是唯一表现等待入口，按当前 battleToken 和单调 sequence 消费。权威 `GameSnapshotRef` 即时接收最终状态，玩家输入在队列期间锁定；血条/反馈则在实际接触帧逐段更新，队列完成才同步最终界面。接触帧来自源 `battle.action-timing.js`，无接触帧时保留原 cue fallback、85ms 反馈预告、重击停顿、倒地释放，以及敌方 130ms 前摇和 420ms 步进；2× 只缩表现时间。

常驻 actor 只在角色/token 更换或离场时释放，自有纹理按租约引用计数缓存与卸载；同场快照不重建播放器、帧图或每帧实例。设置页覆盖及应用暂停时冻结时钟，返回续播。胜利等待当前队列/动作完成；真正 hp<=0 等 death 末帧后续接原结算事务；主动 Surrender 和烟雾 null 不伪造 death、不增加结果等待。结果引用、会话引用和 token 防重入；保存失败重试复用同一结果，不重播动画。

## 后台验证

- `source-oracle.mjs` 直接执行当前 JS 的 buildTimeline/playSeq/advance、frameImpactRemaining、createStagedPlayback 和 impactProfile；C# 生产时钟/纯时间函数 **1813/1813** 对照通过，包含五人所有动作、1×/2×、帧边界、contact、combo、受击覆盖、死亡锁和固定脚底。
- `source-beats.mjs` 执行当前源正式引擎，C# 生产 BattleSession 命令逐段对照：三连击、范围连击、击杀、单帧施法、连续生成子牌、敌方双击、真实死亡、主动撤退、烟雾；事件、生命副本独立性、订阅者不改变快照/RNG 共 **25/25** 通过。
- `check_isolated.py` 复制当前生产源码到本任务私有 snapshot，以现有 Unity DLL 后台检查；不启动 Unity、不写共享 compile。既有预测 **289/289**、卡规则 **167/167** 通过，日志在本目录。
- `asset-check.json`：264 张源/产物 SHA 与 RGBA 像素一致；没有超过 1MB 的单张图。

最后一次整树复编遇到 HUD 并行片在途依赖：`CurrentMapTools` 引用的 `CurrentRunHudAssets` / `BoardView.FrameExploration` 尚未全部落地；此前私有整编及 289/167 回归已通过。当前冻结不把最后一次集成编译记为通过，具体状态见 `receipt.json`，由主会话在 HUD 冻结后集中编译。

复现顺序（工程目录）：`python _planning/migration-1029/current-unit-frames/sync_frames.py`；`node _planning/migration-1029/current-unit-frames/source-oracle.mjs`；`node _planning/migration-1029/current-unit-frames/source-beats.mjs`；`dotnet run --project _planning/migration-1029/current-unit-frames/Audit.csproj -p:UseSharedCompilation=false`；`python _planning/migration-1029/current-unit-frames/check_isolated.py`。

没有启动 Unity、前台窗口、浏览器、安装依赖、提交或推送。原生实际图片、真实输入、设置返回、关闭重入和完整战败/胜利等待由主会话在冻结后集中验收；后台数字不替代原生验收。

## 额外发现

原始 frenzy 双击随机诅咒夹具出现既有规则域差异：种子 123 首击 3 后，源得到流血使次击 4，当前 C# 得到中毒使次击 3。没有修改随机或规则。原失败保留在 `frenzy-random-baseline.json`；本任务双击时序夹具设置双方现有诅咒免疫，独立对照前摇/命中/生命阶段。该差异已交主会话登记。

最小直接调用已核实：源 `frenzyCurse` 用 `random('status','generation')`，首值 0.35579043603502214；Unity `FrenzyCurse` 用 `Random("status")`，首值 0.8453671627212316。C# 使用源签名时直接得到同一个 0.35579043603502214，说明此次差异在调用目的参数。方法路径、领域输入及直接调用复现均已写 `receipt.json.rngFinding`，两端数值保存在 `rng-source-vector.json` / `rng-unity-vector.json`。
