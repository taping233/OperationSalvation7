# 默认阅读器的可实施统一边界

可把 `DepartureCardZoom` 的旧默认分支统一为通用源阅读器参数；不必仅给重编加特判。只读核查，未改生产或运行 Unity。

## 当前全部调用

| Native 调用 | 活跃 Source 对应 | 统一默认的条件 |
| --- | --- | --- |
| `DepartPrepScreen.cs:119/121`，库存已带完/容量不足时只读 | `game.hub.depart.js:416–423` 的 `pickAdd`，`UI.showCardZoom(stack.card,{footer:'',from,returnFocus:from})` | 单卡，无 presentation，通用阅读；应保留回原卡焦点。 |
| `DepartPrepScreen.View.cs:100`，整备随身卡格 | `game.hub.depart.js:452–500` 的 `bagZoom`，`UI.showCardZoom(row.card,{footer:'',from,returnFocus,getItems,getIndex,canNavigate,onBrowse,...})` | 无 presentation，通用阅读；多卡浏览应到边界隐藏、拒绝越界，键盘左右可用；保持 variant 身份。 |
| `ClassChoiceScreen.Pool.cs:61`，人物卡池 | `game.run.class-choice.page.js:376–382`，`UI.showCardZoom(c)` | 无 presentation，通用单卡。Native 当前传整个 all 数组，增加了源没有的列表导航，建议调用改为仅当前卡。 |
| `EventDialogRecode.cs:87`，重编冻结结果 | `event-recode-result.js:27`，`UI.showCardZoom(card,{returnFocus})` | 无 presentation，通用单卡，返回原检视按钮。 |
| `BattleSecondaryViews.cs:140` 与 `CurrentDeckFormation.cs:114` | battle decision inspection / pile inspection | 这两处 options 非空，保留现有 battle 模式及其 retained 场景，不再叠通用全屏 blur。 |

全 Assets/Scripts 的调用搜索只有上表7处代码位置（AddPick占两处）。没有 Preparation/容器直接调用该 helper；其专用 inventory/collection/photo 阅读器不在本补丁影响面，不能顺带统一掉其专门布局/动作。

## 生效参数与例外

- 默认入口的原 `UI.showCardZoom` 均无 presentation；`winter.css:478` 和 `cards.css:3` 给出 34px × 13.08em = 444.72px 卡宽。
- `cover-context.js:8/21/28` 以 depMain、cls-pool-page、node-pg 等判为 ordinary；`cover-details.css:30–42` 为普通阅读背景 #1213142e / blur18px，即18%幕布与18px模糊。
- `base-camp.css:142–166` 对整备背景及备注颜色有局部覆盖，但没有改 `.cz-backdrop` 或卡宽。`#cardZoom:has(.camp-detail) .cz-note{display:none}` 只在 zoom 内容本身包含 camp-detail 时成立；整备的 camp-detail 在底层 depMain，不符合这个隐藏条件。
- 实际 `card-zoom-content.js:9–20` 在未传 hideNote 时生成只读备注，空值显示“暂无备注”；这些默认入口均没有 hideNote。重编的“只读”不等于“无备注”。
- 默认数据是 `opts.note ?? card.note`；它并不自动读取照片馆的个人备注库。Native CardDef 当前未保留 note 字段，不能无证据把 Base.PhotoNote 的个人编辑值接进来。
- `CurrentRunTopBar.Covered:76` 已按类型名 CardZoom 覆盖 DepartureCardZoom；统一默认分支应保留该类型/覆盖语义，在局内详情时继续隐藏共享HUD。
- 默认旧 `Browse/Update` 仍以 options 是否非空判断循环/键盘资格，若共享一个新视觉入口，必须同时改为按当前模式与数组边界拒绝越界；不能仅复用 BuildBattleReader 后保留默认循环行为。

可集中验收：整备单卡与多卡到头/左右键、人物池单卡、重编返回焦点/备注空态，以及现有 battle options 模式无新增叠层。
