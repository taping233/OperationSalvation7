# 桌面档案事务定向证据

生产实现：SaveSystem、AtomicJsonFile、SaveJson、GameRuntime.Persistence、GameRuntime.Settlement、BaseData、MetaProgress、RunEvents。

- 五槽Run、基地Global与结算回执统一保存到desktop-v1/profile.json。旧网页版与旧Unity档不导入。
- BeginTransaction期间暂存所有写入，成功提交才投递事件；失败恢复State、Base、Rng、待入库清单与成就通知状态。
- 撤离整理进度随回执保存，重启可继续；死亡、放弃与重复结算通过身份回执避免重复入库。
- Editor专用SDT_UNITY_TEST_DATA隔离路径仍保留。
- Run层SaveJson统一Slot/Global及State/Base事务回滚的RuleValue转换，Core不引用JSON库。

## 2026-10-29最终定向结果

`data-20261029-132748-068/result.json`：69条断言、10次真实文件写入故障全部通过。9次用同名目录阻断临时写入，1次用独占文件锁阻断最终原子替换；失败前后原档内容逐字比较，另核对内存、入库、经验/成就和成功事件。

覆盖撤离开始、单堆入库、全部入库、撤离完成、死亡、放弃、新局扣仓及携带、公共奖励复合操作、坏档保全、重复调用、读档续整理。

嵌套规则回归使用真实BattleSession：原始与生产存档读取后的同一卡均获得7点护甲，且triggers/onPlay嵌套仍为RuleValue。null卡实例、非法容器区域与负库存会拒读，并阻止覆盖损坏原文。

这些检查直接执行生产C#源码，音频和Unity平台资源口由测试适配器替换；不能代替原生Unity界面与真实鼠标验收。
