# 高频流程收拢：整备选择与实际出征一致

状态：本批修改完成，编辑释放，待老板统一验收，全部保留未提交；地图必要发布失败的显式继续入口仍待接齐。

源码差距：手动整备将同名每格上限作为总携带上限，而预设预览支持继续占格；预设编辑按cardId处理同卡不同variant，预览与应用的库存解析口径不同。珍珠盒额外容量还需与资源专用规则保持一致。

范围：`game/src/hub/game.hub.depart.js`、`game/src/hub/departure.summary.js`、`game/src/hub/game.hub.preparation.js`、`game/src/hub/preparation.view.js`、`game/src/hub/preparation.commands.js`、`game/src/hub/preparation.types.d.ts`、`game/src/run/game-session-departure.js`及`docs/modules/secondary-ui-style.md`。复用已有库存身份、计格和保存入口，保持Base事务与数值规则。

## 实施

- 纯摘要新增基础容量、普通/资源格及`capacityOk`；手动选择、推荐和预设共用真实计格。手动同名叠满后可继续占下一格，移除资源容器前说明超出容量的资源；出发前再按同一摘要确认容量。
- 预设选项使用实际仓库快照与版本；精确移除对应CardRef。预览先分配显式版本，旧未指定版本的预设基础优先、再按仓库顺序，共享剩余库存；歧义正式堆不计入可用数量。返回`deploymentPicks`及每行`allocations`，应用直接使用同一结果，沿用现有存档格式。
- 预览与应用随当前玩法；资源容器的额外容量仅容纳资源。实际分配名称、稀有度与费用用于预设说明。
- 整备携带伙伴使用公共`runHubOperation/holdHubOperationControls`，原页显示等待/失败/实际成功，等待中出发暂停。来源使用现有Base对象、档位及选择代次；应用失败保留原选择回调。
- 确认整备音效、提交后的教学提示与出征音效分别处理异常；发布时音乐、清日志与逐条日志分别处理异常，继续地图发布和原人物确认流程。现有防重复创建远征条件保留，旧手动携带总量封顶与重复计格入口退出。

子代理使用6.1-sol：预设与容量high，出征发布medium。只读核对源码和相关diff，未执行运行验收。

## 后续接齐

`game-session-departure.js`中必要的`enterLayer`发布本身失败仍走原异常路径。实际出征可能已提交，而现有`pendingDeparture`只恢复仍有日志的未完成事务；需要明确区分已提交后的发布继续，沿同一次远征恢复，接到原人物确认入口。下一批由本持续目标处理，不能以本批装饰异常处理声称该情况已完成。

老板统一验收范围：手动超过一格的同名牌、满包及珍珠盒资源专用格、同ID不同版本预设的选/删/应用、旧无版本预设、伙伴切换、返人物/模式与重新选档，以及出征音效/日志异常。

按老板要求不运行测试、lint、构建或实页，不新增测试，不提交推送。
