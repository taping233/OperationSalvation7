# 键盘选牌取消恢复来源焦点

2026-10-18 UTC。仅修复键盘选牌后尚未提交的目标选择取消，不改出牌、费用、目标规则或核心结算。

## 已核实问题与最小修正

真实模块链：卡面 Enter → `battle.layers.js` 调用 `selectCardByClick(uid, true)` → `battle.aim.js` 主动聚焦目标 → Esc → 清除选中和目标 role/tabindex，但焦点仍停在已不能 Enter 确认的目标节点。修前敌方/自己目标两项新增断言均失败，资源与清理断言已通过；缺陷是操作上下文丢失，不是取消失败。

现在只在键盘来源选牌时记录 UID、场次 token 和舞台；Esc 显式请求恢复，默认清理不恢复。仅当焦点仍在目标、场次和舞台仍有效、原牌仍在手牌、非忙碌且控件未隐藏/inert 时，将焦点还给原卡面，使用 preventScroll。鼠标选牌、已转焦其他控件、正常提交均不抢焦点；提交及过期清理同时清除来源记录。

源码范围：
- `game/src/battle/view/battle.aim.js`
- `game/src/battle/view/battle.layers.js`
- `tests/battle-hand-inspector.test.js`

## 参考边界

Slay-The-Robot 固定 SHA `4dac5abe0d19382f8ace2cec5ed3fd77e2a0e11d` 的 [Hand.gd](https://github.com/DesirePathGames/Slay-The-Robot/blob/4dac5abe0d19382f8ace2cec5ed3fd77e2a0e11d/scripts/ui/Hand.gd) 分离选择目标与提交出牌请求，CardSelectionOverlay 的选择态局部更新保留操作上下文。此处只借鉴选择与提交的边界，没有复制代码，也不声称参考项目已实现本次键盘焦点恢复。

## 验证

- 修前真实模块新增 enemy/self 两项红测：焦点仍为目标节点。
- 修后 4 文件 152 项通过：`battle-hand-inspector`、`cov-target-session`、`contracts`、`architecture-boundaries`，见 tests.txt。
- 新增 11 项覆盖 enemy/self 恢复、鼠标来源、原牌离手、场次变化、舞台断开、overlay 隐藏、舞台 inert、busy、主动转焦和正常出牌。
- 定向 ESLint、两生产文件 node --check、git diff --check 通过；8 套 typecheck 通过，见 types.txt。

以上为 jsdom 合成交互和模块检查，不是实玩。内置浏览器环境仍阻塞；未运行外部浏览器/headless/CDP、build、服务、提交或推送。待环境恢复后核验真实 Tab/Enter/数字键 → 左右切目标 → Esc → 原卡面继续操作的实际焦点环与视觉位置。
