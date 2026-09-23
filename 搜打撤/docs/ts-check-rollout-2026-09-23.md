# JSDoc `// @ts-check` 渐进类型化方案（2026-09-23）

- 状态：试点完成，方案待老板批准扩容
- HEAD：e527fec（game/src 八域目录重构）
- tsc：`node_modules/typescript/bin/tsc`，版本 **7.0.2**（tsgo 系）
- 试点配置：`搜打撤/jsconfig.json`（本批次新增）
- 试点文件：`game/src/run/map-graph.js`、`game/src/cards/mech-sentences.js`（各加 `// @ts-check` + JSDoc，纯注释）
- 试点测试：`tests/map-connectivity.test.js`（4 用例）、`tests/mech-sentences.test.js`（21 用例）

## 一、阶段计划

| 阶段 | 内容 | 通过标准 | 状态 |
|---|---|---|---|
| P0 试点 | 零依赖双试点 + 窄 jsconfig | tsc 零错误、原测试全绿、diff 纯注释 | **已完成（本文档）** |
| P1 窄配置固化 | jsconfig include 保持个位数文件；每域先挑 1-2 个零依赖或"依赖已类型化"文件 | 同上 | 待批准 |
| P2 逐域扩大 | 顺序：core → cards → run → hub/home → ui → battle/audio 最后 | 每扩 1 批跑一次该批相关测试 + tsc；禁止一次 include 超过 ~10 个新文件 | 未开始 |
| P3 基础设施 | 新增 `types/globals.d.ts` 声明 `window.SDT`（需老板点头，见 §四-1）；battle/audio 热区最后收口 | tsc 全仓 exit 0（或明确豁免清单） | 未开始 |

铁律（沿用试点验证过的做法）：
1. **每批只 include 已通过验证的文件**，严禁直接 include 全仓或整个域目录（报错海啸，探针实测见 §四-2）。
2. **试点文件只做注释级改动**：加 `// @ts-check`、`@typedef/@param/@returns/@type`；不改表达式、控制流、导出。收口证据 = `git diff` 纯新增（0 删除）+ 相关测试改前改后双绿。
3. **依赖先行**：某文件的 import 依赖未类型化时，要么先批注依赖，要么该文件不入批。checkJs 会沿 import 链（含二跳）把 JS 拖进检查并报错（探针实测）。

## 二、试点全过程结果

### 2.1 候选清单（P0 评选，行数/import 依赖为 HEAD e527fec 实测）

| 候选 | 行数 | import 依赖 | 判定 |
|---|---|---|---|
| `run/map-graph.js` | 64 | 0 | **入选**：纯函数连通性检查；`tests/map-connectivity.test.js` 直接覆盖 |
| `cards/mech-sentences.js` | 33 | 0 | **入选**：纯数据表（正则+模板函数）；`tests/mech-sentences.test.js` 直接覆盖 21 用例 |
| `core/random.js` | 80 | 1（sdt-facade） | 落选→**下一批首位**：本来是首选，但 import 链拖入 sdt-facade 报 SDT 全局 2 错（§四-1）；老板 2026-09-23 拍板推迟 |
| `core/event-bus.js` | 64 | 2（sdt-facade、diagnostics.local） | 落选：二跳依赖 diagnostics.local 实测 checkJs 下 8+ 个 implicit-any 错（§四-2） |
| `core/performance-budgets.js` | 19 | 0 | 落选：纯常量、无任何测试直接引用，试点证明力弱 |
| `cards/cards.consts.js` | 42 | 0 | 落选：纯常量，仅被测试间接 import，证明力弱（可搭下一批顺风车） |
| `run/encounter-selector.js` | 23 | 0 | 落选：仅 23 行太小；有 r7a-encounter-selector.test.js，可作第二批凑数 |
| `run/map-snapshot.js` | 147 | 1（layeredMap） | 落选：体量偏大且依赖 layeredMap 未类型化，会连锁拖入 |
| `cards/card-rules.schema.js` | 381 | 0 | 落选：零依赖但 381 行，typedef 工作量大，放第三批 |
| `core/motion.js` | 75 | 2（sdt-facade、外部包 motion/mini） | 落选：依赖外部 npm 包，需要"第三方类型来源"口径（§四-4） |

避让约束：battle/ 与 audio/ 域（最热区）本批不碰，候选清单也未从中挑选。

### 2.2 jsconfig.json（全文）

```json
{
  "//": "渐进类型化试点配置（2026-09-23）：checkJs 只覆盖试点文件，严禁扩大 include 到全仓——会引发报错海啸。扩容流程见 docs/ts-check-rollout-2026-09-23.md。",
  "compilerOptions": {
    "target": "esnext",
    "module": "esnext",
    "moduleResolution": "bundler",
    "lib": ["esnext", "dom"],
    "checkJs": true,
    "strict": false,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": [
    "game/src/run/map-graph.js",
    "game/src/cards/mech-sentences.js"
  ]
}
```

要点：
- `checkJs: true` + 窄 include：只在试点文件上启用检查。
- `strict: false` 必须显式写：tsc 7.0.2 对新配置默认更严（探针实测不加 strict 时，JS 文件里无法推断的参数直接报 TS7006/TS7034，等同 noImplicitAny 开启）。
- `lib` 含 `dom`：`sdt-facade.js` 等模块使用 `window`，无 dom lib 会连 `window` 都找不到。

### 2.3 运行命令与输出（全部在 `搜打撤/` 下执行）

tsc 调用方式（注意：tsc 7.0.2 的 `-p .` 只找 tsconfig.json，**不会自动回退到 jsconfig.json**，必须显式给文件名）：

```
node node_modules/typescript/bin/tsc --noEmit -p jsconfig.json
```

| 步骤 | 结果 |
|---|---|
| 基线测试（改前） | `node node_modules/vitest/vitest.mjs run tests/random.test.js tests/map-connectivity.test.js --no-file-parallelism` → 2 文件 9 用例全绿；`tests/mech-sentences.test.js` → 21 用例全绿 |
| tsc 基线（加 JSDoc 之前，仅配置） | **exit 0，零错误** |
| tsc 改后（`// @ts-check` + JSDoc 之后） | **exit 0，零错误**，无任何输出 |
| 测试改后 | `tests/map-connectivity.test.js` + `tests/mech-sentences.test.js` → **2 文件 25 用例全绿**（4 + 21） |
| 纯注释证明 | `git diff --stat`：两文件 **37 insertions(+), 0 deletions(-)**；过滤后新增行中唯一非注释行是 1 个空行；删除行 0 —— 无任何代码行被修改或移除 |

注：早期（试点还含 `core/random.js` 时）tsc 实测输出，作为 §四-1 的证据留存：

```
game/src/core/sdt-facade.js(10,55): error TS2339: Property 'SDT' does not exist on type 'Window & typeof globalThis'.
game/src/core/sdt-facade.js(10,68): error TS2339: Property 'SDT' does not exist on type 'Window & typeof globalThis'.
```

### 2.4 试点文件改动摘要

- `game/src/run/map-graph.js`（+17 行）：头部 `// @ts-check`；新增 `@typedef MapLayer`（logical/doors/altarEntrances/entrances，未生成字段一律可选）；`buildAdjacency` 补 `@param/@returns`（adj/key 的结点键口径 `'li,idx'`、中央 `'-1,0'`）；`checkConnectivity` 既有 JSDoc 补一行 `@param`。
- `game/src/cards/mech-sentences.js`（+20 行）：头部 `// @ts-check`；新增 `@typedef MechItem`（k/label/icon/tpl/sen/cnt?/max，cnt 省略=不读次数）与 `@typedef MechGroup`；`MECH_GROUPS` 标 `@type {MechGroup[]}`、`MECH_ALL` 标 `@type {MechItem[]}`。

## 三、下一批候选（P1 建议清单，均不在 battle/ audio/）

1. `core/random.js`（80 行，1 依赖）——需先解决 SDT 口径（§四-1 三选一）；有 `tests/random.test.js`（5 用例）直接覆盖。
2. `core/performance-budgets.js`（19 行，0 依赖）——常量批注收益低但零风险；无直接测试，验收用 node 直调冒烟对比。
3. `cards/cards.consts.js`（42 行，0 依赖）——同上，7 个测试文件间接 import 可作回归。
4. `run/encounter-selector.js`（23 行，0 依赖）——`tests/r7a-encounter-selector.test.js` 直接覆盖。
5. `core/event-bus.js`（64 行，2 依赖）——前提：先批注 `diagnostics.local.js`（有 `tests/diagnostics.local.test.js`），或该文件先挂 `@ts-check` 并补参数类型。
6. （可选）`run/map-snapshot.js`（147 行，1 依赖 layeredMap）——先评估 layeredMap 批注成本再定。

每批验收标准（给执行者）：tsc `-p jsconfig.json` 零错误且 exit 0；该批文件的相关测试改前改后双绿；`git diff` 纯新增注释；不改任何表达式/控制流/导出。

## 四、已知局限与处理口径

1. **SDT 全局（`window.SDT`）**：`sdt-facade.js` 是全项目唯一 `window.SDT` 挂载点（contracts.test.js 强制），仓库无任何 `.d.ts`。checkJs 沿 import 链检查到它时报 2 个 TS2339（输出见 §2.3）。可选口径：
   - a. 新增 3 行 `types/globals.d.ts` 声明 `interface Window { SDT: Record<string, unknown> }` 并入 jsconfig include（标准做法，需老板点头——超出本批"允许新增"清单，故未实施）；
   - b. 含 sdt-facade 依赖的文件暂不入批，等口径确定；
   - c. 临时容忍 2 错并按文件过滤输出（不推荐：exit 1 会淹没 CI 信号）。
   本批按老板拍板采用 b（试点避开依赖链），random.js 批注进入下一批的门槛是 a/b 择一。
2. **import 链会拖入未 include 的文件**：checkJs 下被 import 的 JS 全部进入编译程序并报错（含二跳）。探针实测：以 `core/event-bus.js` 为入口 checkJs，`diagnostics.local.js` 冒出 8+ 个 TS7006/TS7019/TS7034 implicit-any 错。口径：入批前先沿 import 闭包做"依赖体检"（临时把候选文件放进 include 跑一次 tsc 即可），依赖未类型化就先批注依赖或推迟该文件。
3. **tsc 7.0.2 默认更严**：探针实测 CLI `--checkJs` 下 JS 文件里无法推断的参数直接报 TS7006（等价 noImplicitAny 打开）；jsconfig 必须显式 `strict: false` 压住，随后按批逐步收紧。
4. **外部包类型**：`core/motion.js` 等依赖 npm 包（如 motion/mini）。口径：优先查包内自带 d.ts；无类型则该文件暂缓，不引入 @types 新依赖（需单独决策）。
5. **动态 `import()`**：game/src 有 5 个文件使用动态 import（`r7a.qa.js`、`battle/battle-loader.js`、`battle/battle.frames.js`、`home/narrative.js`、`hub/game.hub.js`）。动态 import 的目标同样会被拖入 program 参与检查。口径：与静态 import 同策（依赖体检先行）；这 5 个入口文件在 battle/audio 收口前不入批。
6. **`-p` 不会自动找 jsconfig**：tsc 7.0.2 `tsc -p .` 只找 tsconfig.json；统一用 `tsc --noEmit -p jsconfig.json`。若未来仓库出现根 tsconfig.json，需防其抢走 `-p .`。
7. **vite/vitest 不受 jsconfig 影响**：jsconfig 只服务编辑器与 tsc，不参与构建；试点测试在改前后均绿可证。

## 五、本批边界与未动项

- 新增：`搜打撤/jsconfig.json`、本文档。修改：`game/src/run/map-graph.js`（+17）、`game/src/cards/mech-sentences.js`（+20），纯注释。
- 未动：battle/、audio/、tests/、`core/sdt-facade.js`、`package.json`/`package-lock.json`（后者有并行会话未提交改动，本会话未触碰）。
- 未做：git commit/push（未获指示）；`NEXT-AI-HANDOFF-2026-09-20.md` 未更新（本任务硬边界禁止改动其他既有文件，交接状态由本节代述）。
- 未核实项：无。
