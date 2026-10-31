# 时光符文范围核对

2026-10-30 核实：该条件属于已排除的研究所第二地图，当前普通四层流程不接入，不新增迁移范围或待决策项。

- `搜打撤/game/src/run/game.nest.js:423` 构造研究所首脑战 `nest: { runes: (game.nestEquipped || []).slice() }`；全 `game/src` 搜索 `nest\s*:|runes\s*:` 未找到普通战斗传入该选项的入口。
- `battle/core/battle.setup-mechanics.domain.js:92` 的 `applyNestRunes` 仅从 `opts.nest.runes` 读取；无符文立即返回。96–99行逐符文调用 `applyRuneFlag`。
- `battle/runtime/battle.runtime.factory.js:431` 重置 `timeRune=false`，437行仅 `kind==='time'` 设置该旗。
- 普通战斗随从状态的本轮36向量使用实际默认无研究所符文上下文；不将其宣称为时光符文条件通过。

源码指纹沿用本目录 `source-baseline-check.json` 对794份运行源字节的复核及独立审查源manifest。以上为范围证据，不是研究所符文移植完成结论。
