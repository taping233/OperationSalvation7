# R5-a 进行中地图快照设计门

## 玩家可见改变与已证兼容边界

普通远征在稳定节点保存后，刷新或重开仍看到同一批节点、类型、连边、入口与当前位置；以后新增两条路线只影响新局，不能重洗已开始的地图。地图快照损坏、来自未来版本或无法证明可重建时，档位保留原串并停在标题/档位选择，不进入整备页，因此“开始探索”不能覆盖该对局。界面给出“路线存档无法安全恢复，原档已保留；可稍后用兼容版本重试或显式覆盖档位”，不声称已经修复，也不自动清档。

当前唯一可证明的无快照普通图是 `generatorVersion=3 + layoutVersion=9`：现有生成器常量就是 3/9，`layered-map-generator.test.js` 固定 seed 验证确定性、四层规模、连通和门结构；它可由原 `mapSeed` 重建一次并固化为深拷贝快照。现有 `save-v1-run.json`、`save-v2-slot2-run.json` 只证明 RunStorage 字段迁移，均没有地图版本，不能证明其原拓扑。因此**无版本**、非 3/9、未知/未来版本且无合法快照的普通图一律拒绝并保留原串，不沿用 `save-format.md` 所写“缺版本按当前生成器重建”的旧策略。`map-generator.js` 的 3/9 算法在 R5-a 保持不变；R5-b 若加路线，须用新版本/新入口且保留 3/9 兼容生成器。

`nestActive=true` 是龙巢独立地图，不经过普通四层快照门。预检先识别该标志，继续用 `nestPos` 等龙巢字段恢复；不得因缺 `mapSnapshot`、普通层位置或 3/9 版本而拒绝。它仍接受 RunStorage 自身的坏 JSON/未来 save version 保护。

## canonical plain snapshot

新增 `game/src/map-snapshot.js`，不含 `Map`、函数、渲染坐标缓存或运行时对象：

```js
// createMapSnapshot({ mapSeed, generatorVersion, layoutVersion, layerData })
MapSnapshot = {
  kind: 'normal-map', snapshotVersion: 1,
  mapSeed: string | finite number,
  generatorVersion: 3, layoutVersion: 9,
  layers: [{
    id, name, nameEn, color,
    gridBounds: { minX, maxX, minRow, maxRow },
    entrances: [nodeIndex], entranceNames: [string], exit: nodeIndex,
    doors: [{ pair, at, toLayer, arriveAt, exit: boolean }],
    altarEntrances: [], // 现行 3/9 生成器真实结构恒为空；不臆造旧中央祭坛字段
    nodes: [{ id, x, row, def: { type, name, extraction: boolean }, next: [[layerIndex,nodeIndex]] }]
  }]
}
```

`nodes` 是唯一拓扑真源；当前 `layerData.nodes`/`logical` 的重复形状不直接双份保存。导出时从 `logical` 规范化，键顺序固定、布尔值显式化并深拷贝。接口：

```js
createMapSnapshot(input): Result<MapSnapshot>
validateMapSnapshot(snapshot, { layerIdx, trackPos }): Result<DeepCopiedMapSnapshot>
hydrateMapSnapshot(snapshot): Result<{ layerData, mapSeed, generatorVersion, layoutVersion }>
planMapRestore(run, slotId): Result<{ source:'snapshot'|'legacy-3/9'|'nest', snapshot? }>
```

完整校验先于任何游戏状态修改：对象必须是 JSON plain data、版本精确为 1、大小和数组数量有上限、四层非空；node id 全局唯一，索引/坐标为有限整数，类型在现有普通图白名单；bounds 包含全部节点；入口、出口、门、祭坛入口和当前位置均指向存在节点；每条 `next` 无重复/越界且必须有反向边，层间边必须与 door/祭坛描述一致；同层边必须是四向相邻；所有节点从第一层入口可达，且显式统计的节点数等于遍历数。`checkConnectivity` 只作第二重检查，不能单独作为验证器，因为它会把边按无向补齐，且可能漏掉零边孤点。校验还拒绝原型污染键、非 JSON 值及无法稳定 stringify 的数据。

`hydrateMapSnapshot` 只从已验证 snapshot 创建新对象：生成 `logical`，再统一重建 `toLogical: Map`、`nodePos`、`layerBounds`、扁平 `nodes`、`cellDefs: Map` 与 `geometryVersion`。这些派生字段不入快照；创建完成并复核当前位置后才一次性替换 `game` 对应字段，避免半恢复。

## 保存与恢复控制流

`saveGame()` 仅在现有稳定节点条件下，为普通远征调用 `createMapSnapshot(...)` 并把结果写入 `mapSnapshot`；创建失败则本次不调用 `RunStorage.write`，显示保存失败，绝不落一个缺拓扑的新版本。龙巢存档可以不写普通快照。R5-a 不改变地图生成器；新局仍先 `createLayeredMap(seed)`，随后立即创建内存 snapshot，稳定保存时持久化。

`loadGame(slot)` 改为返回 `RestoreResult`。顺序为：只读 `RunStorage.read` → 对 `nestActive` 或普通图执行 `planMapRestore` 和完整校验/临时 hydrate → 全部成功后才 `Random.restore`、`Base.use`、提交派生地图和其余局内字段。不能像现在一样在地图判断前调用 `Random.restore`/`buildDerived`。普通旧 3/9 无快照时用保留的 3/9 生成器生成、转 canonical snapshot、逐项校验，并核对 `layerIdx/trackPos` 必须真实存在；不再 clamp 到别的节点。恢复全部完成后下一次稳定保存写入快照；若写入失败，旧原串仍可按同一 3/9 确定性重试。

`game.menu.js` 必须做必要的最小接线。当前 `launch(slot, fn)` 会在 `fn/loadGame` 前执行 `Base.use`，还可能因卡牌术语迁移调用 `Base.save`；所以 `enterSlot` 要在进入 `launch` **之前**对进行中 run 调用纯 `preflightMapRestore(slot)`。预检失败直接留在标题/档位选择并显示保留提示，不切 Base、不进入 `openBaseHub('deploy')`。预检成功后才沿用转场与 `launch`，`loadGame` 内仍须对同一内容重验；若两次读取间被外部标签改变，后验失败至少不安装地图、不写/删 run，并退出到标题。这个窄门不扩展成 R2 的全入口事务化，也不宣称能阻止绕过门面的标签竞态。只有明确无进行中对局才进整备，覆盖仍走既有二次确认。仅让 `loadGame` 返回 false 不够，因为当前调用链会继续进入整备，随后新出征可能覆盖被保留的 run。

正常标准：新局 snapshot 往返深相等；固定 seed 重载前后节点 id/type/边/坐标、当前位置相等；3/9 无快照首次恢复得到与原生成器一致的深拷贝 snapshot；龙巢无普通 snapshot 可继续。失败标准：前置预检对字段、连边、位置、版本任一非法都不切 Base、不改 Random/game、不写删 run 且不进整备；后验检测到两次读取间竞态时也不安装地图或覆写 run，并明确退回标题。重试标准：同一原串重复失败结果一致；修复运行版本后可再读；成功恢复和反复保存不改变 snapshot。测试用独立内存/专属键，不读取或覆盖玩家五档。

## 有限文件范围与停止点

R5-a 实施仅允许新增 `game/src/map-snapshot.js`、`tests/r5a-map-snapshot.test.js`、交付文档，并最小修改 `game/src/game.session.js`、`game/src/game.menu.js`；若 RunStorage 只需承载新 plain 字段则不改 `game.storage.js`。不改 `layeredMap.js`、`map-generator.js`、`map-graph.js` 的 3/9 行为，不接 R5-b 双路线，不动经济、职业收藏、龙巢规则或玩家档。实现完成后停在自动测试与独立 QA 夹具，等待 Friday 实际刷新验收；未通过前不进入路线模板。
