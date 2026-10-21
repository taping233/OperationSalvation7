# 手牌入手空闲分配验证

真实基线306376b7a80021a1820ad8d3d1047cae74d9020c（已部署v25）。原三文件补丁逐字接入，前后SHA见[接入清单](applied-patch.json)。仅在drawn非空时、替换旧rec.group之前捕获旧叠UID；只有入手事件或离页pending存在才构造入手反馈集合，incoming为空不逐叠比较。stateFor与页面徽标同步始终执行，玩法、动画时序、聚合和既有单位/帧逻辑不变。

- 独立[10文件239项](independent-tests.log.txt)通过；原两源码[负控](negative-control.log.txt)恰有3项新增断言按预期失败，随后恢复候选并通过最终239项。覆盖无事件pending删减/翻页、新场清理、旧提示清理、堆叠新UID、减动效、新槽飞牌、旧token与非入手事件等。
- [旧计数](baseline-counts.json)、[新计数](candidate-counts.json)来自真实生产路径的受控jsdom执行，使用显式依赖替身与分配观测包装。[复现实验](measure-hand-acquisition.mjs)可传项目根路径。20次九叠空闲更新中，仅入手记账相关Map20→0、Set240→0、Array480→0，合计740→0；DOM不变。不是全部手牌分配归零，也不是堆字节、FPS、帧时或浏览器测量。
- [独立资源复核](asset-consumer-review.json)确认资源选择未变，仅更新layers一条SHA；[41项守卫](asset-guard-targeted.log.txt)通过，原负控和固定保护不改。

[唯一标准构建](build.log.txt)通过：1595文件、171876753字节，比306基线变化+54字节；[预算摘要](build-summary.json)、[逐文件清单](build-output-manifest.json)和[静态闭环](runtime-asset-closure-final.json)保留。按原选择器运行冻结暂存门与普通hook，不额外强制full；最终大回执外置保存，不在门后改入库字节补写通过。本批尚未部署或实页/远端CI核验，旧v25证据不覆盖本补丁。

独立早期分组测试中两项请求文件名不存在，未计覆盖；完整最终10文件结果才是上文依据。原记录均在独立目录保留。
