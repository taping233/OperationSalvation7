# 当前插画节点与奖励房间迁移

当前生产已部署，等待统一原生窗口复核。源与生产冻结值、待安装的私有补丁以 receipt.json 为准；静态编译和素材存在不代表视觉验收。

## 当前运行链

- 事件、火堆、拾取使用 node-scene-view/illustrated-node；最终 body #overlay#overlay 高优先级覆盖决定58:42布局与纸条选项。共享顶栏由 CurrentRunTopBar 持有。
- 入城走 openEntrySupply 的 reward-v14，不激活历史插画入城壳。普通领奖背景是 expedition-rewards.css 的 reward-salvage-v1，入城才覆盖冬季入口图。奖励页隐藏共享章节名称，让原28px标题居中。
- 药品站、军需处的完整链是 openEventPotions/openEventQuartermaster → drawEventCards → eventDice → 完成三张固定候选 → event-card-choice → rewardScene。骰子仍为当前真实步骤。
- chests.presentRewardBox 和 renderCurrentStage 直接进入 cards。safeOpeningHTML 未被导入/调用；本片保留直接领奖，不启用历史开箱帧。
- coin 在950ms搜索后点获取才入账；wood/rations/key 进入卡牌奖励页，领取前不发库存资源。金币保存失败按源保留一次内存领取，重试只保存；其他奖励沿Unity现有原子事务，失败不提前taken/lost。
- 事件 rewards(...) 路由到同一固定奖励队列；capacityCard 声明的木材+碎片、单火球+治疗在确认时同事务授予。阿猫选择先承接固定奖励页，主卡与附赠独立待领。

## 边界与维护入口

- 七个房间页、CurrentIllustrated*、CurrentReward*、CurrentOutcomeFeedback、CurrentPickupSearch，以及 Res.CurrentNodeAssets/独有资源目录。
- GameRuntime.CurrentNodeRewards 统一奖励领取、金币、永久放弃和当前队列继续准备；GameRuntime.CurrentPickup 统一即时coin准备/领取/保存/离开。
- GameRuntime.cs仅RunInstant四种即时节点；GameRuntime.Events仅rewards路由；EventRoutes仅阿猫特殊承接与赌约成功固定奖励；Boot/RunLoopBridge仅四种即时节点路由。
- Core仅NodeVisitReceipt三种pickup状态、ChestVisitReceipt.lost/source。没有第二套战斗引擎或UI重算收益。
- CurrentRunTopBar只接房间返回守卫、奖励页章节隐藏、实际插画壳渐变识别。Entry未领齐的系统返回按实际源开LeaveMenu，移动闸门不绕过。

## 检查与证据

source-data.json 记录真实入口、导入链、49个源模块/CSS SHA与100个角色事件文本。assets-receipt/asset-checks 记录49项源→输出SHA及逐像素/原尺寸核验。转换仅解码原WebP和按原路径栅格化SVG；未生图、未删旧资产。单文件超过1MB的二进制不提交。

check_isolated.py 只在本目录隔离快照编译，未运行Unity；check_domains.py 用正式Run/存档命令验证领取、防重、满包跳过、失败回滚、重载、阿猫附赠、真实三骰、指定容量奖励与战后完成边界。保留既有Core 289/167回归。

统一原生窗口仍需核对各房间布局与裁剪、卡面阅读/领取分离、真实计时、重入与整理、骰子已存结果、胜利额外奖励/首脑续流、保存失败页面重试。该清单未用私有编译替代验收。
