# 实机验收剧本库（WF-acceptance-scenes）证据 · 2026-10-01

任务：把「agent 打开内置浏览器实机游玩验收」固化为固定剧本工具（老板拍板四项：
页面内剧本库 API、全场景、iab-drive 收编纳管、剧本 JSON+截图合并算 B 档实页证据）。

## 交付物

| 文件 | 说明 |
| --- | --- |
| `game/src/agent/agent.scenes.js`（新增） | 10 个固定验收剧本：前置+驱动+断言+报告 JSON |
| `game/src/agent/agent.js` | 门面装配 `SDT.Agent.scenes`（run/start/status/list，仅 3 行） |
| `tests/agent-scenes.test.js`（新增） | 定向测试 4 项，jsdom 全量启动链跑 battle/shop 场景 |
| `scripts/iab-drive.mjs`（收编） | owner 归属+`runScene`/`scenesList` 一行式（PENDING #21 销账） |

## 验证结果

### jsdom 定向（tests/agent-scenes.test.js，同源逻辑链）
4/4 passed：清单完整、UNKNOWN_SCENE 拒绝、battle 场景（测试局直跳+打完+战斗计数）、
shop 场景（开店+策略收口）。

### 实机（ZCode 内置浏览器，dev server 5345 隔离端口，turbo 快进）

| 场景 | 结果 | 耗时 | 关键断言 |
| --- | --- | --- | --- |
| battle | ✅ pass | 21.6s | 战斗计数 0→1，hp=25 sane，7 步 until 收口 |
| smoke | ✅ pass | 26.3s | 标题真实开局→选角→出发→走格→首战完，hp=35/coins=1 |
| shop | ✅ pass | 50.3s | 商店页打开→策略买卖→收口回 map |
| chest | ✅ pass | 3.1s | 宝箱页收口（清场补丁后） |
| fire | ✅ pass | 25.6s | 火堆完成回 map |
| event | ✅ pass | 0.7s | 事件页 seen→greedy 点穿分支→收口（seen 判定修复后） |
| altar | ✅ pass | 10.4s | 祭坛仪式完成回 map |
| extract | 🟡 机制全通，收口受阻 | ~5s/局 | 跳层✓ BFS✓ 战斗✓ 死亡收束✓——卡宝箱多箱队列（坑 8，#26） |
| boss / fullrun | ⏸ 未单独实机 | — | boss 与 battle 同模板；fullrun 与 extract 同链路依赖，随 #26 一并收口 |

视觉证据：`iab-battle-reward.png`——battle 剧本实机打完一场战斗后的战利品页
（获得卡牌「急行军」，左侧第一层地图进度 3/16），证明剧本走的是真实 UI 链路。

### extract 长链路的过程收获（每一步都实机验证过）

跳第三层入口（等真正进图后再跳，否则 newRun 完成时重置回出生点）→ BFS 逐格
真实 moveTo 导航（实测从层首走到 node11/离撤离点一格）→ 途中战斗完整打完
（15 步正常出牌循环）→ 死亡时「撤离失败」结算页正常收束。剩余卡点只有坑 8
的宝箱弹层队列，已挂 PENDING #26。

## 过程坑记录（均已修复在代码）

1. **devForceBattle 是 async 而 devJumpNode 不等它**——开战类场景必须自等就绪
   （`awaitReady` 轮询 `game.battleActive`），否则 autoRun 在接敌过场空转 18 步
   spin 熔断（实测 193ms 假完成）。
2. **IAB routine evaluate 有 3s 级上限**——长场景不能一次 await 到底。改为
   `start`（页面内后台跑，报告落 Map）+ `status`（轮询取报告）分体，`run` 是包装。
3. **场景间弹层残留污染**——battle 收口停在战后搜刮/首胜教学页，下个场景的
   seen/until 被假动作骗过（chest 实测 188ms 假通过）。修复=前置清场稳定窗。
4. **清场三连坑**（连环，各自单独修都不够）：
   a. greedy 点不掉「知道了」类教学页（不在它的偏好词表）→ 专用 drainDecide
      （已知收口钮→确认类文案→Esc 链）；
   b. drain 第一步点掉弹层后 decide 返回 null → autoRun 立即 decide-null 收口，
      「连续两次干净」永远数不满 → 干净时返回 noop 等待步；
   c. 教学页在结算异步链尾、上场景完全收口**之后**才弹，waitSettle 在「弹层关着」
      时就放行挡不住 → 墙钟稳定窗：连续 350ms 干净才算清完，窗口内冒出弹层即
      重置并进 drain。
5. **`[SDT.Icons] missing bitmap` 预热告警噪音**——每局十条上下，会淹没真错误；
   报告桶过滤该前缀（图集缺失归 assets:audit / card-art-coverage 管）。
6. **IAB evaluate 挂起会掐死调用 cell**——页面被刷时未显式传 timeoutMs 的
   evaluate 永久 pending。所有 evaluate 显式 `{ timeoutMs: 3000 }` + 轮询循环
   catch 续查（`runScene` 的 PAGE_RELOADED 感知）。
7. **后台标签 timer 节流让 turbo 步进慢 80 倍**（本次最大性能坑）——`defer` 的
   浏览器回退 `setTimeout(0)` 被 Chrome 后台节流钳到 ~350ms/次（实机实测 10 次
   3577ms），autoRun 每步多个 defer 全部吃节流，33 步战斗打了 386 秒。修复=
   `agent.runner.js` 的 defer 浏览器分支改 **MessageChannel 泵**（实机实测 10 次
   1ms，不受 timer 节流），修复后同规模战斗 4.7s——对批跑/控制台自动跑局同样收益。
8. **疑似游戏 bug（挂 PENDING #26）**：宝箱搜刮页多箱队列中 `chestSkip`/`chestTake`
   点击 handler ok 但队列不推进（trace 证据：连点 40 次全空转后 spin 熔断；单箱
   chest 场景正常）。extract/fullrun 的完整收口卡在这，玩家手动点预计同样卡。
9. **共享树 HMR 风暴杀长场景**（当时阻断根因，后审计会话收官自解）——并行会话
   保存 game/src → vite full-reload，页面存活窗口装不下长链路。缓解：短场景趁
   空窗跑；长场景待并行会话收官；混树不 build 是既有铁律。
10. **场景 decide 复用弹层关闭逻辑时小心 drainDecide 的 noop 分支**——它在页面
    关着时返回 noop 等待步，被 `if (d) return d` 拦截会让场景主流程永远轮不到
    （extract 实测 BFS 失联）。独立的 `closeTopOverlayAction`（无 noop）才适合
    「顺路关弹层」的 decide。

## 场景使用速记

```js
// ZCode node_repl（iab-drive 一行式）
const D = await import(pathToFileURL('D:/素材/代号柒/搜打撤/scripts/iab-drive.mjs').href);
const { tab } = await D.openGame('http://localhost:5345/game/index.html');
const report = await D.runScene(tab, 'battle', { turbo: true });   // 报告 JSON
await nodeRepl.emitImage(await D.shot(tab));                        // 视觉证据

// 或浏览器 console / evaluate 直调
await SDT.Agent.scenes.run('smoke');          // 短场景可直接 await
SDT.Agent.scenes.start('fullrun');            // 长场景 start+status 分体
SDT.Agent.scenes.status('fullrun');
```

验收动作序列（替代旧逐页驱动）：起服 → 开页 → `runScene` → 报告 JSON 落本目录 +
关键页截图 1–2 张。几十次工具往返压到 3–4 次。
