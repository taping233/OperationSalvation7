# UI 与战斗交互模块化批次

2026-10-18 18:23 UTC。针对同类入口统一机制后集中验证，不改变核心玩法。

## 已接入

- 帮助返回：overlay-return-state，背包、商店购买/出售、撤离4入口。
- 战斗选择：battle.selection-ui，aim/layers/view/infusion-view共用状态投影、取消分派与提示。
- 奖励展示：reward-state、reward-scene-view，列表/详情、总览/整理共用状态和动作组件。
- 二级样式：secondary-ui-tokens，背包、容器、卡牌浏览、说明与既有决策组件共用规格。

各模块证据分别见 help-return-lifecycle、battle-selection-ui、reward-presentation-module、secondary-ui-system 对应目录；各项测试覆盖有重叠，不相加为去重总数。

## 合并反馈

- syntax、8套typecheck、lint均退出0；日志在本目录。
- 资源守卫初验：插件5项通过；主守卫因layers.js未经复核新指纹失败2项，历史发布证据receipt缺失造成另一套未加载。不是游戏新崩溃。
- 独立复核chests.js与battle.layers.js差分均不改变资源选择/加载路径后，更新对应指纹，不放宽审计。
- 恢复缺交接的历史receipt原字节：来自eb8d669-restore/runtime-dev同路径，SHA256 2a3d9e1c1a6ae68dc01e1ee5418081ce63b79de7fae21d7038b310a10016cec7，8682字节。已有3份provenance记录同哈希，receipt列19资产均与当前字节/哈希一致（总3428566字节）。这不是本轮重新发布证明。
- 针对失败的两份守卫补验结果另见 resource-guards-recheck.log。

未全量测试、未build、未提交或推送。实际滚动、视觉层级、触屏点击与转场观感仍需内置浏览器实页验证；当前开发服务环境阻碍未解除。

## 18:27 UTC 资源守卫闭环

首次补验发布证据4项已通过；同时正在收尾的页面生命周期重构使transitions指纹失效。逐字复核camp-entry资源选择、预载、失败降级均未改变，只改页面归属；同步其指纹后主资源守卫23项通过。插件5项沿用首轮通过结果，未重复运行。不同轮次原始失败日志保留。三份历史receipt重建副本同源，不作为三份独立来源。

## 人物列表资源入口复核

人物列表差分涉及历史未同步指纹：旧特殊cutout入口已在来源HEAD移除，当前仍经Art.skinUrl固定映射，不是任意路径拼接。独立枚举5默认与4皮肤路径，均存在且与195排除候选交集为0；完整历史至当前差分复核见 ../2026-10-18-audio-baseline-recovery/personnel-resource-review.json。据此同步opaque指纹，不将本轮UI差分无资源变化误称为全部历史差分都无资源变化。
