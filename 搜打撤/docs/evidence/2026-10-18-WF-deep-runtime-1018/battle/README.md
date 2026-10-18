# 战斗真实运行链 CPU 定位与手牌差分优化

已实现的主收益是省去忙碌/就绪切换时的整卡重建。一次真实出牌仍经历相同的 3 次渲染，完整战场 HTML 与结算状态相同；25/28 张手牌 A/B 中，整卡 `innerHTML` 写入每次均从 **17 次降为 0 次**，跨渲染仍应存在的卡面节点从 160/500 保留提高到 **500/500**。

本轮只改 `game/src/battle/view/battle.layers.js`，新增 `tests/battle-hand-content-diff.test.js`。卡面内容仍按 `st.inner` 更新；忙碌、能量不足、目标限制及规则补充单独更新 `.bt-rulehint`，原有禁用属性与可访问名称继续更新。动态伤害、费用、堆叠数量改变仍重建卡面，新战斗重新建立状态。动态资产选择器、URL/路径构造、图片来源和 `decodeIn` 调用未变，素材守卫指纹由主会话独立审查。

## 定位结果

探针使用实际 BattleSession、Combat、卡库、快照、可用性检查、预览及战斗渲染模块。常规场景为 2 敌/12 张不同手牌，高负载为 4 敌/28 张手牌；两者均按真实命令穿戴 2 件装备，并有 3 种药水。入口图片就绪门、角色帧、音频和图片 URL 使用替身；宿主 overlay/HUD refresh 为轻壳，日志调用真实 `hudMethods.log`。未使用浏览器。

未改前首轮无插桩计时（每项预热 3 次，采样 15 次，单位 ms；[baseline.json](baseline.json)）：

| 一次操作 | 12 卡 median / p95 | 28 卡 median / p95 |
| --- | ---: | ---: |
| 完整快照缓存命中 | 0.157 / 0.243 | 0.101 / 0.145 |
| 状态变化后取完整快照 | 0.192 / 0.302 | 0.113 / 0.146 |
| 整手牌可用性检查 | 0.520 / 1.418 | 0.751 / 1.098 |
| 单目标可信预览 | 0.296 / 0.513 | 0.225 / 0.264 |
| 全体敌人可信预览 | 0.310 / 0.644 | 0.398 / 0.648 |
| 状态未变的完整渲染 | 4.684 / 9.011 | 2.905 / 4.569 |
| 生命变化的完整渲染 | 6.893 / 9.114 | 5.710 / 7.221 |
| 手牌分页 | 12.125 / 16.759 | 15.989 / 22.353 |
| 一条真实日志 DOM 写入 | 0.104 / 0.138 | 0.102 / 0.195 |

预热后的 CPU 采样流为每场景 12 次生命变更渲染、12 次真实手牌分页及 12 组预览，另一次相同流做分配采样。高负载的前三个源热点为：

| 来源 | 非 inspector 样本包含占比 | 该采样流分配估计 |
| --- | ---: | ---: |
| `battle.layers.updateHand` | 29.8% | 62.27 MB |
| `battle.layers.mountUnitLayer` | 17.1% | 46.32 MB |
| `battle.view.showBattleStage` | 16.7% | 33.66 MB |

这些包含值有父子重叠，不能相加。分配量包含采样到的已回收对象，主要来自 jsdom 的节点解析、查询与包装对象，不是保留内存、RSS 或浏览器分配量。快照签名、手牌判断、预览与结算均已测；它们没有占本场景的主要 CPU。4 种真实出牌首轮探针中，3 次渲染合计约 29–36ms，核心 `resolveCardWithFeedback` 仅约 0.1–0.45ms，故本轮优先修渲染。

手牌热点的可修原因是旧 `renderSig` 混入 `blockedReason`，进入/退出 busy 会把可见卡面整体替换，只为更新一条说明。其余两项分别来自每次重新定位单位挂载点的子树查询、变更时解析完整舞台模板并比较 11 个槽。本轮没有扩大修改它们。采样及分段完整摘要见 [profile-summary.json](profile-summary.json)、[segments.json](segments.json)；原始 CPU/heap JSON 均保留，SHA 在摘要中。

## 最终同输入 A/B

[probe.test.js](probe.test.js) 与 [vitest.config.mjs](vitest.config.mjs) 可直接运行。基线从保存的 `battle.layers.js.before.txt` 载入，候选分支精确载入 `battle.layers.js.after.txt` 的生产修改；没有回滚共享源码。两者在同一 worker 中交替顺序，每次重置真实场景，再打出血箭、箭雨、包扎或闪电链；每侧预热 4 张，计时 20 张。完整动态反馈开启，展示等待沿生产的 VITEST 分支立即兑现，CPU/DOM 工作保留。

| 真实出牌到收尾 | 25 卡 before → after | 28 卡 before → after |
| --- | ---: | ---: |
| 操作 median ms | 42.22 → 33.31 | 39.60 → 28.94 |
| 操作 p95 ms | 59.31 → 50.74 | 47.43 → 41.79 |
| 3 次渲染合计 median ms | 30.55 → 19.76 | 29.26 → 20.44 |
| 3 次渲染合计 p95 ms | 41.30 → 41.43 | 35.97 → 25.00 |
| 进程 CPU 平均 ms/操作 | 42.25 → 49.30 | 40.65 → 30.60 |
| 进程 CPU median / p95 ms | 47/63 → 47/95 | 32/62 → 31/47 |
| 整卡重建/操作 | 17 → 0 | 17 → 0 |
| 存活卡面节点保留 | 160/500 → 500/500 | 160/500 → 500/500 |

25 卡的 CPU 与渲染 p95 没有改善，噪声来源未单独定因；不能据此承诺全部 CPU 尾延迟下降。Windows 进程 CPU 计数在短操作中出现 15/31/47ms 等粗粒度值，包含整个 worker 的线程工作；各代理并行也有系统竞争。两组的总操作和渲染中位数均下降，DOM 重建和节点保留是确定的算法/分配来源收益。原样本全部保留于 [25 卡](hand-hint-ab-25.json)、[28 卡](hand-hint-ab-28.json)，未设墙钟阈值测试、未删除较慢样本。Node/jsdom 不含布局、绘制、GPU，也不覆盖真实演出等待或玩家可感延迟。

PowerShell 从项目根复现最终 A/B（把 25 改为 28 可复现另一组）：

```powershell
$env:BATTLE_PROBE_AB='1'
$env:BATTLE_PROBE_HAND='25'
$env:BATTLE_PROBE_FULL_MOTION='1'
node node_modules/vitest/vitest.mjs run --config docs/evidence/2026-10-18-WF-deep-runtime-1018/battle/vitest.config.mjs
$env:BATTLE_PROBE_AB=$null
$env:BATTLE_PROBE_HAND=$null
$env:BATTLE_PROBE_FULL_MOTION=$null
```

CPU/分段复现：不设 AB，设置 `BATTLE_PROBE_SOURCE=before`、`BATTLE_PROBE_INSTRUMENT=1` 后运行同一配置，再运行 `node docs/evidence/2026-10-18-WF-deep-runtime-1018/battle/analyze-profiles.mjs`。原始 profile 输出到 `.tmp/deep-perf-1018/battle/`；`BATTLE_PROBE_INSTRUMENT` 未开启时产生无插桩 `baseline.json`。新采样会覆盖结果，比较前应保留当前记录。

## 回归与冻结

最终命令已实际完成：

```text
node node_modules/vitest/vitest.mjs run tests/battle-hand-content-diff.test.js tests/battle-tools-lifecycle.test.js tests/page-perf-battle.test.js tests/battle-effect-feedback.test.js --maxWorkers=1 --minWorkers=1 --reporter=default --reporter=json --outputFile=docs/evidence/2026-10-18-WF-deep-runtime-1018/battle/targeted-final.json
```

**4 文件 58/58 通过、0 失败、0 跳过**，见 [targeted-final.json](targeted-final.json)。新 7 项覆盖忙碌/就绪节点与焦点保留、能量/目标限制、真实动态伤害与 per-UID 费用、手牌诅咒及动态段数提示、堆叠和新战斗。初期新夹具缺 jsdom `animate`，且费用变更断言先于既有旧槽位离场收尾；已补动画替身并等待真实收尾，最终报告同路径覆盖。生产只保留提示差分这一个改动，没有以减少反馈换收益。

源码、前后原字节、测试及证据 SHA 见 [verification.json](verification.json)。本代理未使用浏览器、未 build、未提交，素材守卫更新与后续整合门由主会话负责。
