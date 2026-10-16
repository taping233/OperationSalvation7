# 奖励原子性与持久化审查

## 已修复并释放：基地奖励准备与旧坏档字典

两个生产模块与新增回归测试已完成，未提交：

- `game/src/hub/meta.js`：指定成就奖励卡、全收藏宠物蛋缺失，或 45 张收藏奖励所需的两种独立传说不足时，返回 `ok:false/why:unavailable` 与明确原因。任何奖励、资源和领取资格都不提交；完整卡库恢复后可正常领一次。传说数量与去重规则未改，未用重复卡凑数
- `game/src/hub/base-state.js`：对 collection、collClaimed、collXp、backs 采用既有逐字段对象兜底；数组、字符串、数字、null 回落对应默认字典并告警。其他有效字典、库存、资源、统计保留。读取/预览不写回原档；不对无稳定卡 ID 的数组索引猜映射
- `tests/reward-atomicity-cloud.test.js`：17 项真实 Cards/Base/Meta 回归，使用隔离 jsdom localStorage

## 修复前输入与实际输出

`repro.test.js`、`repro-output.txt` 和 `reproduction.json` 是修复前四项表征探针，断言的是旧错误行为。修复后不应再通过这些旧错误断言，当前回归入口是 tests/reward-atomicity-cloud.test.js。

1. 通过真实 Cards.remove 删除 labScore2 指定的 tt3-thunderblast，满足 1500 分：领取返回成功，achClaimed 落盘 true，仓库零卡；恢复卡库后仍不可补领
2. 满收藏时从卡库删除宠物蛋：mAll 成功终结，未发蛋
3. 满足 m45，当前可随机传说仅余一种：承诺两张实际只给一张，领取资格永久消费
4. 仅人工异常输入 collClaimed:[]：m5 第一次领取木材 0→3 落盘，但字符串领取标记被 JSON 数组序列化丢弃，重载后可第二次领取至 6。没有正常新档自然生成该数组的证据

前 3 项使用真实可编辑卡库 API；第 4 项为旧坏档兼容输入，不能概括为正常新档重复领取。

## 检查

- 7 文件 79 测试通过：新 17 项、base-mutation、base-meta、base-corrupt-field、hub-reward-feedback、m02-collection-commands、base-save-snapshot
- 自有两源码与新测试 ESLint 通过
- 自有三文件 node --check、git diff --check 通过
- 8 份渐进 typecheck 通过
- 当前生产源码 SHA256 与补丁见 source-verification.json、base-meta-fix.patch
- 没有运行 build、浏览器、真实玩家存档或服务管理；不是全量质量门通过

## 独立后续：阿猫附赠满包损失

`gift-capacity.test.js`、`gift-output.txt`、`gift-reproduction.json` 记录真实 grantEventCard 与 Chests 控制器复现，session/UI/容量采用窄端口：16 格中已有 15 张不同名普通卡，领取阿猫本体占满第 16 格，附赠随机牌失败；本体已标记 taken，cur.cards 没有附赠，整理腾格后重试不补发，继续后没有待领记录。1 项表征探针通过。未做真实 UI；此证据不能宣称全部地图/事件入口已覆盖。

明确授权后已独立修复宝箱/固定奖励这一批并释放：

- game.run.scenes.js 允许奖励控制器以 deferAcquiredCard 承接已掷定附赠；未提供端口的旧非宝箱调用不变
- chests.js 把附赠追加为 current.cards 的独立待领卡，本体 taken 与附赠同份检查点保存；当前放不下时留页，整理、退出重载、卡库换池均不重掷。三选一使用可选 choiceCount 冻结原候选边界，附赠不会被误标永久放弃
- chest-reward-save.js 校验 choiceCount 正整数/不大于 cards 长度；旧快照无字段保持原候选语义。docs/save-format.md 仅追加对应一句
- tests/chest-acquired-gift-cloud.test.js 新增 20 项，使用真实 grantEventCard、Chests、RunStorage，以及实际背包堆叠模块与当前 production canReceiveCard 函数。未做真实 UI，也不是完整 loadGame 路径复验
- 相关 8 文件 79 测试通过；4 文件 ESLint、8 份渐进 typecheck、4 文件 node --check、自有 diff、docs 门 461 相对链接零发现均通过。单独 20 项最终 verbose 结果见 gift-fix-tests.txt
- 精确自有补丁与前后 SHA256 见 gift-fix.patch、gift-source-verification.json。未运行 build、浏览器或提交

存储失败仍遵守已有局内 checkpoint 契约：内存中的本体、固定附赠和已领标记同步推进；主存档仍保留上一完整快照。成功重试保存后完整落盘。本批不把内存进度说成已经持久化成功。

gift-capacity.test.js 为修复前错误行为表征，修复后不应继续通过。当前回归入口是 tests/chest-acquired-gift-cloud.test.js。非宝箱来源与后续方案见 NONBOX-SOURCES.md。

## 新发现：首脑/巨兽额外传说满包后没有待领记录

真实 game.bag.settle.js 控制器在 game.grantCard 返回 false 后仍完成战后事务，visited=1、idle，提交的 afterRun 无额外传说且 chestReward=null，重复结束也不会重发。首脑保证分支与巨兽命中分支共 2 项表征探针通过，证据为 extra-legend.test.js、extra-legend-output.txt、extra-legend-boss.json、extra-legend-beast.json。该探针的 command 持久化端口是成功桩；只证明控制器在容量拒绝后提交了没有奖励/待领记录的 payload，未称真实跨键落盘或实机验证。源码未改，已单独列入后续修复协调。

## 未新增缺陷的边界

基地购买、升级与领奖已有隔离草稿单键提交测试。局内普通商店 save=false 后币、牌、货架同步留内存是已明确的检查点契约，本轮没有把它重复报告为新原子性缺陷。研究所商店/祭坛仅静态见离开时保存，未在本轮定性，不宣称已实页验证。


## 第三小批：装备征用阿猫整体转入固定待领奖

已完成并释放：event-card-choice.js、game.run.flow.js 的单项端口注入、save-format 领取索引说明，新增 tests/event-choice-acquired-gift-cloud.test.js 共 13 项。

- 所选阿猫先写 taken 作为“已锁定选择”，同时消费原事件节点，再同步建立现有固定领奖页；此时主卡还没有入包，实际主卡及后续附赠都由 Chests 独立领取。普通非阿猫选择仍成功收卡后立即结束
- 同一份 Run 检查点含 paidCoins=3、taken=所选索引、visited 与主卡 chestReward；Chests 内部首次保存与外层再次保存均已带齐这些字段。没有先保存 taken=null 再补锁的窗口
- 原子失败探针分别令第 1 次、第 2 次、两次 Run 主键保存失败。任一成功写入都有完整锁定+待领；两次失败时原持久快照仍保留旧选择，当前内存保留已锁定待领但尚未发卡，遵循原检查点语义。摘要见 quartermaster-write-attempts-1.json、quartermaster-write-attempts-2.json、quartermaster-write-attempts-1-2.json
- 缺 restore/serialize 端口、接收器返回 false 或接收前异常时均不发卡，原选择与已付货币保留。已接收并保存后才异常时保留当前待领奖，不把选择回滚成可重选
- 真实 loadGame/RunStorage 复验主卡未领与主卡已领/附赠待领两阶段；不重复付币、不重掷附赠、不重发主卡。旧选择/退出/背包回调不覆盖新领奖页
- 5 文件 55 项通过；3 文件 ESLint、8 份 typecheck、3 文件 node --check、diff 与 docs 门 461 相对链接零发现均通过。精确基线、补丁与 SHA256 见 quartermaster-before.json、quartermaster-fix.patch、quartermaster-verification.json
- 没有操作真实玩家存档、浏览器、服务、build 或提交；装备征用这一批没有实机验证

## 已获得的宝箱实机边界

统一真实 UI 反馈：密封箱原候选为能源结晶、阿猫的礼物、法力光波。17/18 格选择阿猫后，本体入包至 18/18，原另外两候选永久放弃，新增影噬作为独立待领；正常刷新后仍保持同一影噬与本体已领状态。影噬已有 1 张，可以同名叠放，领取后实际阿猫 1 张、影噬 2 张，整理背包关闭后正常返回领奖页并继续。

这只证明独立附赠展示、刷新固定、主卡不重复与真实同名叠放；没有在实机遇到无法叠放的附赠。容量拒绝及保存失败由隔离定向测试覆盖，不能说这些边界全部实机通过。
