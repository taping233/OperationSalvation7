# 连续游玩验收阻塞与节点取消语义修复

## 结论与覆盖边界

2026-10-18 UTC 当前平台内置浏览器已可列出并创建标签，但无法到达当前执行器的 Vite。真实游戏输入 0 步，未完成整备→地图→事件→战斗→奖励→背包→撤离，因此不能声称连续体验、FB004左栏或FB040/043/044实页通过。没有游戏截图、未听音，未用外部浏览器/CDP/headless替代。

受阻后只读定位发现两个同根因的客观问题，经父会话授权最小修复：公共取消探测将按钮全文中的“返回”当取消，误把跨层/撤离主操作当作 Esc 目标。不是主观美术意见，不凑足问题数量。

## 已复现、已修复

1. 反向层间门关闭语义错误。
   - 路径：任一后层→打开反向闸门→尝试 Esc/公共关闭入口。
   - 原主按钮“返回上一层”排在“返回当前层”前；取消探测选中 goDoor，回调会跨层。
   - 位置：game/src/run/game.run.altar.js openDoorModal；共同探测位于 game/src/ui/overlay.js _findCancelBtn。
   - 修复：goDoor data-cancel=false，doorBack data-cancel=true。正向/反向明确取消留当前层，显式主按钮仍按原回调换层。

2. 撤离页关闭语义错误。
   - 路径：第三层且可献祭3牌的紧急撤离页，或首脑已击破后的终局撤离页→尝试 Esc/公共关闭入口。
   - 原 payExit 的说明含“返回基地”，被当作首个取消入口；前者打开献祭页，后者直接开始撤离事务。这里不是声称紧急撤离按一次 Esc 就已扣牌。
   - 修复：payExit data-cancel=false，stayHere data-cancel=true；同一取消按钮在停用撤离点、卡牌不足、首脑未击破分支也明确标记。所有回调、费用、资格与存档规则不变。

## 证据

- 新增 tests/node-cancel-semantics.test.js：真实生产节点HTML渲染与公共取消方法，jsdom合成DOM按钮点击/直接调用公共关闭方法。不是平台浏览器、不是实际键盘输入。事务与换层底层为受控mock，不冒充完整撤离成功。
- cancel-before.log：最初6项，3失败3通过。准确失败：反向门探测为goDoor、紧急和终局撤离探测为payExit。
- cancel-after.log：新测+事件生命周期+overlay-dialog+contracts+architecture-boundaries，最终统计见日志。
- 新测覆盖正反向取消留层和显式跨层、两类撤离取消无消耗/付款/事务调用、原紧急献祭选择与原终局事务入口、三个资格受限分支。
- lint.log：限定生产文件与新测试。
- 未build、未全量测试、未提交、未推送。仅game.run.altar.js按钮属性与新测，未修改公共弹层实现。

## 环境阻塞原文与清理

- sandbox 0.0.0.0:5371 启动：uv_interface_addresses returned Unknown system error 1。
- sandbox 127.0.0.1:5371 可ready，但当前平台浏览器 http://127.0.0.1:5371/ 返回 net::ERR_CONNECTION_REFUSED。
- 临时非生产启动器尝试避免Vite网卡枚举，可使0.0.0.0:5372报告ready，但后续独立shell curl同样connection refused；未继续使用该启动器。
- 读取浏览器错误标签被URL policy拒绝，未绕过或重复读取。
- 正常 require_escalated Vite启动失败：bwrap: Can't create file /home/agent/.codex/sessions: Read-only file system。未读取该禁止路径，未更改系统/网络权限，也未再试绕行。
- 两自有服务exec session87387与66241已分别Ctrl-C确认exit130；没杀其他进程，无残余自有服务。临时启动器仅在/tmp，非项目源码。

## 媒体说明

媒体恢复会话随后报告2259项已按准确Git blob/size恢复；仍有33个清单引用路径不在完整提交媒体索引且不存在。此报告未打开游戏页面，未将媒体清单缺口归因为美术质量问题。正式视觉/连续体验验收仍需先解决Vite到平台浏览器的连接。

## 同根因追加扫描（17:49–17:52 UTC）

父会话要求继续找最多2–3条可确定复现的同类误触。此次没有新增确定案例，没有新增生产修改或伪造红测。

已核对：run节点/事件/拾取/火堆/闸门/祭坛/商店/撤离，hub仓库/庭院/整备/角色/收藏，菜单离开与设置，以及战斗二级页的牌堆/背包/编组/抉择/手选/注能。扫描标签、说明、aria-label/title与_findCancelBtn的实际匹配条件，并检查DOM顺序和真实所属弹层，未因文本含关键词就机械改动。

排除的疑点：
- 普通事件/拾取虽有“获取并离开”，生产nodeScene模板前置eventExit。已有退出先被选择，不会自动领取。
- 庭院“关闭雨”、整备“取消追踪”位于基地/整备真实返回件之后，不会抢走取消入口。
- 仓库“取消收藏”在独立cardZoom操作区，非当前ovBody，不按公共overlay取消探测定性。
- 战斗抉择/手选候选已有data-cancel=false；可选手选的跳过为原有正确取消语义。
- 领取后的“返回基地”、保留奖励的“返回地图”等是正确返回，不应删改。

未确认的条件性风险：战斗背包使用道具/存安全格以及编组候选包含动态卡牌全文，未显式排除取消匹配。若历史自定义卡名/描述含“返回”等词，理论上可能被选中。但当前cards.data.js/cards-sync.json扫描未发现内置非事件卡匹配，且CARD_DESIGNER_WRITES_ENABLED=false，制作/改名/导入均已禁用，不能把任意虚构卡名当作当前玩家可达缺陷。此项未实现修复、未声称实际复现。

已告知帮助返回修复会话取消匹配风险；其回复已给helpBack显式data-cancel=true。本会话未触碰其overlay/help/game.bag属地。
