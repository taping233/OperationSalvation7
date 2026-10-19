# 卡牌浏览列表共享差分状态

2026-10-18 UTC，完成未提交。范围为收藏卡、人物招式池与仓库列表；不改页面进入/退出框架、交易动作、卡牌数据或美术。

## 公共路径

新增 `game/src/ui/card-browser-state.js`，统一当次列表获取、筛选标志与选中状态差分。收藏与招式池原来每次操作对所有卡无条件写筛选/aria属性；现在仅变更不同值。仓库原有差分语义迁入同一辅助，仍保留连续滚动、库存实时查询和原打开/使用动作。

`refreshCardBrowser` 可接收本次筛选取得的 items；仅当它们仍逐一匹配当前 track 的全部直接子节点时复用，否则重查。分页每次仍读取当前筛选属性；没有跨帧牌池/库存缓存。脱离 DOM 或位于当前可用 ovBody 之外的旧列表拒绝读取/操作。原有 click/keydown/load 监听、翻页和图片加载合帧行为保留，补旧页回调守卫，未声称新增完整监听注销机制。

收藏详情不再为单卡选择建立全馆藏的两份 Map 与整组行对象，按当前 ID 查询最新目录/仓库。保留原 Map 的“同 ID 最后一个胜出”和目录优先语义。相同模板不反复替换详情节点；每次仍重新生成当前卡的模板以观察原位数据和全局呈现变化，不缓存 cardHTML 结果。

消费者：
- `game/src/hub/hub.collection-v4.js`
- `game/src/hub/hub.personnel.js`
- `game/src/hub/hub.warehouse.js`
- `game/src/ui/card-browser.js`

## 验证

整批后集中运行13个定向测试文件，首次11文件131项通过，另外2文件因交接副本缺历史baseline而收集失败，原始输出保留于 `targeted.log`。随后恢复原件并只补跑这2文件，16项全部通过（`restored-baselines-test.log`），包括更新共享辅助注入的 page-perf-hub 源码夹具。

历史输入恢复均保留原字节：
- runtime-hotpaths 的 `cards.view.before.txt` 与 `card-browser.before.txt` 从既有 eb8d669 交付物原件恢复，核对其历史manifest中的长度与SHA256，见 `restored-test-inputs.json`。
- page-perf-hub 的 `hub.warehouse.js.txt` 与 `game.bag.view2.js.txt` 从 taping233/OperationSalvation7 固定提交 `cd98745f03a6d8313a7138386b1499d8fe5ab4f6` 取得，独立计算 Git blob SHA 与返回值一致后写入，见 `restored-page-perf-inputs.json`。
- 未以当前实现替代历史baseline，未跳过断言。恢复后仅补验原先受阻的2文件，没有重跑已通过的11文件。

独立自查发现单卡查询须沿用原 Map 的末项优先，补正后只重验2个受影响文件，结果见 `lookup-boundary.log`；未重跑全量。定向 lint、源码语法/diff检查通过，8套类型检查见 `types.log`。

新增集中计数断言：200个保留控件重复100次相同筛选/选中/分页刷新，列表DOM变更为0；从一张换选另一张仅4次属性变更。共享 items 的当次分页更新不再执行 track.querySelectorAll；替换、插入与新筛选后重新取得/读取正确数据。真实收藏与人物招式模块覆盖重复操作节点保留、实时卡数据、最后重复ID、筛选无匹配、返回全部与详情动作。

这些是 jsdom 的DOM写入/查询次数与模块契约结果，不是浏览器实际帧率、布局耗时或实玩验证。当前内置浏览器实页仍未完成；没有使用外部浏览器/headless/CDP替代。未build、启动服务、提交或推送。

## 开源设计对照

复用此前已核实并记录于 `../2026-10-18-reward-organizer-focus/README.md` 的固定源码设计：Slay-The-Robot SHA `4dac5abe0d19382f8ace2cec5ed3fd77e2a0e11d` 的 CardSelectionOverlay 在 populate_cards 建控件，选择事件只更新选择状态/光效/确认入口；Shattered Pixel Dungeon SHA `57a4e06a4caf162446d1c28caa7983f0493fecf0` 的 InventoryPane 更新已有槽位。这里只沿用保留控件、更新状态的边界，不复制实现/资源，不推导其FPS。

本次尝试重新读取上游固定链接未成功（web工具 cache miss），因此以上对照明确是复用既有核实记录，而非本次重新获取源码的结果。
