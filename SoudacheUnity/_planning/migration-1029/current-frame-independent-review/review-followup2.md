# E1 补核：第二批原生帧证据

E1 已在 `current-unit-frames-2` 闭环：独立解析 result/trace，226 条实际转帧中，10 条 `fixture:false` 全部属于无的正式命令阶段（stage2 出牌3条、stage3 EndTurn7条）；其余216条均为 `fixture:true`，没有来源混标。没有依据 result.passed 代替核对。

## 核验结果

| 项目 | 独立结果 |
| --- | --- |
| 原进程 | exit0，未超时；本补核未启动Unity |
| 输入快照 | before/after各334键，逐键值一致，无新增或删除 |
| result / trace | 各297条records，6条cues，内容分别一致 |
| 正式命令转帧 | 无，stage2=3、stage3=7，共10条false |
| 夹具转帧 | stage4=4、stage5=211、stage7=1，共216条true |
| 其他false记录 | 2条明确real标签及对应2条native-frame-sample；均为无的正式命令采样 |
| 原审查读取源 | 22项当前SHA与前次review.json记录相同；新运行快照中有对应键的项全部匹配 |
| 图像范围 | 新批32PNG，记录264去重载入资源；本补核只查看新版两张real命令图 |

当前 `CurrentUnitFrameValidation.cs:63` 按 `_role != 0 || _stage < 2 || _stage > 3` 标记夹具，stage1–3仍调用正式 Session.PlayCard/EndTurn，stage4以后才直接 Actor.Play。新运行 source-before 内当前验证器SHA为 `cba022589ce39555f9348f6f42ba02ff0adddab36bcf744fb60b5138b7202868`，BattleSession SHA为 `7dc534371bd2552a25f337a4749cfc688d216cd635a83b2534275807ca662b99`，BattleActorPresentation SHA为 `7750ea6cc6ced409f46c22525562b94afe5b402a0e63316dc8b123ff9ccd575a`，均与补核时文件一致。这里只核对指纹对应，不重新审查Core语义。

## 两张新图

`frames-wu-real-card-command-atk.png` 经 view_image 查看：角色仍为无，采样索引7/帧041为持剑收势站姿；日志为初始攻击4伤害，画面生命条仍处于命中前队列阶段。此静帧与正式atk时间轴相符，不单独声称展示了挥斩全过程。

`frames-wu-real-EndTurn-hurt.png` 经 view_image 查看：无后仰受伤，敌方行动状态、998/1000生命、敌方9996/10000生命及受伤闪光/浮字可见。人物透明轮廓和脚底无新异常。

六条cue依次为 windup(atk)、敌受击10000→9996、wait、enemy-windup、自身受击1000→998、wait；与前次确认的正式事件链及本批两图一致。

## 复用及限制

复用前次角色帧目录、透明度与脚锚组件的已确认审查边界，未再看32图。24张PNG与前批字节相同；无的8张PNG字节不同，本次只重新查看其中2张real命令图，另外6张夹具图没有新视觉验收。完整图SHA、源指纹复用、转帧分组及两张采样在 `review-followup2.json`。

正式命令仍仅指无的Session API调用，`osHardwareInput:false`。其他30张、模拟暂停与死亡末帧驻留仍是夹具。固定1920×1080后台离屏证据、真实施法/致死/系统焦点/硬件输入及最终独立构建的原有限制不变。旧批 `current-unit-frames-1` 保留其历史错误标签，不被本次闭环改写。

仅新增本目录 `review-followup2.md`、`review-followup2.json`；production和共享docs只读，未启动Unity、编译或CUA。
