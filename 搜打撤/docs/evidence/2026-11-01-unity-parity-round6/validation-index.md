# 第六轮最终已执行验收索引

领域 **1483**；原生断言 **1312＝复用943＋最新实跑369**。FilmFlow、Receipts、Journey另列。所有列入通过的进程均有exit0记录；本次只核对证据与五张原图，未重跑。

## 领域

| 执行 | 断言 | 实际日志（本地相对本目录） | 日志SHA256 |
| --- | ---: | --- | --- |
| battle | 492 | `domain-battle-4/battle.log` | `a954d38ff25da8daa1b5ec3f92d1d5912fd27fd76e8810862875d1e34137883c` |
| run | 326 | `domain/run.log` | `6f0392a627c1e5c3f5a79bcead4dbeff57e5f1d08ed072dd6ab2c3ebc767da98` |
| run-round2 | 32 | `domain/run-round2.log` | `7f33b29b7734a03ad8ca619f25f9b82d87ccd2dde32752a68acdc42c75fc8ae3` |
| hub | 472 | `domain-2/hub.log` | `e458529bc95840bc6b5075096ed5200423c0753f2ae2f857fdd7532cf6bf29da` |
| photo-export | 29 | `domain-remaining/photo-export.log` | `17a279e01b9aebbae529fa4c6c1c8cd88aa91235ab620f76d6d9de9c513cd26e` |
| run-round6 | 93 | `domain-remaining/run-round6.log` | `5b07fd7678647c921543dcb6769f832c15036d81e6828e1474bb2c094adf34df` |
| archive-export | 20 | `domain-remaining/archive-export.log` | `b7e0159ad30e88a9f0e8741502569359f15d313d86b0b18d7940b4466e4d80b1` |
| archive-import | 15 | `domain-remaining/archive-import.log` | `6bd43114889be818bd9c6f206790985862d48fb49f0e762c47b53dcb13c12152` |
| archive-id-conflict | 2 | `domain-remaining/archive-id-conflict.log` | `fe3b2a8899fc7470572a37436095f4c9689f3cf6d2fd51b235d96849cb4a6620` |
| archive-name-conflict | 2 | `domain-remaining/archive-name-conflict.log` | `add08da16feb952632bb1974ef942b122efc31fa52bf3d57d210006a35265725` |

1483＝Battle492＋Run326＋R2 Run32＋Hub472＋Photo29＋RunR6 93＋Archive39。Source oracle8个case和9个来源SHA不加总。

## 原生断言

| 执行 | 断言 | 依据 | PID | 实际日志（本地） | 日志SHA256 |
| --- | ---: | --- | ---: | --- | --- |
| native-round6-5 | 369 | 当前冻结实跑 | 17068 | `native-round6-5/unity.log` | `5eff40c1090927a9eecb480519bba55c72289fa2135611348bcf0277ebe66a21` |
| native-round2-regression | 375 | 原通过复用 | 35836 | `native-round2-regression/unity.log` | `71ba06cae3696c7f0ff0f2d18bddf006ee9d44aee78fd526bd0c13486dc7090f` |
| native-round3-regression | 131 | 原通过复用 | 13216 | `native-round3-regression/unity.log` | `fcdb914fc935b887c662bbba07c1d638007c776e63152f234fc7ea529b8cdbab` |
| native-round4-regression | 127 | 原通过复用 | 37388 | `native-round4-regression/unity.log` | `b016b74fdfde44edfa92e09559c2d0f93645c4192fee059e7936e06fdb5aa90e` |
| native-round5-regression | 262 | 原通过复用 | 4840 | `native-round5-regression/unity.log` | `caa96ec9de81cd8762fdca065b485db4175a5cf0471d1e4f73c6e8432dff29bd` |
| native-shared-regression | 48 | 原通过复用 | 32916 | `native-shared-regression/unity.log` | `b3e239d77496f4ba5993fb54df46267ce459f510fb34578e07c6dea973c29730` |

最新369＝HUD14＋Hub58＋音频34＋献祭107＋发现156；复用943＝375＋131＋127＋262＋48。旧Round6第二次271、第三和第四次各367均保留，但不重复加总。

## 独立流程

| 执行 | 实际进度 | PID | 实际日志（本地） | 日志SHA256 |
| --- | --- | ---: | --- | --- |
| native-film-regression | 67 records | 17200 | `native-film-regression/unity.log` | `3ded19c7c0edaa98eec8307ef615720c482ffe7eab6200565a59834a90f9f9a6` |
| native-receipts | 61 ticks | 2196 | `native-receipts/unity.log` | `14072f17c6e4d141e961563afe3cbe7da2c196574c251d3f0a4c41a33bacaae7` |
| native-journey | 448 ticks | 37092 | `native-journey/unity.log` | `3c1894f0b98871f036b5c791b3c2de9dcac4ad350d0ea8cde806ed7f033bed70` |

三流程为1920×1080原生离屏、受控状态和构造uGUI/正式命令；不声称物理键鼠、自然游玩或FPS。Journey本轮448 ticks。

## 构建、播放器和视觉范围

- `build-desktop-6/process.json` exit0，828项执行前后不变且等于最终冻结；`player-6/process.json` exit0、result.passed=true。
- 正常播放器GUID `c3ee3347a03149de80bbb7fe3f0bb5c2`，2560×1440、DPI120、Windowed、ScreenSpaceOverlay。实际日志本地 `player-6/player.log`，SHA `cdd194ff097935974777e446e29710e7385de345047075993db6805adaa74dcb`。
- 本代理逐张view_image实看入口/候选/已选/返回/成功撤离五张，无新遮挡或越屏；范围与逐图SHA见 `sacrifice-visual-review.json`。其它图片的人工审批归Root。

## 依赖与失败保留

- 当前828项全部匹配最终freeze；824项自首次原生快照未变。四项变化为BattleSubpages布局、Discover Editor检查、TopBar Grave/Discover显隐及正常播放器Boot探针，全部在SDK Core47/Core＋Run83编译闭包外，24辅助项及9个oracle来源未变；1483与8case可复用。
- 943原生与三个流程保留实际旧快照及日志，最新369和构建绑定当前快照；本表未把943写成最新全部重跑。
- 三次Battle失败及首Native编译失败保留。player/player-2早点击失败、player-3 exit0但Discover越屏的视觉失败、player-4把道具奖励误设为必须入手牌的QA失败，以及player-5 exit0但Grave/HUD重叠的视觉失败均保留，未计为通过。player-4后探针保留能量、源消耗与唯一奖励检查，按道具/非道具真实去向断言。
- 大原始result/trace与图片按发布白名单留本地；本表路径为本地相对路径。全部process/result/source-before/source-after SHA和复用边界详见 `domain-validation.json`。

收据SHA256：`9664f16ad36096955005f0b3f0745046a15835e64a62c6a5e751fe60963ed90a`。
献祭五图审查SHA256：`dd79c01a8fd861a5840454d198edb4b4b9df3a1a04ee3e47cefc06be07854c98`。
