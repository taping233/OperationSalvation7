# 通行证配方：重复检测推动共享实现

2026-10-18 UTC，完成未提交。

## 检测与处理

原 jscpd 报告：`../2026-10-18-redundancy-tools/hub/jscpd-report.json`。`game/src/hub/game.bag.js` 旧368–381与652–664（14行184 tokens），旧382–389与667–674（8行79 tokens），对应旧详情与当前堆叠zoom的两类通行证合成。

两入口确实共用配方，存在一个必须保留的差异：碎片配方的旧详情消耗当前详情UID，zoom消耗当前库存首张A。因此不是简单把一个入口复制到另一个入口。

- 新 `game/src/hub/game.bag.token-craft.js` 纯计划统一配方、实时材料/碎片校验、产物模板校验与成功文案。
- `game.bag.js` 内 `craftBagToken` 统一提交、一次UID分配、成功日志、保存与回背包。两消费者仍通过原bagAct及closeZoom调用，显式传入或省略来源UID。
- 先取得完整计划和新UID，后改变材料/碎片。修正原先缺产物模板仍扣材料并报成功的问题；打开后材料移除/改类型/碎片不足也拒绝。
- 保留前三张B的库存顺序（包括原先可选的安全格材料）、详情指定UID/zoom首张A、产物进入普通背包、原有容量边界、配方成本与产物ID。不新增安全格或容量规则。
- 保留既有帮助/页面生命周期diff。没有改第三段容器重复、package/lock或美术。

## 验证

两入口成批修改后一次集中定向验证，`tests.log`：7文件131项通过。

新增纯计划6项：材料顺序、明确UID与首张选择差异、两种缺产物、来源被移除/改类型、材料/碎片不足。真实模块zoom新增5项：两配方成功仅一次UID/loot/save，重复旧回调失效，缺产物零消耗，打开后原位删材料/耗尽碎片拒绝。旧详情当前不由UI导航调用，保留其函数与显式UID调用；未声称实页跑过该历史入口。

复用背包生命周期、帮助返回、结构化道具、道具旧行为基线、contracts、architecture测试。测试中旧音频codec/美术fetch stub告警保留原始日志，不是实页资源验证。

定向ESLint（`lint.log`）、两源码node语法、相关diff检查通过；8套类型配置通过（`types.log`）。这些是模块/jsdom与静态验证，无实页或FPS结论；未build、开服务、提交或推送。

工具代理以原配置 `tests/tools/redundancy-report.json` 在Node22复扫hub，报告 `jscpd-hub-after.json` 与 `jscpd-hub-comparison.json`：两段通行证克隆消失，hub克隆6→4，重复行59→37（减少22行），重复tokens599→336（减少263）。剩余game.bag.js七行容器重复不在本次范围。该计数说明共享实现生效，不代表性能或FPS收益。
