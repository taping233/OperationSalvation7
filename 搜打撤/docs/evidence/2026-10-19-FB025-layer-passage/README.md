# FB025 统一跨层入口

## 需求与断点

44条原始反馈第025条，2026-10-18T14:50:13.628Z，对局地图：「层级间的跳转缺少演出动画」。现行代码原来只有 `moveTo.commitNode` 调用 `showLayerPassage`，常用的 `goDoor` 直接关闸门页再 `enterLayer`，未经过层级演出。

## 当前实现

唯一展示入口仍是 `ui/map-passage.js`，不另造一套跨层路由：

- `showLayerPassage(game, from, to)` 同层、减少动态或turbo返回null；正常返回 `{done, dispose, current, game}` 展示句柄。调用者同步提交移动，展示层不写层索引、地图、消费、存档或game.state。
- 唯一层级幕在入口同步挂载，复用 `page-surface-lifetime` 管理宿主/取消；键盘、pointerdown、click只在本幕有效时拦截。`isLayerPassageActive(game)`为地图移动/脚下重入提供同源锁；失效时清理。`cancelLayerPassage()`只结束表现。
- 正常最短820ms准备/展示后，180ms退出；准备未就绪仍盖住目标，最多3秒释放输入作为表现兜底。显式闸门已经提交idle目标后调用Renderer.prepare准备首帧；路线插值移动保留自己的相机，不调用该准备接口。减少动态/turbo不增加等待。
- `goDoor`正反向都先挂层级幕，再即时关闭原闸门页，避免额外叠加返回地图幕；随后仍同步调用原 `enterLayer(toLayer,arriveAt,{glideCam:true})` 和音效。同步业务报错仅释放展示再交回原错误。保留goDoor的data-cancel=false及doorBack的data-cancel=true。
- `moveTo`只在实际跨层提交时取得同一展示句柄；已有moving事务锁保持到该幕结束，然后仅一次结算目标节点。位置、首探、回合、门旁商店消费和原存档规则不迁到表现模块。其余同层路线没有额外等待。

`enterLayer`实现仅读取game.layerData，没有替换数组；goDoor前后数组身份相同。旧句柄只移除自身节点/监听器/计时器，只有active仍等于自身operation才清空公共引用；旧准备晚到不能拆新幕。换局/无效目标会取消表现，不逆转已经提交的位置。flow改动只在移动及reenterCell段，事件段保持原位。

## 定向验证

批量完成后8文件119项通过：map-passage、map-travel-motion、node-cancel-semantics、event-callback-lifecycle-audit、node-retrigger、first-explore-marking、contracts、architecture-boundaries。
首次默认并发测试工具报ERR_IPC_CHANNEL_CLOSED且没有最终汇总，不能计为完成；同批使用maxWorkers=2完整重跑119项通过。这是测试进程通信异常，不是游戏运行崩溃证据。

再补一项真实moveTo完整抵达回归：跨层只提交一次、幕结束前仍moving、结束后仅一次目标结算并释放锁；首次新用例因fake timers覆盖rAF桩失败，修正夹具后该文件7项全绿。最终去重8文件120项通过。局部ESLint与git diff --check通过。

新增/扩展覆盖正反向闸门都有唯一层级幕、取消不跨层、无重复地图返回幕、源页旧动作不提交、直接相邻跨层的同一输入锁/完成边界、首帧挂起上限、减少动态/turbo/同层无幕、旧准备不拆新幕、换局不回滚业务。门旁商店关闭/重入/穿门消费与首探打标沿现有集成用例核验。

## 资源与验收边界

未修改资源URL或选择集合；runtime-asset-redundancy-review没有map-passage/flow/altar选择器登记，无需新资源指纹。只调整现有层级幕CSS：稳定不透明底由整幕保持，文字进场，准备完成才淡出，避免业务跨层时从透明首帧起播。

这些均为源码/jsdom合成时序证据。当前平台实页阻塞，尚未验真实镜头/层级幕衔接，也不声称视觉上已不闪烁。未使用headless/CDP替代，没有build/commit/push/新服务。其他完成未提交和事件属地保留。
