# 01 · 架构地图（Unity 移植侦察报告）

工程根：`D:\素材\代号柒\搜打撤`（package.json 在这里，游戏源码在 `game/` 下），游戏页面 `game/`，源码 `src/`（44 个）+ `src/scene/`（9 个）+ `src/generated/`（1 个）= **54 个模块，共 11,952 行 JS**。另有 `selftest.js`（零依赖命令行自测脚本）。

## 1. 入口链与 window.SDT 组装

- `index.html`（244 行 DOM 骨架：侧栏面板 + `<canvas id="game">` + 各 overlay）→ 末尾唯一 `<script type="module" src="./src/main.js">`。
- `src/main.js`（41 行）**只做 import，无逻辑**，按顺序加载全部模块，加载顺序即初始化顺序。顺序：random → rules → mapData → art → icons-bitmap → sound → camera → motion → notes → cards → combat → base → meta → render-scheduler → renderer.fx → **renderer**（2D 面板，3D 的 `scene/runtime.js` 已被注释停用）→ ui → shared → battle.effects → battle.core → battle.view → chests → game.storage → game.store → game.session(core) → game.run → game.hub → game.bag → game.notes → game.cardslib → game.boot。
- 双轨暴露：**老模块走 `window.SDT.*` 命名空间**，**新模块走 ESM export**。挂的键：
  - random→`SDT.Random`；rules→`SDT.RULES`；mapData→`SDT.MAP`；art→`SDT.Art`；sound→`SDT.Sound`；camera→`SDT.Camera`；motion→`SDT.Motion`；notes→`SDT.Notes`；cards→`SDT.Cards`；combat→`SDT.Combat`；base→`SDT.Base`；meta→`SDT.Meta`；render-scheduler→`SDT.RenderScheduler`；renderer.fx→`SDT.FX`；renderer→`SDT.Renderer`；ui→`SDT.UI`；battle.view→`SDT.Battle`；chests→`SDT.Chests`；game.session→`SDT.game`（全局单例！）；game.store→`SDT.GameStore`；pixi-effects→`SDT.VisualFX`。
- `ui.js` 在 boot 前加载并定义 `SDT.UI`（DOM 刷新器），`shared.js` 把它再导出为 `UI`。真正的启动逻辑在 `game.boot.js` 尾部：DOMContentLoaded 里 resize → 建 Camera → buildDerived → 绑输入 → `showTitle()` → `requestAnimationFrame(loop)`。

## 2. 逐模块清单（54/54）

格式：文件（行数）| 职责 | 导出 | 依赖（本项目）。带 ◆ 的使用全局 `SDT.*`/`UI`（依赖加载顺序，未走 import）。

**src/ 根（44）**
| 模块 | 职责 | 导出 | 依赖 |
|---|---|---|---|
| main.js (41) | ESM 入口，按序加载 | 无 | 全部 |
| random.js (80) | 种子随机服务 | Random, SeededRandomService, generateSeed, setRandomService; SDT.Random | 无 |
| rules.js (42) | 全局数值规则 | RULES; SDT.RULES | 无 |
| mapData.js (305) | 三环棋盘地图数据与格子生成 | SDT.MAP | rules |
| characters.js (33) | 角色表与迁移 | CHARACTERS, characterFor/Name, migrateCharacterProgress/RunCharacter | 无 |
| asset-url.js (14) | 资源 URL 加版本号 | BUILD_VERSION, assetUrl | 无 |
| shared.js (13) | 垫片：SDT/UI 引用 + HTML 转义 | SDT, UI, esc, escAttr | ◆window.SDT.UI |
| art.js (204) | SVG 图标/卡面 HTML 生成 | ROOT, SDT, esc…; SDT.Art | characters, asset-url; ◆SDT.Cards |
| icons-bitmap.js (98) | 位图图标 SVG 库 | MAP, ROOT, SDT…; SDT.Icons(内部) | asset-url |
| sound.js (392) | Howler 音效/BGM 封装 | tone; SDT.Sound | asset-url, random |
| camera.js (50) | 2D 地图相机(pan/zoom/clamp) | SDT; SDT.Camera | ◆SDT.MAP |
| motion.js (32) | motion/mini DOM 弹入动画 | hit, overlayIn, pop, reduceMotion; SDT.Motion | ◆SDT |
| notes.js (28) | 玩家便签存取(localStorage) | KEY; SDT.Notes | ◆SDT |
| cards.js (1089) | **卡牌库全集**：定义/存档/初始化词条回填 | KEY; SDT.Cards | random; ◆SDT.Base/SDT.Art |
| combat.js (426) | 伤害类型/结算纯逻辑 | TYPES, TYPE_NAME; SDT.Combat | random; ◆SDT |
| base.js (334) | 基地：背包/安全仓/出售/扩建 | bagCap, hasSlot, safeCap; SDT.Base | characters, random; ◆SDT.MAP/SDT.Cards |
| meta.js (204) | 进度/成就统计 | SDT; SDT.Meta | characters; ◆SDT |
| render-scheduler.js (41) | 自适应降频绘制调度(60fps/30fps idle) | RenderScheduler, renderScheduler; SDT.RenderScheduler | 无 |
| renderer.primitives.js (65) | Canvas 绘图原语 | circle, drawCover, fillStroke, font, hash2, mixHex, rrect, shade | 无 |
| renderer.icons.js (223) | Canvas 手绘图标/火焰 | drawFlame, drawIcon, drawBitmapIcon | asset-url, renderer.primitives |
| renderer.fx.js (80) | 飘字/脉冲/震屏特效状态与绘制 | FX, shakeOffset, drawFX; SDT.FX | ◆SDT.MAP |
| renderer.js (637) | 2D 棋盘主渲染器（draw 整帧） | SDT; SDT.Renderer.draw | renderer.primitives/icons/fx; ◆SDT.MAP |
| pixi-effects.js (88) | Pixi 粒子爆发（点击反馈） | burstAtElement; SDT.VisualFX | pixi.js, @pixi/particle-emitter |
| narrative.js (42) | inkjs 叙事事件桥 | eventNarrative, parseChoice | inkjs, generated/narrative-events |
| battle.effects.js (245) | 卡牌效果执行器(纯) | createEffectExecutor, splitEffectClauses | 无 |
| battle.rules.js (28) | 出牌合法性/目标侧(纯) | isAreaEffect, targetSideFor, unplayableReasonFor | 无 |
| battle.deck.js (18) | 抽牌堆洗牌/回填(纯) | refillDrawPile, shuffleCards | random |
| battle.core.js (805) | **战斗会话核心**（状态机+命令，无 DOM） | BattleSession, commands, configureBattleRenderer, getSnapshot, start, viewApi; SDT.Battle(经view) | shared, battle.effects/deck/rules, random; ◆SDT |
| battle.view.js (560) | 战斗 Canvas 渲染+DOM 舞台 | render; SDT.Battle | characters, shared, battle.core |
| chests.js (150) | 物资箱掉落(纯) | G, SDT, UI, render; SDT.Chests | random; ◆SDT/UI |
| ui.js (325) | 侧栏/HUD DOM 刷新器 | SDT, UI; SDT.UI | characters, random; ◆SDT |
| game.storage.js (29) | 5 档位 localStorage 存档读写 | OLD_SAVE_KEY, RUN_KEY, RunStorage | characters |
| game.store.js (66) | 对局状态工厂+GameStore | GameStore, createGameState; SDT.GameStore | 无 |
| game.session.js (464) | 会话主逻辑：回合/掷骰/移动/撤离/存档 | FX, MAP, MODES, game, cam, canvas, ctx, dpr, saveGame, startNewGame 等 40+ | shared, game.storage, game.store, game.menu, random; ◆SDT.UI |
| game.core.js (7) | 兼容门面 | `export * from game.session.js` | game.session |
| game.menu.js (581) | 标题/选档/设置页控制器 | createGameMenuController | 无（依赖注入） |
| game.run.data.js (129) | 事件场景元数据/文案 | CLASS_STORY, SCENES, SCENE_META 等 8 | 无 |
| game.run.shop.js (154) | 商店控制器 | createShopController | random, shared |
| game.run.js (901) | **对局主流程**：格子事件/祭坛/叙事/UI流程 | bindRunMixins, roll, openShop, openClassChoice, openAltarModal, showRunTransition | characters, shared, game.core, game.run.data, game.run.shop, narrative, sound; ◆SDT/UI |
| game.hub.js (570) | 基地大本营页面 | openBaseHub, closeBase, deployPick, renderHub | characters, shared, game.core; ◆SDT.UI |
| game.bag.js (592) | 背包 UI | bindBagMixins, showBackpack | shared, game.core, game.run, game.cardslib |
| game.notes.js (219) | 便签/开发者模式/导入导出 | bindDevMode, rebuildNotes, showExportOverlay 等 | shared, game.core |
| game.cardslib.js (553) | 卡牌图鉴/设计师页 | openCardLibrary, cardHTML, Sfx 等 | shared, game.core |
| game.boot.js (318) | 输入绑定+主循环 loop+启动 | resize | 几乎全部 game.* + render-scheduler; ◆SDT |

**src/scene/（9，3D 场景，当前已被停用——main.js 中 runtime 被 renderer.js 替代，~700 行，移植放弃）**
primitives.js (37, three 封装) / atelier.js (106, 材质工坊) / camera.js (12, 3D 相机) / map-scene.js (90) / figures.js (151, 低模角色) / actors.js (87) / architecture.js (109, 建筑) / battle-scene.js (40) / runtime.js (43, 已停用)。

**src/generated/（1）**：narrative-events.js — inkjs 编译产物 JSON（标准 ink 编译 JSON，inkVersion 21），由根目录 `scripts/compile-narrative.mjs` 生成。

## 3. 分层判定（按行数与模块数）

- **A 纯逻辑（可 1:1 平移 C#）：约 17 个模块，约 3,900 行** —— random, rules, characters, mapData, battle.rules, battle.deck, battle.effects, battle.core(805 行无 DOM，最大纯逻辑件), combat, chests, game.store, game.run.data, render-scheduler, asset-url, shared, camera(2D)。cards.js 1089 行半纯（含 localStorage 种子逻辑）。
- **B 渲染场景：6 个活跃模块，约 1,650 行** —— renderer(637), renderer.icons(223), renderer.fx(80), renderer.primitives(65), pixi-effects(88, 仅点击粒子), battle.view(560, Canvas+DOM 混合)。全部 Canvas 2D 手绘，无 Pixi 主渲染。另有已停用 scene/* 9 个（three.js）。
- **C DOM-UI：约 15 个模块，约 4,600 行（最大移植工作量）** —— ui, game.boot(混合), game.menu(581), game.run(901), game.hub(570), game.bag(592), game.notes(219), game.cardslib(553), game.run.shop(154), game.session(少量), base, cards, art, icons-bitmap, notes, meta。
- **D 音频：1 个** —— sound.js (392, Howler)。
- **E 数据生成物：1 个** —— generated/narrative-events.js。
- **F 工具杂项** —— main.js(装配), game.core.js(门面), selftest.js, motion.js(32, DOM 动画)。

## 4. 耦合热点（移植必须先定契约）

1. **game.session.js 导出的 40+ 符号是最热契约**（含全局单例 `game`、`cam`、`canvas/ctx/dpr` 活引用 + `_set_cam/_set_dpr` setter）。被 game.core(门面)→game.run/hub/bag/notes/cardslib/boot 全部依赖。Unity 侧应改为 GameState/GameRuntime 单例类。
2. **game.core.js 是依赖扇入点**：8 个模块 import 它，但它只是 `export * from game.session.js`。**伪循环**靠 `configureGameRuntime(hooks)` 注入打断（game.session 顶部 runtime 占位对象，boot 启动时注入 openClassChoice/openBaseHub/rebuildNotes/resize）——Unity 侧应改成显式事件/接口。存档结构 `createGameState`（game.store.js）+ RunStorage（game.storage.js, key `sdt-save-v2-slot{1..5}`）。
3. **window.SDT 命名空间隐式依赖**：battle.core/cards/base/renderer 等通过 `const SDT = window.SDT` 在加载期读全局。移植时以 ESM import 表为准。
4. **被最多人依赖**：characters.js(8 处)、shared.js 的 esc/escAttr(8 处)、random.js(9 处)、game.core 链(8 处)。无真正模块循环依赖（唯一环被 runtime-hook 注入打断）。
5. 全局特效状态在 `SDT.FX`（renderer.fx，飘字/脉冲/震屏数组，由主循环消费）。

## 5. package.json 生产依赖（根 package.json，v0.51.0）

- **pixi.js ^7.4.3 + @pixi/particle-emitter ^5.0.10**（仅点击粒子 → Unity 自制粒子即可）
- **howler ^2.2.4**（sound.js → Unity AudioSource）
- **inkjs ^2.4.0**（narrative.js → 需 C# ink 运行时）
- **motion ^13.2.0**（仅 32 行 UI 弹动画 → 自写缓动替代）
- **sortablejs ^1.15.7**（拖拽排序 → uGUI 重写）
- **three 0.185.1**（仅 scene/*，已停用 → 忽略）
- 测试链：vitest + jsdom（selftest.js 可作 C# 单测用例来源）。

## 6. 主循环与调度

- 单一 rAF 主循环在 **game.boot.js `loop(now)`**（181–215 行）：**可变步长** `dt = min(0.05, (now-lastT)/1000)`，模拟（game.time/elapsed、镜头跟随 `cam += (target-cam)*min(1,dt*5)`、FX）每帧跑，绘制经 `renderScheduler.shouldDraw()` 降频（active 60fps / idle 30fps，脏标记 invalidate）。Unity 侧对应：`Update`（可变 dt + clamp 0.05）跑模拟，相机 lerp k=dt*5，渲染交给引擎；RenderScheduler 丢弃。
- 相机：camera.js 纯数学 2D 相机（cx/cy/zoom 0.4–2.5、screenToWorld、zoomAt 锚点缩放、clamp 余量 160px）。3D 相机已停用。

## 关键结论

- 分层规模：A 纯逻辑 ~17 模块/~3,900 行；B 渲染 6 活跃/~1,650 行（全 Canvas 2D）；C DOM-UI ~15/~4,600 行（最大工作量）；D 音频 392 行；E ink JSON 1 件。
- 最危险耦合点：game.session.js 的 40+ 导出 + `game` 全局单例 + live-binding setter，以及 window.SDT 加载顺序垫片——移植第一步必须固化成 GameState/GameRuntime 契约。
- SDT.FX 全局特效状态和 configureGameRuntime 的 hook 注入是隐性控制流，Unity 侧改成显式事件。
- 运行库对应：inkjs→C# ink 运行时；howler→AudioSource；pixi/motion/sortablejs/three→表现层重写，无需对应库。
- 3D 场景（scene/ 9 模块 ~700 行）已停用，移植放弃。
