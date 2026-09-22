# R3-0 命令交互守卫交付

## 契约结果

- `resolveDart` / `resolveSlam` 只在当前存在同类 pending 交互时结算。
- 合法目标结算一次后清除 pending；迟到、取消后或重复命令不伤害、不扣能量。
- 无效 side 或已死目标不再回退到第一名活敌人，并保留 pending 供玩家重选。
- 背包砸击结算时能量不足会保留选择态并显示既有能量不足提示。
- 双镖仍允许第二段选择另一目标或同一目标；首段击杀时，流血不再串到另一名活敌人。
- 卡牌数值与普通/首脑战结算差异未改。

## 复现与修复

新增 `tests/r3-0-command-guards.test.js`，通过真实 `BattleSession.start` 和 `BattleSession.commands` 调用覆盖：

- 普通战：双镖无 pending、取消后迟到、合法后重复、死目标、重选活目标。
- 普通战：双镖首段击杀后的流血归属。
- 首脑战：砸击无 pending、错 side、取消后迟到、合法后重复。
- 普通战：砸击 pending 期间能量降为不足后保留待选态。

修复前首次定向运行为 3/3 失败：无 pending 双镖仍造成伤害，首段击杀后流血串目标，无 pending 砸击仍扣 2 能量。

## 程序验收

命令：

```text
npx vitest run tests/r3-0-command-guards.test.js tests/message-batch-0917.test.js tests/bag-slam-button.test.js tests/message-batch-0920-late.test.js --no-file-parallelism
```

结果：4 个文件、22 个测试全部通过。

## 待 Friday 实机验收

- 根任务需在 IAB 从游戏正常入口/现有开发者工具进入普通战和首脑战，实际点选双镖与背包砸击。
- 重点观察快速双击、取消后迟到点击、死目标后重选，以及结算后继续出牌。
- 本文档不将程序测试通过写成 IAB 实机通过。

## Friday 根复核（03:36）

上述22项已由根亲跑通过。正式游戏IAB普通/首脑战砸击取消与重新选中、双击一次结算、普通战继续用初始攻击获胜通过。首脑50→46，能量2→0；普通战另一敌人未被重复伤害。

双镖通过另列的真实BattleSession命令UI夹具复核：无pending不生效，首镖击杀不串流血，死亡目标保留选择且不转移，活目标第二镖只伤1并上中毒，重复与取消后迟到命令不生效。这不是完整游戏双镖鼠标流程证据。夹具曾因未加载真实rules初始化失败，已返工为正式mapData.js启动链后实测通过。

不占档测试局已刷新清空，开发者模式恢复原OFF；原玩家存档未作为调试对象。R3-0有界修复通过，R3-a另包推进。
