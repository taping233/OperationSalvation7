# 资源别名与生产包省略审计集成收尾

两项失败均为当前消费者变化后旧契约失效。未修改资源路径解析器、生产资源或省略规则；更新正式宝箱入口断言，并在逐项复核后更新精确 SHA256 消费者指纹。

## 宝箱契约

`game/src/run/chests.js` 调用 `chest-opening-art.js` 的 `createChestFrameSets()`；后者为五种宝箱共用 `safe-simple-v7/frame-00..03.webp` 的 11 项时间轴，并静态引用 `burst.webp`。旧 `*-rig-640-v1` 已不在正式宝箱时间轴中，但 Vite 的 `RUNTIME_ASSET_DIRS` 包含 `scenes`，仍进入静态拷贝与预热清单，旧别名继续只合并逐构建核对为相同字节的 15 个候选帧对。

原测试错误地要求旧帧仍在 `chests.js` 中静态引用。现验证旧别名的字节相同、目录限定，以及正式模块接入、全部五个 safe-simple-v7 静态 URL 及源文件存在、不参与旧别名。原有重绘、缺失文件、独立原图/缩略图、重复构建重新检查及 Vite 虚拟拷贝测试保留。

## 消费者指纹复核

指纹使用原有完整文件内容、CRLF→LF 归一化 SHA256，无放宽或截断。以下是本次变化消费者的复核依据：

| 文件 | 当前路径来源与排除安全依据 |
| --- | --- |
| `game/src/core/art.js` | 此轮 diff 仅将 DOM 图片解码委托给 `decodeImagesIn`。`image()` 仍将 `ROOT + rel` 交给 assetUrl；卡面路径来自现行 DATA.art 映射；角色为 full/battle/avatar/skin 映射，敌人路径限定 portraits/enemies，cutout 限 classes/enemies。预热仅消费构建生成的 ART_MANIFEST/THUMB_MANIFEST，不能自行恢复已省略旧帧。事件场景仍由 EVENT_CARD_ART 映射，源扫描继续检查数据中的未来引用。 |
| `game/src/core/icons-bitmap.js` | 改动为 hydration 与无 token 快路径；动态 URL 仍限定 `assets/ui/icons/` 加 NAMES/ALIAS 验证后的名称；coin 为静态 `assets/ui/map-hud-1015/gold-is7-v2.webp`。不产生 frames/map/transitions 候选路径。 |
| `game/src/battle/view/battle.layers.js` | 改动为手牌交互、布局、提示和主动技能状态；唯一动态 assetUrl 的 source 仍来自 allyFigure 三项固定 portraits/allies 映射，否则回退 runner 图标。不构造旧角色帧。 |
| `game/src/hub/game.bag.view2.js` | 改动为背包可访问性、消耗区信息和数量说明；唯一直接资源为静态 `scenes/map-nodes/map-atmosphere-is7-1012.webp`。卡牌 HTML 委托 SDT.Cards，未增加资源路径构造；整页模板插值触发保守检测，但未动态选择候选素材。 |
| `game/src/ui/game.menu.js` | 此轮 diff 仅将两处“消耗口袋”改为“消耗区”。直接资源仍为静态 `assets/ui/sugin-mail-empty.webp` 与音效来源 Markdown；模板插值不选择候选资源。 |
| `game/src/core/map-node-art.js` | 现行节点图全部静态 new URL，使用 symbol-foreground、resource-symbol 与 gold-is7-v2；新增 prepareMapBrushArt，委托模块静态列出 map-brush-1015/trail-a/b/c.webp。视觉辉光、徽标改动不产生旧 security-shard/record-fragments/transit-core/heat-cell/exchange-token 路径。 |
| `game/src/core/renderer.js` | 地图底图仍为静态 map-atmosphere-is7-1012；新道路委托 drawMapBrushRoad 使用上述三张笔触图；节点交给 map-node-art。其余 diff 为道路、徽标和地图状态表达，不新增旧素材选择器。 |

源代码、数据和 CSS 搜索未发现 12 张旧地图或 5 张 v1 转场候选引用。三个角色现行 animations.json 仍由审计函数逐次读取并校验，56 个候选均可省略。审计返回 `warnings=[]`、`excludedAssets.size=56`。

未来新增/修改不透明路径构造器仍使全部候选保留；选择器改变/缺失仍保留对应类别；缺失或未知角色目录仍保留角色旧帧；静态或配置恢复引用仍自动保护；最终 Rollup 全图及构建期间决策一致性检查均保留。

## 验证

执行：`npx vitest run tests/runtime-asset-aliases.test.js tests/runtime-asset-redundancy.test.js`。2 个文件、19 项全部通过。Vite hooks 测试使用虚拟文件系统，输出中的拷贝/清理和缺少扫描目录均来自夹具，未构建或写入真实素材/产物目录。

主会话最终复核：内层卡面新增 aria-disabled 仅反映 blockedReason，不改变 allyFigure 或 assetUrl 输入；相应完整 LF SHA256 已刷新。game.boot.js 的 IME Escape 守卫不产生动态资源，不在消费指纹表中。
