# 公共顶栏与生命显示一致性

状态：CSS 实现与定向回归已完成，当前窗口实页由主会话验证。本片没有修改生命值计算、节点移位、ARIA、金币/攻击数据或返回动作。

## 最终行为

- 地图、战斗、普通房间和奖励总览继续使用同一个物理 `runTopBar`。生命展示统一为 164 × 64 CSS px：15/18 px 标签、30/34 px 等宽当前值/上限、4 px 细条；透明、无斜切、无常驻边框或底座。
- 背包使用其现有关闭、分区、容量导航，隐藏 overlay 直属公共顶栏。未给背包增加顶边留白，没有压缩既有五列卡面空间。
- 独立完整设置页按真实 `settings-page settings-tabbed` 与 `settings-layout > settings-nav` 结构隐藏顶栏；战斗简易设置仍保留。
- 战斗发现选牌仅在真实 `battle-decision[data-decision-kind="discover"]` 同时存在发现面板与 footer 取消导航时隐藏顶栏。普通房间即使叫 discover 也不隐藏；奖励总览保留资源信息。卡牌大图原有隐藏边界沿用。
- 脚本保留原有生命条蓝/金/红三档颜色及首次写入的无过渡处理。CSS 没有用 `!important` 压过 inline 状态颜色，也没有新增另一份颜色状态判断。游戏内和系统减动效均关闭条宽过渡。

## 修复依据与边界

旧地图规则 `page-expedition-hud.css:217` 的 body 条件与双 ID，曾压过组件内部的 20 px 数字规则；进入 page-opaque 或 scene-battle-3d 后条件失效，数字尺寸、AK 斜体、内部 padding 和条宽又落回另一组底稿。现由公共组件对 hpHud、hp-hud-body、map-health-heading、hpText/hp-rest、hpBarWrap/hpBar 完整定义，优先级高于旧底稿，不再依赖页面状态改变外观。

`runTopBar` 是绝对定位的 104 px 公共顶栏；背包 shell 从其原有 28 px 顶部 padding 开始，之前会被第二套导航覆盖。按老板确认的页面边界，现在隐藏背包公共顶栏，保留本页布局。没有假定 header-iv 继承导致挤压：本轮未找到该现行键，背包实际节点为 `<header class="bag-head2">`。

先前只看到护甲 class 与 append 就推断其命中 `.sts-hp > span { inset:0 }` 不成立：实际护甲节点为 `b`，已经由负责会话核对排除。本片没有修改战斗单位护甲或生命条 CSS。

当前发现壳会把 body 的 `.ov-btns` 移到 `battle-decision-actions` footer（`battle.decision-shell.js:25–36`）。初版仅沿 body 模板写邻接条件，无法命中实装；已把测试改为真实 content/footer 分层，确认旧条件先失败，再改为发现面板与 footer 取消导航的独立双条件后通过。

实际标签节点使用 `.map-health-heading` class，没有 `map-health-heading` ID。本片沿当前 DOM 接入，没有为样式添加新 ID 或修改 JS。

## 修改与快照同步

本片实际修改集合：

```text
game/src/ui/run-top-bar.css
tests/run-top-bar-consistency.test.js
docs/evidence/2026-10-23-WF-p3-ui-implementation-1023/hud-consistency.md
```

冻结运行快照只需同步 `game/src/ui/run-top-bar.css`，与主会话已同步的数字逻辑文件配合。该文件已经冻结，未在给出以下指纹后继续修改：

| 项目 | 值 |
| --- | --- |
| 文件字节 | 9928 |
| 原始 SHA256 | 642ce6e521e854b1bdc7a8446b0e1fdc3f1e0dbeb01c436ad447cee2ad7791cf |
| LF 归一 SHA256 | 3be978ce0b87556edf92ac3520cb28340d2afa16570349cb68a0a5528f9fdff0 |

## 定向验证

`npx vitest run tests/run-top-bar-consistency.test.js tests/run-top-bar-actions.test.js --reporter=dot`：2 文件、17 项全部通过。新增 14 项检查当前地图/opaque/战斗上下文、组件 CSS 与旧底稿反序加载、完整内层尺寸、inline 颜色优先、双减动效与各隐藏/保留边界。另 3 项现有 actions 回归确认同一节点、真实战斗快照、动作与格式未丢失。

首次用旧 CSS 运行新增契约，6 项失败，包含旧 200 px 容器、减动效条宽过渡和背包顶栏未隐藏。期间与未完成数值入口合跑出现的格式失败，在其负责会话冻结新源码后已通过。测试没有通过删除断言跳过产品问题：针对 jsdom 25 的复杂 `:has()` 匹配差异，辅助程序仅把该关系按真实 DOM 后代查询解析，仍使用原 selector 的 CSS specificity，并测试实际 content/footer 结构。

定向 ESLint 与 diff 空白检查通过。未启动服务、构建、提交或操作浏览器；实页结果由主会话统一记录。
