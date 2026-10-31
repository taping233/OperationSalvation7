# 背包容量差异定向核查

结论：这两张图对应不同时间和节点；7/25 与 7/16 不能作为读档丢容量的证据。现行代码、两份隔离档与 Journey 轨迹一致，当前未发现本次新档的容量恢复错误。此次只读核查未启动 Unity、浏览器或修改生产文件。

## 已核实事实

- Journey 的 `journey-page-ChestOpenScreen-3.png` 是轨迹 tick 115，位于第四层 `3,1`，显示「暗巷赌约」小型箱、矿工炸药和 7/25；文件后缀 `-3` 是层号，不是最终奖励序号。最终 `3,9` 大箱→中箱发生在 tick 171/172，二者之间还有多次战斗、丢牌和祭坛。
- Journey tick 110、115、119、141 的画面文本为容量 25；tick 119 战斗卡面包含「本牌内置 3×3 格空间，可容纳所有类型的资源卡牌」。tick 154 祭坛画面已经是 16，早于最终 `3,9` 和新重放。
- Journey 最终档位 5 的 `bagUp=0`、序列化 `BagCap=16`，现有卡牌没有珍珠宝盒或任何资源容器，计算资源额外容量为 0。节点收据 `1,10`、`2,8` 都保留选择珍珠宝盒 index 0 的领取历史；历史领取不会自动等于当前仍持有。
- `CardContainerCommands.Query` 的容量等于 `Base.BagCap + ResourceBonus(owned)`；基础值是 `min(BagMax,16+bagUp)`。珍珠宝盒贡献 9，正好解释早期 25。原 Web `core/card-capacity.js`、`hub/base.js` 和 `run/game.session.bag.js` 使用相同基础值加资源容器规则。
- Journey 测试 `MakeRoom()` 会主动丢弃非初始、非安全格/收纳卡，可能包括资源容器；祭坛也消耗选中卡。现有轨迹未逐次记录丢弃 UID，不能精确指定珍珠宝盒在哪次命令离包，但 25→16 在原 Journey 内已经发生，有明确画面文本证据。
- RewardTransition 从原最终档逐字复制，然后 `LoadRun(5)`。重放 Reset 删除的三个 UID 对应铸甲、龙焰射线、法力光波，都不贡献容量。JSON 定向计算确认 Reset 前、删除后、重放完成后的资源额外容量全为 0，基础容量全为 16；Reset 轨迹也直接记录 capacity 16、usedSlots 3。恢复三张大箱卡后 6 格，再选中寒冰剑变 7 格，符合 7/16。

## 读档与界面路径

`ChestOpenScreen.Build()` 直接把 `g.UsedSlots()` 与 `g.BagCap` 写入 `CurrentRewardScene.Info`；场景组件不保存独立容量。`NewRunCore()` 在 `Base.Slot` 不匹配时加载该档基地；`EnterSlot()` 始终加载该档基地。新运行时 `ActiveSlot=null`、默认基地未绑定档位，`LoadRun(5)` 因档位变化调用 `BaseData.Use(Saves,5)`；`Use` 读取该档 key 并设置 `Slot=5`。本次 source/target 同为 seed 169015024、层 3、位置 9，均为 slot 5，不存在本次 slot/base 对错档证据。

Unity `LoadRun` 对同一个 ActiveSlot 会沿用已加载基地，Web 恢复器每次 `Base.use(slot)`；这是代码差异，但本次场景从标题进入 slot 5，且两份当前基地升级值相同，因此不构成本次故障证据。未扩展核验进程外修改同档基地后再次加载等其他场景。

## 验证与指纹

运行 `python SoudacheUnity/_planning/migration-1029/current-capacity-reload-check/check.py` 退出码 0。该脚本只读取原资料并写本目录 `results.json`，断言两档身份、基础值、Reset 删除 UID、删除前后资源容量，提取相关时间线；没有运行或重编译生产域代码。源 Web HEAD `9336c1df1e567f010cbdc6edbd4b2b40502b1482`；目标 Unity HEAD `0bdcb665bd49e47fadbf91707e6a654430cc6d95`。工作区可能含未提交改动，实际相关文件 SHA256 全部列于 `results.json`，以该文件指纹为准。

无需为这组容量差异修改游戏代码。此核查只解释已有隔离原生新档的证据，不声称覆盖所有容量或存档组合。
