# src/ 模块说明

无构建步骤：`index.html` 按下方顺序以普通 `<script>` 标签加载，模块间通过全局对象
`window.SDT` 通信（各模块挂载自己的命名空间）。**调整代码前先看清依赖方向：越靠前
加载的模块越底层，不得反向引用后加载的模块（除了在事件回调里运行时访问）。**

## 加载顺序与职责

| 顺序 | 文件 | 挂载 | 职责 |
|---|---|---|---|
| 1 | mapData.js | `SDT.MAP` | 三环棋盘数据：格子、门、祭坛、规则参数 |
| 2 | art.js | `SDT.Art` | 位图立绘/卡面图片的路径与装配 |
| 3 | icons-bitmap.js | `SDT.Icons` | `[[icon:x]]` 标记 → 位图图标 HTML |
| 4 | sound.js | `SDT.Sound` | WebAudio 程序化 SFX + 文件 BGM 循环（改曲名需同步 selftest 断言） |
| 5 | camera.js | `SDT.Camera` | 棋盘镜头：平移/缩放/跟随/钳制 |
| 6 | notes.js | `SDT.Notes` | 格子备注的 localStorage 读写 |
| 7 | cards.js | `SDT.Cards` | 卡牌定义/卡面渲染 cardHTML/初始牌播入 |
| 8 | combat.js | `SDT.Combat` | 伤害结算引擎（四类伤害、加成、自测） |
| 9 | base.js | `SDT.Base` | 基地资源（木材/口粮等）按档位存取 |
| 10 | meta.js | `SDT.Meta` | 元进度：游玩时间、成就、解锁 |
| 11 | renderer.js | `SDT.Renderer` | Canvas 棋盘绘制 |
| 12 | ui.js | `SDT.UI` | 通用弹窗 overlay / 日志 / DOM 缓存 |
| 13 | shared.js | （全局） | 共享垫片：`SDT`/`UI`/`esc`/`escAttr` 只在此声明一次；位置必须在 ui.js 之后（`SDT.UI` 挂载后）、battle/game 系列之前 |
| 14 | battle.core.js | `SDT.Battle`(部分) | 战斗逻辑：牌库、出牌结算、词条时点、回合流转 |
| 15 | battle.view.js | `SDT.Battle`(完整) | 战斗渲染：战场 DOM、手牌、指向施法、拖拽预览；末行暴露 `SDT.Battle` |
| 16 | chests.js | `SDT.Chests` | 开宝箱动画与掉落 |
| 17 | game.core.js | `SDT.game` | 游戏状态对象、生命/经济、存档迁移、档位选择 |
| 18 | game.run.js | — | 掷骰移动、落脚结算、场景/商店/事件/祭坛/撤离（对局内流程） |
| 19 | game.hub.js | — | 基地中心 Hub：出发整备、仓库、升级、职业、成就 |
| 20 | game.bag.js | — | 背包：物资+卡牌混占格、安全格、拖拽整理、丢弃 |
| 21 | game.notes.js | — | 格子备注编辑器、导入导出、开发者模式绑定 |
| 22 | game.cardslib.js | — | 卡牌库（收藏页）+ 卡牌制作坊 |
| 23 | game.boot.js | — | 输入绑定、主循环、标题界面按钮、跨文件调试入口汇总、启动入口 |

> game.core~game.boot 由原 `game.js` 拆出；battle.core/view 由原 `battle.js` 拆出。
> 它们共享同一全局词法作用域（跨文件互相调用函数是正常的），**顺序不可调换**：
> 拆分文件顶层不得重复声明 `SDT`/`UI`/`esc`/`escAttr`（shared.js 已声明），也尽量不要
> 在顶层引用靠后文件才声明的函数（单文件时代靠函数提升，现在跨文件不提升——
> 此类初始化挪到 game.boot.js 顶层执行）。

## 注意事项

- `selftest.js` 用 `node selftest.js` 运行；其 `src()` 会把 `game.js`/`battle.js`
  映射为上述拆分文件拼接后再做正则断言与语法编译，新增拆分文件时记得同步数组。
- CSS 在 `../css/`：`base.css`（基础布局）→ `theme-classical.css`（中式古典皮肤层）
  → `title-soft.css`（软萌封面最终覆盖层）。级联顺序即文件引入顺序。
- BGM 曲名硬编码在 `sound.js` 的 `BGM_URL`，`selftest.js` 有对应断言。
