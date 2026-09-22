# M03 家具、布局与展位交付

## 任务头

- 契约：`GAME-MODULE-CONTRACTS-2026-09-21.md` v1.0 §3、§6、§17、§18。
- 实施基线：`D:\素材\代号柒\搜打撤`，`master`，`2dfec66aa610d9a1abc87a8ce1159ca2db90911d`；保留工作区原有未提交改动。
- 玩家成果：一间 8×6 逻辑房间可购买并摆放 6 类家具，并可在 2 个展位引用永久收藏。
- 输入：M01 `readBase/readBaseReceipt/commitBase`；M02 `CollectionView` 可通过 `createHomeCommands` 注入。本包测试使用遵守同一契约的内存替身。
- 输出：`getHome`、`validateLayout`、`buyFurniture`、`saveLayout`、`setDisplay`，以及供接线者注入真实收藏查询的 `createHomeCommands`。
- 不包含：UI、Pixi 场景、正式资产、最终经济平衡、战力加成、入口接线和存档 schema 的维护。

## 数据与规则

`home` 内部形状由 M03 管理：

```js
{
  owned: { chair: ['chair-1'] },
  placements: [{ instanceId: 'chair-1', furnitureId: 'chair', zoneId: 'room-floor', x: 3, y: 2, rotation: 0 }],
  displays: [{ slotId: 'display-left', ref: { kind: 'collection', refId: 'tt-example' } }]
}
```

储备币继续使用存档顶层 `coins`，没有新增货币。展示引用永久收藏记录，不引用仓库 `stackKey`，也不扣除或复制实体卡。家具价格是暂定样板值：展示柜 8、工作桌 6、座椅 3、灯 4、地毯 5、墙饰 4；这些数字不是经济平衡定稿。

地毯是明确的覆盖层，可与落地家具占用同一逻辑格；普通落地家具互相冲突。桌灯使用 `table` 表面，必须完整落在带 `table` 支撑能力的工作桌占地内。墙饰只能进入墙面区。目录同时提供占地、允许旋转、价格、拥有上限、表面、占位资产 ID，后续 Pixi 场景可以直接消费快照。

## 输入输出样例

正常购买：

```js
await buyFurniture(
  { slotId: 1, requestId: 'buy-chair-01', expectedRevision: 4 },
  { furnitureId: 'chair', quantity: 1 },
);
// { ok:true, value:{ furnitureId:'chair', quantity:1,
//   instanceIds:['chair-1'], costCoins:3, coinsAfter:27 }, revision:5 }
```

失败布局：

```js
await saveLayout(ctx, { placements: [
  { instanceId:'chair-1', furnitureId:'chair', zoneId:'room-floor', x:8, y:2, rotation:0 },
] });
// { ok:false, code:'PLACEMENT_OUT_OF_BOUNDS', retryable:false,
//   details:{ violations:[{ instanceId:'chair-1', code:'PLACEMENT_OUT_OF_BOUNDS', cells:[...] }] } }
```

跨重启重试由 `readBaseReceipt` 在余额和拥有上限校验前识别；相同 `requestId` 和参数返回原领域收据，不会再次扣款。同 ID 换参数返回 `REQUEST_ID_CONFLICT`。

## 验收

命令：

```text
npx vitest run tests/m03-home.test.js tests/m01-base-commit.test.js --no-file-parallelism
```

结果：当前复跑为 2 个文件、13 项测试全部通过（M03 7 项、M01 6 项）。另跑 `tests/contracts.test.js` 时，29/30 通过；唯一失败来自本包开始前已有的 `main.js` 已导入 `term-tips`、但 `boot-order.js` 尚未同步，本包无权修改这两个共享文件。

- M03-A 通过：购买扣币与增加实例、同请求幂等、新请求继续购买、上限、不足、保存失败回滚。
- M03-B 通过：合法布局保存后重读一致；越界、非法旋转、重叠、未拥有、缺支撑均给出实例级原因；失败不覆盖旧布局。
- M03-C 通过：未拥有实例拒绝；纯校验预览不落盘；实体数量为 0 的永久收藏可展示。
- M03-D 通过：设置和清空展位不改变仓库、经验或战力；未登记收藏拒绝；零家具时查询与基地数据仍可用。
- 切档通过：M03 替身测试在两个档位间切换，购买后币和家具互不串档；M01 五档提交测试同时通过。本包未做 UI 切档实机流程。

## 接入边界与回退

本包没有修改 `main.js`、`game.hub.js` 或任何 UI，因此当前玩家还看不到房间，也不能从页面点击购买或摆放。M12/M05 需要把生产门面接入入口；带变体的收藏展示应通过 `createHomeCommands` 注入 M02 的 `getCollection(baseSnapshot, cardCatalog)`。默认门面只兼容现有无变体 `base.collection[cardId]`。

未执行 build、全量测试、浏览器实机和最终 Pixi 接入验收；这些不属于独立纯逻辑包。回退时可停止导入两个 M03 源文件并删除对应测试/文档；M01 已迁移的 `home` 字段应原样保留，不能通过清空玩家存档回退。
