# 入城与事件：实图参考

2026-10-11。真实图片已下载原字节并view_image查看；本文只采用可见布局，不推断未观看的动态。原参考不接入游戏。

| 编号 | 来源/图片 | 实际观察 | 本项目采用 |
| --- | --- | --- | --- |
| T01 | [PC Gamer STS2实机文章](https://www.pcgamer.com/games/roguelike/slay-the-spire-2-early-access-features/)，[Neow图](references/sts2-neow-pcgamer.jpg)，图标Mega Crit版权；画面版本v0.98.2/2026-03-09 | Neow主体占整屏中央，顶部持续状态，名称/短对白形成焦点，三条奖励选择集中下方；不是右下角通知 | 入城整页一个焦点、实际职业卡成为主对象、简短区域/启程文字、持续状态与唯一继续动作；不复制Neow身份或三选一规则 |
| T02 | 同文章，[Ranwid事件图](references/sts2-event-pcgamer.jpg)，画面v0.98.0/2026-03-05 | 左侧事件人物，右侧标题与分段叙事，下方三条选择；每条代价/收益就近，选项没有混进长叙事 | 事件场景与阅读/选择分工，选项标题和已有后果说明相邻，长文滚动独立，主动作清楚 |
| T03（不作UI依据） | [IS Central IS6指南](https://is-central.github.io/is6-sui/is6-progression/) Ending 2 Encounter对应[图片](references/arknights-is6-event.png) | 下载图实际上只有蝶与冬枝场景插画，没有标题/选项/UI | 排除于事件UI布局证据；可说明对象焦点与环境分层，不把纯场景误称实机选择页 |

补核：[Playto开局逐屏实机教学](https://playto.dev/learn/slay-the-spire-2-japanese/)与[STS2 Neow页](https://sts2.dev/ancients/neow)确认场景归属；没有将未观看录像写成时序依据。UI布局依据是实际看过的T01/T02截图。

## 字节与获取

获取：2026-10-11，从上述页面web工具核实原图链接，Invoke-WebRequest下载原字节，再view_image；没有截图伪造或UI图层重绘。

- sts2-neow-pcgamer.jpg：305522字节；SHA256 8f4db80858965a891b8eab7674002dc43435df67bc7485645cf15baf0f680cb3；原图 https://cdn.mos.cms.futurecdn.net/hEAn7QQ33igbBM6hbWPF3N.jpg。
- sts2-event-pcgamer.jpg：234562字节；SHA256 098173d47582b875363cca6fcb764cd1aa9f98f2b1efa5b4bc36b3aaaa933a64；原图 https://cdn.mos.cms.futurecdn.net/zBUHmoDEx334RdStjSbShd.jpg。
- arknights-is6-event.png：1812822字节；SHA256 2fd927bbf28caa6b126e632958a8a4881a08a06ba1c108006a07ac729702e8e7；原图 https://is-central.github.io/guides/is6-sui/is6-progression/ed2encounter.png；>1MB由references/.gitignore精确排除，只留本地索引。

通用检查沿总计划G1/G2/G5/G6/G8/G9；美术沿L1/M1与L2。截图事实、适配选择和游戏实际业务规则分别记录。