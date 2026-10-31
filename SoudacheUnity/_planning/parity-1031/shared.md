# 公共运行、资源与音频对照

当前集中验收已完成，见[本轮结果](../../../搜打撤/docs/evidence/2026-10-31-unity-parity/README.md)。以下为分片实施记录，待验/未运行等时态按记录当时理解。

状态：生产修复已写入，等待所有属地冻结后统一验证。源Vite只读；未删除文件或提交。

- `ui/run-top-bar.js` 与 `map-health-hud.js` 按状态变化刷新。Unity原每帧四次复制整个面板栈、创建覆盖名数组、重写同值文字并测量金币/攻击宽度；现一次同步只读扫描，数值、位置、资源宽度与章节内容改变才更新。栈的快照API保留给需要稳定副本的调用，新增即时只读索引给同步扫描。
- `InlineIconText.text` 相同内容且字体/字号/富文本/输入框环境未变时复用解析文档；字体等发生变化仍重新解析，避免整条HUD不变时触发图标、中文布局和网格重建。
- `core/performance-settings.js` 只有设置改变时更新状态；Unity原在逐帧装饰消费者读取Quality时深复制整份JSON。现在按GlobalStore身份和Revision缓存解析结果，真实写入、取消或失败回滚后失效，仍消费原设置存储。
- 现行 `sound.js`、`sound.policy.js`、`sound.samples.player.js` 已使用sample-only。Unity原还加载旧音效，未知/缺失采样回退过程合成音，随机噪声缓存持续增长。已移除整条旧合成/旧采样路径和无调用的资源接口，只读现行CurrentAudioCues；未知/缺失事件静音。
- 补齐源音效冷却、密集结算装饰声抑制、点击/deny抑制、UI三声道/35ms门、十声道与结果预留、优先级替换、同事件顺序采样、gainScale/lowpass/maxDuration、分贝音量曲线与战斗音乐压低。音效滑条同时更新在播声音与余下衰减。原音频高频搁架和软限幅器仍未移植，不能以此次状态断言声学逐样本一致。
- BGM使用原四曲并保留现行SceneMusicPlayer载入下一曲失败时上一有效曲继续的行为；旧MIGRATION文档“失败一律静音”已不符合当前执行源码，需按实际条件更新。改为两个可复用的音乐声道交替播放，切曲按源1100ms进入/900ms退出；相同目标同步不重置淡变。
- `Res`移除旧Art/Portraits、Art/Scenes、Art/Cards、Art/Icons、Art/Title、Art/Hub以及Audio/Bgm/Sfx/Battle路径回退。保留现行卡牌类别图和皮肤默认图等源实际使用的正常映射，以及当前默认Texture导入转Sprite逻辑。
- `MapModel`移除零调用BuildLegacy、MakeRing与旧三环静态布局/中心数据，保留现行LayeredMapGenerator快照、正式类型和公共Hash。`BoardView`移除零调用环线/旧中央法阵构建及专用状态，启动不再先创建伪地图Build(0)；新开局/读档仍由DesktopRunHud.BindMap创建当前地图。始终隐藏的hintbar/layer-banner及每帧隐藏逻辑移除。
- 移除零生产调用、无场景GUID挂载的CardDesignerScreen/ImportExportOverlay/CardTilt与未赋值的App.OpenCardDesigner、恒false的编辑标志；制作坊继续按现行范围关闭，保留文件与.meta。移除Core中已无消费者的chainMove/altarFrom/AltarFrom与MapModel.CenterPos；Unity可靠新档不增加旧Web格式搬运。
- 原特效图集按原像素从`game/assets/battle/fx-atlas.webp`转PNG，专用导入不重画，指纹见本任务battle-fx-atlas.json；超过1MB产物留本地不入Git。正式sync_assets.py已接该资源与_policy导出。

待验：全生产类型检查、CurrentParityValidation原生设置/文字/音频状态断言、战斗专有原生断言、当前Standalone实际图集/基地/局内画面与领域回归。没有物理键鼠、听音比较、内存剖析或帧率收益数字声明。

末轮独立审查后的补修：基地消息由`CurrentHubOperationNotice`维护本页右下owner通道，成功3200ms、警告持续、Navigate清除；详情错误在自身footer保留且日志不再上浮，成功先返回基地再发消息。普通RuleHandSelection与真实Infusing按源两条活跃入口分离；新增`CurrentArenaFilter`仅对真正注能的arena子树离屏合成，预乘透明度双轴卷积与72%输出，退出恢复；`OnDisable`立即停止/释放、下一帧安全还原，避免Unity原生激活过程SetParent限制。此阶段不继承player-1的画面通过结论，等待新包重新实绘。
