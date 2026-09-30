# Agent 接口协议（SDT.Agent v1）

> 让大模型 / 外部脚本以纯接口驱动《搜打撤》全链路：读结构化状态 JSON → 回动作 JSON，
> 不识别画面、不模拟鼠标。挂载点 `window.SDT.Agent`（`game/src/agent/`）。
> 快进开关 `SDT.Agent.setTurbo(true)` 跳过全部演出等待（只跳演出不跳逻辑判定）。

## 一、决策循环

```js
// 由当前平台已授权的内置浏览器接口驱动；这是业务接口示例，不授权外部 CDP 验收。
SDT.Agent.setTurbo(true);
for (;;) {
  // step 等待异步命令的真实结果，再等待局面静止。
  const result = await SDT.Agent.step(decide, { commandTimeoutMs: 20000 });
  if (result.done || result.stopReason || result.error) break;
}
```

内置一步流 `SDT.Agent.step(decide)` = 观察→决策→执行→等稳；
`SDT.Agent.autoRun({ decide, maxSteps })` 连续驱动一局。
内置策略 `SDT.Agent.policies.greedy()` / `.random()` 返回 decide 函数，可直接用或作参照。

## 二、observe() 状态 JSON

```jsonc
{
  "ok": true,
  "settle": true,                 // 局面是否静止可决策
  "phase": "title|hub|map|moving|overlay|battle|extraction|settlement|nest|devconsole|idle|boot",
  "turn": 12,
  "run": {                        // 对局进行中才有
    "active": true, "mode": "standard",
    "hp": 30, "maxHp": 50, "coins": 5, "atk": 4,
    "layer": 2, "node": 7,        // 层（1 起）/ 脚下格索引
    "class": "战士", "characterId": "heixiang", "bossKilled": false,
    "inventory": [{ "name": "木材", "count": 2, "value": 1 }],
    "ownedCards": [{ "uid": "u3", "name": "江湖救急", "type": "事件", "rarity": "稀有", "safe": false }]
  },
  "battle": {                     // phase === 'battle' 才有
    "turn": 3, "energy": 2, "maxEnergy": 2, "busy": false,
    "player": { "hp": 30, "maxHp": 50, "atk": 4, "status": {} },
    "foes": [{ "i": 0, "id": "wolf", "name": "荒狼", "hp": 12, "maxHp": 12, "atk": 3,
                "intent": { "type": "attack" }, "status": {}, "dead": false }],
    "hand": [{ "uid": "u1", "name": "初始攻击", "cost": 1, "type": "武术", "dmg": 1, "desc": "…" }],
    "piles": { "draw": 3, "discard": 2, "grave": 0 },
    "pendingTarget": null,        // { uid, name } = 等待选择目标
    "choosing": null, "discovering": null, "handSelecting": null, "infusing": null,
    "deckSelection": null,        // BOSS 战前选牌堆
    "potions": [], "equipped": []
  },
  "ui": { "open": true, "title": "触发事件【…】", "actions": [ /* 见下 */ ] },
  "actions": [ /* 全部可行动作：ui + move + battle + sys 合流，每条带 id */ ]
}
```

## 三、动作 JSON（四型）

| 型 | 形状 | 语义 | 走的命令面 |
|---|---|---|---|
| `ui` | `{ "type":"ui", "name":"evtChoice", "params":{ "i":"0" } }` | 点当前弹层按钮（事件选项/商店/宝箱/撤离整理/选角…） | `UI._acts[name](dataset)`（与点击同源） |
| `move` | `{ "type":"move", "li":1, "idx":4 }` | 移动到相邻节点 | `moveTo(li, idx)`（引擎内校验合法性） |
| `battle` | `{ "type":"battle", "name":"playCard", "args":["u1", 0] }` | 战斗命令 | `SDT.Battle.commands[name](...args)` |
| `sys` | `{ "type":"sys", "name":"startGame" }` | 链路控制：`startGame`（标题起步）/ `reenter`（重开脚下格）/ `noop` / `discardCard [卡名]`（**背包满腾格直接丢弃**，经 game.discardCard，绕过拖拽 UI） | 会话入口 |

`act()` 保持同步，返回可 JSON 序列化的结果：

- 同步命令返回 `false` 或 `{ ok:false, code, message }` 时明确拒绝；结构化业务错误保留 code/message。
- 同步命令返回 `true`、`void` 等旧返回值时保持兼容；异常转为 `ACTION_THREW`，不向调用方抛出。
- Promise 命令立即返回 `{ ok:true, id, async:true, completed:false }`。这只表示受理，**不表示完成或已经持久化**；结果不包含 Promise。
- `step()` 内部等待该次命令完成，最终 `res` 包含 `async:true, completed:true` 和真实的 `ok`。Promise 拒绝也归为失败；不能通过 `await act()` 或仅 `waitSettle()` 等待命令完成，应使用 `step()` / `autoRun()`。
- 命令超过 `commandTimeoutMs`（默认 20000 毫秒）后返回 `COMMAND_TIMEOUT`，`completed:false`，`autoRun` 以 `command-timeout` 停止。超时不会取消底层命令，不应立即重派同一动作。
- 异步决策或命令完成时会核对档位和对局身份；旧局结果以 `CONTEXT_CHANGED` / `context-changed` 停止，旧失败不会写入新页面的失败记忆。
- `ui:enterSlot` 合法续档或进入基地会更换归属，因此由菜单在完成瞬间交回内部凭据；Agent 核对目标档位和当前身份后接受。该凭据不出现在公开结果中，其他命令不能借它跳过旧局校验。

动作形状或路由校验失败不会执行命令。业务命令自身抛错或拒绝前可能已经产生部分副作用，返回失败不承诺自动回滚或可以无条件重试。

### 战斗命令速查（args）

- `playCard [uid]`：打出（无目标卡直接结算；指向卡进入待选目标态）
- `playCard [uid, 敌人下标]`：指向敌人直接结算；`playCard [uid, "self"]` 指向自己
- `playDirect [uid]`：跳过注能直接打出（注能态的正出口）
- `endTurn []` / `flee []`；`pickChoice [i]` / `pickDiscover [i]`；`pickHandSelect [uid]` / `skipHandSelect []`
- `selectDeckCard [uid]` / `confirmDeck []` / `cancelDeck []`（BOSS 编组）
- `usePotion [uid]` / `useItem [uid, 侧]`（侧=敌人下标或 "self"）/ `openBag []` / `cancelPendingTarget []`
- `bagSlam []`：**背包砸击**（2 费 · 4 点固定伤 · 不吃手牌）→ 进入选目标态后 `resolveSlam [i]`，`cancelInteraction []` 退出
- `resolveDart [i]`：血毒双镖第二镖（dartPending 态的出口）
- `useEquipSkill [装备uid]`：**装备主动技能**（observe.battle.equipped 含 uid/used/passive）
- 挂起态出口：`slamPending`/`dartPending`/`pendingItem` 在 observe 有布尔标记，actions 会自动回填目标选择与 cancel

### 观察面补充（09-26 批）

- `run.bagCap`：背包容量（与 ownedCards.length 对比判断是否满——满时 actions 给出 `sys:discardCard` 丢弃清单）
- `battle.equipped`：`{uid, name, used, passive}`；`battle.ownItems`：背包战斗道具（useItem 的 uid 源）
- `battle.potions`：药水快速栏；`battle.player.armor`：当前护甲
- 弹层 `label` 上限 48→120 字符（事件选项的收益/风险在 label+detail 里）
- 地图 `move` 无前进偏见：回走/回层是合法战术，顺序由价值分驱动；仅「刚离开的格子」防振荡

### 弹层动作怎么识别

`observe().ui.actions`（或合流的 `actions`）里每条带 `name`（data-act）、`params`（按钮 dataset）、
`label`（按钮文案）与 `id`。决策方按语义选一条回给 `act()` 即可；页面上没有的动作会被拒
（`UI_ACTION_UNAVAILABLE`），防止调用到已翻页的残留回调。

## 四、快进与计时

- `SDT.Agent.setTurbo(true)`：战斗演出等待、移动动画、节点过场、搜索揭晓、通关演出全部短路；
  一局（贪心策略）实测秒级。持久化在 localStorage `sdt-agent-turbo`。
- `waitSettle({ quietMs, timeoutMs })`：局面签名连续不变且战斗非 busy 才返回；超时返回
  `{ ok:false, stalled:true, obs }`，绝不无限挂起。
- 两分钟预算：纯策略全链路远低于 2 分钟；LLM 决策延迟取决于模型与网络（决策点约 30–80 个）。

## 五、配套模块（game/src/agent/）

| 文件 | 职责 |
|---|---|
| `agent.protocol.js` | 动作 schema 校验 / 稳定 id（纯模块，Node 可直接 import） |
| `agent.state.js` | observe() 状态组装（game + 战斗快照 + 弹层动作面） |
| `agent.surface.js` | 弹层 data-act 动作面扫描（零侵入，不改页面代码） |
| `agent.runner.js` | act 路由 / settle 等待 / step / autoRun |
| `agent.policy.js` | 内置随机 / 贪心策略（统计基线） |
| `agent.turbo.js` | 快进总闸（battle.clock / moveTo / 过场共用） |
| `agent.llm.js` | 内置 OpenAI 兼容适配器（见下） |
| `agent.recorder.js` / `agent.stats.js` | 逐局记录与聚合统计（数据分析系统） |

## 六、内置 LLM 适配器

控制台「Agent」页配置（localStorage `sdt-agent-llm`，不进 git）：

```json
{ "baseUrl": "https://api.example.com/v1", "apiKey": "sk-…", "model": "…", "temperature": 0.2, "maxTokens": 800 }
```

`SDT.Agent.llmDecide()` 即 decide 函数：把 observe 精简投影 + 动作清单发给
`POST {baseUrl}/chat/completions`（OpenAI 兼容），要求回严格动作 JSON；
解析失败 / 动作非法带错误重试（≤3 次），再失败退化为安全动作（跳过/确认），不卡死循环。

## 七、批量与统计

- Node 无头批量：`npx vite-node game/tools/agent-batch.mjs --runs 100 --policy greedy [--mode nest] --out output/agent/`
  （jsdom 引擎，7-17s/局，产 runs.jsonl 逐局记录 + summary.json 汇总；vite-node 负责 src 内 JSON import 转换）。
- 游戏内数据页（控制台「数据」页签或 Alt+9）：通关率 / 撤离率 / 死亡层分布 / 带出卡牌价值等聚合，
  支持 JSON/CSV 导出；人类玩家的对局同样入账（driver=human）。

## 八、控制台四页签与页面快捷键（2026-09-25）

- **开发者控制台**（Ctrl+L，任意界面可开）四页签：
  - 调试：原有资源/发卡/战斗调试（写操作仅在对局/战斗中生效）；
  - Agent：LLM 配置（baseURL/key/model 仅存本机）、快进开关、贪心/随机/LLM 自动跑局启停、observe 预览刷新；
  - 数据：跑局统计面板（切片口径同上）+ 导出/清空；
  - 快捷键：全页面跳转一览 + 当前合法性 + 点击直达。
- **页面快捷进入键**（Alt+数字，`game/src/ui/quick-nav.js`）：

  | 键 | 页面 | 键 | 页面 |
  |---|---|---|---|
  | Alt+1..6 | 基地 出发/仓库/商店/升级/人物/成就 | Alt+7 | 卡牌库·照相馆 |
  | Alt+8 | 留言信箱 | Alt+9 | 跑局数据 |
  | Alt+0 | 设置 | Ctrl+L | 控制台 |
  | B | 背包（既有） | Esc | 关弹层（既有） |

  战斗中/对局中的受保护页面会拒绝进入并日志提示，不绕过既有状态守卫。

## 九、验收剧本（SDT.Agent.scenes，2026-10-01）

固定验收剧本库：把「实机验收逐步驱动」压成一次调用。每个场景 = 前置 + 自动驱动 +
内建断言，跑完返回结构化报告（pass / assertions / final / errors），剧本断言 JSON +
关键页截图合并构成 B 档实页证据（口径见 quality-gates）。

```js
SDT.Agent.scenes.list()                    // 场景清单（10 个）
await SDT.Agent.scenes.run('battle')       // 短场景：直接 await 拿报告
SDT.Agent.scenes.start('fullrun', { turbo: true })   // 长场景：后台启动
SDT.Agent.scenes.status('fullrun')         // 轮询 { started, done, report }
```

| 场景 | 语义 | 前置 |
|---|---|---|
| smoke | 标题真实开局→走格→打完首战 | 须在标题页 |
| battle / boss / shop / event / fire / altar / chest | 单场景验收 | dev 直跳测试局（不占档位、不写存档） |
| extract | 开局→（直跳第三层）BFS 逐格走到紧急撤离点→献祭 3 卡→撤离结算 | 自动开局，options.fullWalk 走全图 |
| fullrun | strategic 打到撤离或死亡，断言自然收口+记录落盘 | 自动开局，默认 turbo |

外部 evaluate 只有 3s 级预算：短场景可 `JSON.stringify(await run(...))` 一次取回；
长场景必须 start+status 分体（`scripts/iab-drive.mjs` 的 `runScene(tab, scene)` 已封装，
含 PAGE_RELOADED 感知）。场景间前置自动清场（搜刮/教学弹层残留会污染断言）；
`[SDT.Icons] missing bitmap` 预热告警不入报告错误桶。坑全录：
`docs/evidence/2026-10-01-acceptance-scenes/README.md`。
