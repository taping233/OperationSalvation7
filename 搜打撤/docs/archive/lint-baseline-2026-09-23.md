# ESLint 基线报告（2026-09-23）

- HEAD：`e527fec`（refactor: reorganize game/src into 8 domain directories）
- 配置：`搜打撤/eslint.config.js`（flat config，eslint@10.11.0）
- 规则起点：`@eslint/js` recommended 全量内联（eslint@10 已不自带 `@eslint/js`/`globals` 包，为不加依赖从上游原样拷贝）；仅正确性规则，无任何 stylistic/格式类规则
- 全局声明：浏览器全局（window/document/Storage/Path2D 等）、Node 全局（process 等）、项目全局（`SDT`、`sdtDesktop`、`__BUILD_VERSION__`）
- 命令（在 `搜打撤/` 下执行）：

```
node node_modules/eslint/bin/eslint.js game/src tests
```

## 总量

| 指标 | 数值 |
| --- | --- |
| lint 文件数 | 286（game/src 200 + tests 86，含 game/src/generated 3 个生成文件） |
| 有报错文件数 | 78 |
| **错误** | **493** |
| **警告** | **0** |
| 解析崩溃 | 0 |

本报告为只读基线，**未修复任何源文件问题**。

## 按规则分组计数（top 10，实际共 8 条规则命中）

| # | 规则 | 数量 | 成因（1 句） | 修复顺序建议 |
| --- | --- | --- | --- | --- |
| 1 | no-unused-vars | 442（392 定义未用 + 50 赋值未用） | 模块重组与多轮迭代留下的死 import、死变量和只写不读的赋值；测试里常见“为触发副作用而 import” | 最后清。量大且需要口径决策：先删确定性的死 import/死变量，函数参数类用 `argsIgnorePattern` 或保留声明约定处理；动手前确认不是刻意保留的 API 面 |
| 2 | no-empty | 29（全部为空块语句） | `catch {}` 或占位空块，无注释说明意图 | 倒数第二。逐个补注释或真实逻辑，机械但需逐处判断是否有意吞错 |
| 3 | no-undef | 6 | **真实缺陷候选**：跨模块引用了别的文件的局部变量（见下方明细），走到对应路径会 ReferenceError | **最优先**。疑似 e527fec 目录重组拆分时的遗漏，人工确认后补 import/提升作用域 |
| 4 | no-useless-escape | 6 | 字符类/正则里转义了不需要转义的字符（`\-`、`\"`），无行为影响 | 低成本顺手修，但要确认不改变正则语义 |
| 5 | no-useless-assignment | 5 | 变量被赋值后未读即被覆盖/离开作用域（`raw`/`ok`/`inRun`/`hp`），多为容错兜底写法残留 | 随 no-unused-vars 一起清，先确认不是“防御性初始化” |
| 6 | no-constant-condition | 3 | 测试补桩刻意写 `if (true)` / `if (!x \|\| true)` 强制启用桩 | 测试文件内修：简化条件为语义化开关，或加行内 eslint-disable 注释说明故意性 |
| 7 | no-dupe-else-if | 1 | `battle.engine.js:2467` 的 else-if 链条件与前面分支重复，该分支永不执行 | 第二优先。死分支背后常是漏写新条件的逻辑错误，需人工核对意图 |
| 8 | no-regex-spaces | 1 | 正则里连写多个空格（`run-architecture.test.js:24`），难数且易错 | 改成 `{2}` 量词，一行修复 |

### no-undef 明细（建议人工确认）

| 位置 | 标识符 | 现象 |
| --- | --- | --- |
| `game/src/battle/battle.enemy-phase.js:295` | `cardAnims` | 直接 push 该数组，但它是 `battle.runtime.js` 的导出，本文件未 import |
| `game/src/battle/battle.layers.js:282,284` | `discoverSrcRect` | 引用的是 `battle.view.js` 的模块内局部变量（本文件未定义未导入），读+赋值 |
| `game/src/battle/battle.view.js:122` | `renderDeckPileView` | 调用了本文件不存在的函数 |
| `game/src/hub/game.bag.js:739,740` | `closeCardZoom` | 函数定义在 353 行的内层作用域，739/740 的作用域取不到 |

## 按目录分布（按错误数降序）

| 目录 | 错误 | 涉及文件 |
| --- | --- | --- |
| game/src/battle | 245 | 16 |
| game/src/hub | 75 | 11 |
| game/src/cards | 43 | 6 |
| tests | 37 | 27 |
| game/src/core | 36 | 7 |
| game/src/audio | 24 | 2 |
| game/src/ui | 16 | 3 |
| game/src/run | 12 | 5 |
| game/src（根文件） | 5 | 1 |
| game/src/generated | 0 | 0（生成清单文件干净） |

## 推荐的推进顺序

1. **no-undef（6）** —— 唯一可能运行时崩溃的一类，先人工确认修复。
2. **no-dupe-else-if（1）** —— 死分支，可能掩盖逻辑错误。
3. **no-constant-condition（3）+ no-regex-spaces（1）+ no-useless-escape（6）** —— 低风险机械修，一轮清完。
4. **no-empty（29）+ no-useless-assignment（5）** —— 需逐处判断意图，量小。
5. **no-unused-vars（442）** —— 占总数 90%，最后统一定口径再批量清。

## 附：运行方式

```
cd 搜打撤
node node_modules/eslint/bin/eslint.js game/src tests          # 终端报告
node node_modules/eslint/bin/eslint.js game/src tests -f json  # JSON（供工具聚合）
npm run lint                                                    # 同终端报告（已加 script）
```
