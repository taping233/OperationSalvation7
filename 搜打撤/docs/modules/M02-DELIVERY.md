# M02 收藏、人物成长与外观：第一包交付

契约：`GAME-MODULE-CONTRACTS-2026-09-21.md` v1.0 §3、§5、§17、§18。

## 范围与基线

- 源码基线：`master` / `2dfec66`；工作区同时存在交接文档列出的其他未提交改动，本包未清理、提交或改写它们。
- 本包新增 `game/src/collection.commands.js`，并仅在 `meta.js` 增加无保存副作用的经验纯计算，在 `art.js` 增加皮肤状态持久化所需的受控接线。
- 依赖 M01 的 `base.commands.js` v1 门面：`readBase`、`readBaseReceipt`、`commitBase`。M02 不直接写 `localStorage`。
- 基地 schema/资产版本：M02 不自行提升版本；使用 M01 新增的 `appearance.characterSkins`、`appearance.selectedSkins` 和事务记录。无新图片资产。

## 导出接口

`game/src/collection.commands.js`：

- `getCollection(baseSnapshot, cardCatalog)`：返回深冻结的 `CollectionView[]`。永久记录即使退役或暂时不在卡牌目录也保留 `{card:{cardId}, registered:true}`，但不会伪造实体数量或转换能力。
- `getCharacter(baseSnapshot, characterId)`：返回等级、经验、满级状态、下一等级收益、已选皮肤和可用皮肤 ID；满级不返回 `nextReward`。
- `convertCollection(context, {stackKey,count})`：一次提交扣实体卡、首次永久登记、每张按现行规则加经验，并回报新达成但尚未领取的收藏里程碑。
- `selectSkin(context, {characterId,skinId})`：持久化选择；保留既有资格。已有资格但缺当前全身立绘时返回 `assetFallback:true, fallbackSkinId:'default'`，不删除资格或选择。
- `stackKeyOf(stack)`：旧库存适配器；优先持久化 `stack.stackKey`，否则按稳定卡 ID/变体推导。推导冲突时写命令返回 `INVALID_STATE`。
- `createCollectionCommands(deps)`：独立测试和后续替换依赖用工厂；生产导出默认接真实 M01 门面、卡库和 Art。

收藏里程碑沿用现行“达成后由玩家另行领取”语义：转换收据的 `rewards` 为空，`newUnlocks` 只报告新达成 ID；不改 `collClaimed`，不自动发木材、口粮、钥匙或卡牌。

## 独立验收

命令：

```text
npx vitest run tests/m02-collection-commands.test.js --no-file-parallelism
```

结果：1 个文件、7 个测试全部通过。

| 验收 | 结果 | 覆盖证据 |
|---|---|---|
| M02-A | 通过 | 真实卡 `tt7-throwblade` 数量 2→1→0；首次登记一次；两次各 +10 XP |
| M02-B | 通过 | 同 request 重试回原收据且不再扣卡/加经验；异参冲突；数量不足整笔失败；`Storage.setItem` 抛错返回 `SAVE_FAILED` 且内存/磁盘不变 |
| M02-C | 通过 | 实体归零后永久记录仍在视图；退役目录外记录也保留；`ownedCount=0`、`canConvert=false` |
| M02-D | 通过 | `m5` 只进入 `newUnlocks`，不自动加奖励、不写 `collClaimed`；Lv.10 明确 `maxed` 且无虚构下一等级 |
| M02-E | 通过 | 既有 `wu/casual` 可选并重载保持；未知 ID 不写档；有资格但缺素材时保留选择并标明默认图回退 |

相邻回归：

```text
npx vitest run tests/base-meta.test.js tests/collection-room.test.js tests/card-art-coverage.test.js tests/m02-collection-commands.test.js --no-file-parallelism
```

结果：M02、`base-meta`、`card-art-coverage` 通过；`collection-room` 有 1 个与本包无关且单独复跑可重现的既有失败：测试仍断言卡库存在“`rarity=职业` 且无 `cls`”的退役卡，而当前在途卡库数据不存在该样本。本包未改卡牌规则或该测试。

## 正常、失败与重试样例

- 正常：`convertCollection({slotId:5,requestId:'collect-1',expectedRevision:r}, {stackKey:'card:tt7-throwblade',count:1})` 返回 `consumed`、首次 `firstRegistrations` 和 `xpChanges`，revision 增加 1。
- 失败：实体只有 1 张却请求 `count:2`，返回 `INSUFFICIENT_CARDS`，库存、永久记录、经验和 revision 均不改变。
- 重试：以原 `requestId`、原参数和原 revision 再调，M01 持久收据预检直接返回第一次结果；换 `count` 返回 `REQUEST_ID_CONFLICT`。

## 共享 UI 接线（尚未合入）

`game.hub.js` 由统一接线负责人修改：

1. 导入 `convertCollection`、`stackKeyOf` 以及 M01 `readBase`。
2. 现有 `collectOne` / `collectAll` 不再调用 `B.collectToggle`、`Meta.onCollect` 或 `B.save`；确认后先 `readBase(B.slot)`，生成新的 `requestId`，用读到的 revision 调 `convertCollection`，成功后只做音效、合并反馈和 `renderHub()`。
3. 一个按钮动作只生成一次 requestId；网络/页面重试复用该 ID。玩家主动再次收藏必须生成新 ID。
4. 进入档位或打开选人页时调用 `SDT.Art.hydrateSelectedSkins(B.data.appearance?.selectedSkins)`；皮肤按钮最终改调 `selectSkin`，成功后刷新立绘。

因此当前状态是“模块独立验收通过、未接入 UI”。玩家尚不能从旧按钮获得事务保证，直到统一接线完成。

M03 展位稳定引用：`DisplayRef.refId` 使用永久 `CardRef` 的 `cardId`；只有实际存在变体时附带 `variantKey` 的稳定编码。不得引用 `stackKey`，因为实体卡可被转换耗尽。

## 回退

可回退 `collection.commands.js` 的导入/按钮接线，并移除 `meta.js` 的纯函数导出和 `art.js` 的状态同步函数。已经写入的 `collection`、`characters`、`appearance` 与 M01 请求收据必须保留；不得通过清空玩家档案回退。旧 UI 可继续忽略新增 `appearance` 字段。
