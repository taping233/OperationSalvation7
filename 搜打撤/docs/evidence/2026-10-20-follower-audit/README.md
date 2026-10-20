# 随从机制检查

检查时间：2026-10-20 00:38（Asia/Shanghai）。结论：基础召唤、自动攻击、代挡与死亡流程已实现，但索敌和潜行存在缺口，不能判为完整实装成功。本次仅审查，新增本目录复现与报告，未修改游戏源码、共享状态台账或提交。

## 已确认行为

- 当前正式卡「征召」（tt7-recruit）消耗 2 能量召唤两名攻击力 4、生命 4 的「步兵」。结构化规则由 `game/src/cards/cards.sync.m3.js:121` 接入 `game/src/battle/effects/effect-steps.m2.js:375`，进入 `game/src/battle/core/battle.engine.js:796` 随从数组。
- 通过 BattleSession 普通战真实出牌命令验证五个连续回合：存活随从各攻击一次；随从按数组顺序承伤；阵亡者停止攻击和代挡；全部阵亡后玩家正常承伤。
- 最后一名敌人被随从击杀时可结束战斗；新战斗会清空旧随从。
- 现有相关测试覆盖天国之门为活随从赋予祝福、封印肢体入场及无攻血属性，均通过。封印肢体不攻击、不代挡由源码条件确认，本轮未补做其独立整回合场景。
- 生物牌本身被排除在普通战手牌和首脑战编组之外（`battle.lifecycle.js:281,296,334`）；当前使用入口是召唤法术/能力，并非把生物牌直接打出。

## 已复现问题

| 优先级 | 问题与影响 | 复现结果 | 实现位置 |
| --- | --- | --- | --- |
| P1 | 随从潜行造成伤害后不破除，回合结束也不到期；首位潜行随从持续占据代挡位，敌人攻击被潜行挡下，玩家可能持续免伤 | 两名4/4随从赋予潜行1后，仍正常造成共8点伤害，但本轮结束潜行仍为 `[1,1]`；敌人的3点攻击未伤到随从。另以0攻击随从排除破潜条件，回合结束潜行仍为 `[1,1]` | `battle.enemy-phase.js:148-155` 未调用 breakStealth；`:304-308` 计时仅处理玩家和敌人，未处理随从 |
| P2 | 前一名随从击杀敌人，后一名继续攻击尸体，损失输出 | 两个敌人分别4血和10血，两名4攻随从本应分别击杀第一名、把第二名打至6血；实际第二名仍10血 | `battle.enemy-phase.js:149` 取 alive()[0]；`battle.engine.js:122` alive只看dead；死亡清理在所有随从攻击结束后 `battle.enemy-phase.js:157` 才执行 |
| P2 | 首位敌人潜行时，所有随从仍攻击它，不选择后方可攻击敌人 | 两个100血敌人，第一名潜行1；两名随从攻击后双方仍 `[100,100]`，可见目标未受伤 | `battle.enemy-phase.js:149` 未过滤潜行目标，Combat.dealDamage 对潜行目标直接返回0伤害 |

潜行赋予场景在补充探针中直接构造，使用正式 Combat.addBlessing，不冒充真实页面操作。天国之门能够给随从潜行，由正式效果实现和通过的现有测试另行确认。0攻击场景用于隔离到期缺口。潜行敌人同样为构造场景。

## 验证与复跑

已有测试：3文件、42项通过，退出码0。

```powershell
npm run test:target -- tests/m2-contract.test.js tests/abyss-sovereign.test.js tests/card-description-fix-target-effects.test.js
```

本目录补充探针：8项，4通过、4失败，退出码1。失败分别为击杀后索敌、攻击破潜、潜行到期、跳过潜行敌人。探针以预期正确行为断言，保留失败供后续修复复用；由独立配置运行，不进入默认 `tests/**/*.test.js` 测试集合。

```powershell
node node_modules/vitest/vitest.mjs run --config docs/evidence/2026-10-20-follower-audit/vitest.config.mjs --reporter=verbose --reporter=json --outputFile=docs/evidence/2026-10-20-follower-audit/results.json
```

原始结果见 [results.json](results.json)，源码输入指纹见 [inputs.json](inputs.json)。所有判断基于本次混合工作树，HEAD仅作基线标识，不能归为HEAD独立结果。

本轮未启动服务、未构建、未核验远端CI。当前平台无可调用的内置浏览器交互接口；游戏实页显示、真实鼠标输入与视觉表现未核验。未用外部浏览器替代。
