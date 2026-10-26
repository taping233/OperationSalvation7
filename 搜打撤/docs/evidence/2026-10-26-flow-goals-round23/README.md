# 高频流程收拢：祭坛候选随存档沿用

状态：本批修改完成，编辑释放，待老板统一验收，全部保留未提交。

上一批碎片兑换候选仅在当前运行的WeakMap缓存。本批将候选接入现有nodeRewards，与同节点复原记录共存，让满包整理、返回与重新打开游戏都继续同一次候选；领取继续沿原接收、碎片支付及保存检查点。

范围：`game/src/run/game.run.altar.js`、`game/src/ui/node-decision-view.js`、`game/src/run/node-reward-state.js`、`game/src/run/node-restore-state.js`、`game/src/hub/game.store.types.d.ts`、`docs/save-format.md`、`docs/modules/secondary-ui-style.md`。复用已有领取标记与存档来源，不新增存储通道；按老板要求不运行测试、lint、构建、检查脚本或实页，不新增测试，不提交推送。

## 实施

- 现有`nodeRewards`增加`type:altar`轻记录，共享可选`altarFragmentChoice`保存人物、单一候选ID与领取索引。`validAltarFragmentChoice`在一个来源校验，现有`validNodeRewards`与复原记录共同使用；旧无字段记录继续有效。
- `reserveAltarFragmentChoice`仅在无候选时抽取；查询、建档和原复原记录共用节点身份。`beginNodeRestore`允许合法祭坛记录转换为复原，并在完成后更换复原来源时继承同一候选。
- 祭坛退出上一批WeakMap，领取复用`claimResourceReward`而不新建领取命令。满包拒收后先保存候选及原随机流位置，再回原祭坛显示卡名与整理入口，碎片保留。正常领取的卡牌、扣碎片、激活与领取标记同次检查点保存。
- 读取已保存候选后直接按ID解析，候选暂不可用时保留记录并显示原因；已领取标记不再发牌。保存或结果呈现失败继续沿上一批公共检查点。回赠页音效也沿本文件既有反馈隔离入口，继续已保存结果。
- 存档、恢复、递归快照、档案与成对恢复路径均整体承载`nodeRewards`，只读定位确认无需新增投影或存储入口；现行存档规范同步该行为。

子代理6.1-sol/high维护节点状态与类型，medium分别只读保存范围、更新存档规范。保留此前增量；源代码及相关diff为本批依据，未运行验收。

## 待老板统一验收

满包首次兑换→保存候选→整理返回→领取；候选保存失败后的继续；重新打开游戏后仍为同一卡；道具献祭复原及主回赠复原切换后候选保留；领取保存失败后单次扣款/发牌；旧档无候选、候选卡牌暂不可用与换档的情况。
