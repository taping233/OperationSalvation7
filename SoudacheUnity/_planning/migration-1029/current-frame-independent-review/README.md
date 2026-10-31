# 原生角色帧独立审查

本批 32 张离屏原生画面逐张经 `view_image` 查看，未发现需要整改的角色帧生产缺陷。五角色身份、动作差异、透明轮廓、脚底与椅脚接地、死亡倒地及末帧保留均有可见证据；结论只覆盖这些采样与所列代码边界。

## 已核实

- 原始证据：`搜打撤/docs/evidence/2026-10-29-unity-desktop/current-unit-frames-1`，原进程 exit 0，未超时。独立解析 source-before/after，331 个键、值逐项一致，无新增键。此结论不依赖 result.passed。
- 五个源 `animations.json` 的 SHA 与 Unity manifest 的 catalogSha256 相符，全部动作帧槽顺序和时间与现行源一致。记录的实际载入去重帧为无 51、常无语 63、白塔/黑相/星月各 50，总计 264。CheckCatalog 实际 Acquire/Frame 逐项载入、核对尺寸与底部 pivot；本审查没有重启 Unity 重跑。
- 32 张均记录实际 Image.sprite 对应帧、alpha 0–255；背景从人物留白处透出。各角色内部 footY 恒定，加 catalogFootInset 均约 412.4；跨角色透明留白不同得到对应校正。画面未见不透明底板、裁脚或倒地后放大。
- 无为白发蓝结黑裙持剑，常无语为紫黑帽白发，白塔为棕发绿裙坐椅浮书，黑相为黑甲橙巾大剑，星月为金辫绿白袍。各自攻击、受伤、死亡中段与倒地末帧可辨。
- 无与黑相的 cast 本来就是单 neutral 帧；常无语、白塔、星月的 cast 本来复用 atk 序列。待机本来仅保持首帧（原 `battle.frames.js:440–442`），72 个目录呼吸槽不表示现行游戏循环播放。相同 PNG 或静止 cast 因此不构成迁移缺帧。
- 五个 death-last-hold 为各自目录最后槽（无20/常无语27/其余20），deathComplete=true，并在完成后至少 0.25 秒采样仍保留尸体。死亡通过直接 Play 夹具触发，画面生命值仍存活属于该夹具设定。

## 真实命令与夹具边界

两张 `frames-wu-real-*` 来自验证器 stage 1–3 的正式 Session.PlayCard 与 EndTurn 调用，无直接 Actor.Play。Core 经 BeginActorCard/BeginActorHit 发 windup atk 和命中事件；EndTurn 经 PlayerTakeHit/BeginPlayerHit 发 enemy-windup 与自身受伤事件。BattlePresentationQueue 订阅、按 battle token/sequence 排队，随后驱动 ActorFrames.Play 与 PresentResolvedHit/PresentFloats/Hurt。

六条 cue 是 windup(atk) → 敌受击10000→9996 → wait → enemy-windup → 自身受击1000→998 → wait，与两张命令图相符。攻击截图处于命中前队列阶段，HUD 暂为旧生命值而日志已有已结算伤害，不能据此判成伤害未发生。EndTurn 图显示敌方行动、998/1000、自身后仰与受伤闪光。

其余 30 张均为直接 Actor.Play 的呈现夹具，OnApplicationPause 也仅为无攻击中的 SendMessage 模拟。没有真实施法出牌、真实致死结算、硬件点击/键盘、系统焦点切换或长期末帧驻留的本批证据。

## 证据标签发现 E1

原批次 222 条 `actual-frame-transition` 全部标 `fixture:false`，其中包括 208 条 stage=5 直接 Play 夹具转帧及 stage=7 恢复夹具；此字段表示观察到真实 actor 状态，不能单独证明正式命令来源。应结合 stage 和两张明确的 real 样本统计覆盖。

审查期间已观察到主会话将当前验证器第63行改为按 role/stage 标记 fixture；本审查未编辑该文件。旧批次 JSON 仍保留原标签，不能把代码修正当作旧证据已重生成。

## 精确限制与交付

这是一份当前源只读快照审查，不是最终构建验收。32 张为固定 1920×1080 的后台相机离屏绘制，OffscreenCapture 会指定 camera target、canvas scale 与 sorting；没有启动 Unity、共享编译、CUA、前台窗口或系统截图。未逐帧观看全部264资源或连续视频。敌方白矩形是 synthetic native-frame-foe 的受控目标，不据此推断正式敌人素材缺失。未审 Agent 旧档、复杂卡或整体界面设计。

`review.json` 包含逐图 SHA256、逐图观察与原始 sample、22 项读取源 SHA/精确读取边界、目录对比及六条 cue。当前读源中 CurrentUnitFrameValidation.cs 与 BattleSession.cs 已与该次运行快照不同，其他有快照键的已读项相符；每项 matchesEvidenceSnapshot 保留此限制。Core 正在独立修改，不能把此报告外推为最新全工程 build。

仅新增本目录 README.md 与 review.json，未修改 production、源 game 或共享 docs；无提交。
