# 常驻战斗舞台与注入：v4 修正后一致性集成

本批接入精确已发布 `35228afa`（v29 诊断前置），保留诊断生产源码与 infusion helper 字节。stage v3 首次完整门发现真实失败，**v3 不可发布**；现通过冻结的六文件窄修正组成 v4。完整原失败、负控与旧版本性能证据全部保留，不以新结果覆盖历史失败。

## 最终实现与来源

- 战斗舞台/HUD按组件持有并同步校验真实DOM，标量变化不重新解析整舞台。v4补齐实时token与根节点位置；药水提示只接受当前会话/页面/药水栏中确切控制节点，数量变化的当前节点仍保留并读最新数据。隔离QA页由其原host重施禁用策略，不改正常游戏UI。
- 注入只求有效材料是否存在，保留完整原始手牌映射与legacy修复、实际添加查找、最终逐UID校验及实时规则读取。
- 原stage补丁+infusion共19文件，随后精确六文件v4增量改变两stage生产文件、QA host与三测试；最终组合22文件的哈希见[final patch hashes](final-patch-file-hashes.json)。[v4增量](v4-correction-manifest.json) SHA256 `58561fef26ac1244353734a4baafa08335bf2eff412bf5a6c4a63c801251e44e`，原stage另五个生产文件和infusion helper不变。
- 未改玩法、结算、随机数、存档、依赖、资源或预算。layers的四项资产表达式完全不变，仅刷新原opaque审核指纹，原286项排除规则不变：[审核](asset-fingerprint-review.json)。

## 正确性与完整门历史

原v3正常FULL：766文件8045项通过，2文件3项失败，1文件7项跳过；两失败文件独立复现同3断言失败。token损伤后旧提示未清理、旧控制节点归属与QA host禁用策略均已查明；另以真实render证实根位置改变会令HP停旧值，纳入同一归属窄修。[完整失败摘要](v3-full-gate-failure.json)、[原日志](v3-full-gate-failure.log.txt)。

最终v4纯stage隔离39文件586项、架构39项通过；冻结v3源负控7项按预期失败。旧“离开节点”fixture现在真实detach，并保留禁止document监听的原断言；另增加数量变化当前节点复用/最新值、关闭/切页/token/新战斗拒绝旧监听与root修复证明，没有删减门禁。[v4定向](stage-v4-focused.log.txt)、[负控](stage-v4-negative.log.txt)。

混合main额外8文件101项全过，覆盖原失败、stage/mount/validator、真实UI+诊断+stage交叉边界及infusion：[日志](combined-v4-focused.log.txt)。诊断交叉证明面板在overlay内但ovBody外、HUD节点复用、设置替换/返回、同步按钮与默认背景inert。这是jsdom构造输入，不冒充浏览器实玩。正常冻结门仍按原选择器/配置运行，CPU affinity 0仅约束资源；最终完整门和普通hook以交付manifest及其精确receipt为准，失败不算通过。

## 构建与原预算

最终v4标准 `npm run build` 原预算全部通过：1595文件/171888356 B；entry gzip368364 B（余276 B）、initial JS418066 B、CSS226802 B。相对v29包增加10511 B、entry增加4 B。[摘要](build-summary.json)、[输出SHA256](build-output-manifest.json)、[812项输入守卫](build-input-check.json)。

共三次完成构建，全部如实记录：首次错误hosting路径总数断言遇到额外build-provenance后，shell缺失fail-fast继续build，旧opaque指纹使排除数归零并超entry预算；纠正fail-fast、逐一核验旧1595产物hosting副本及Git blob、审核准确指纹后第二次v3预算通过，但其FULL失败而被拒收；第三次为当前v4标准构建通过。没有扩大预算、绕过outDir或删减正确性。首次失败见[日志](build-first-unreviewed.log.txt)及[原因](first-unreviewed-summary.json)，旧v3完整产物/源码指纹在工作区`coherent-render-integration-20261021/failed-v3/`。

## 性能证据与范围

最终v4采用与旧发布91052c8b/tree ea0da5c7相同harness的新四对独立A/B，源/8生产文件manifest分别核验；104检查点状态无差，DOM只有明确恢复的手牌role/label。该独立profile不含诊断+infusion合并后的总体速度，亦不证明浏览器FPS/GPU/layout/paint。最新v4报告和原始SHA索引随本证据保存；现存v3的profiler文件仅历史证据，不作为v4定量结论。

v4 HP-change median：常规8.654→4.971 ms（-42.6%），高负载8.535→4.564 ms（-46.5%）；采样累计分配量中位下降48.3%/47.7%（包含已回收对象，非常驻内存）。保留短high unchanged反指标：wall p95 7.046→7.130 ms、CPU p95 8.034→15.225 ms。三对充分预热idle的wall median/p95为5.654/9.048→4.541/6.658 ms，CPU为6.249/12.347→5.497/12.252 ms；不声称所有指标均改善。[最终报告](profiler-HANDOFF-v4.md)、[完整摘要](profiler-v4-analysis-summary.json)、[129项原始哈希](profiler-v4-raw-hash-manifest.json)、[独立66契约](stage-v4-independent-contracts.log.txt)。

## 待父会话实页与发布

本任务不提交、推送或部署。父已保存v29真实输入基线：62行trace SHA256 `b7c17217f1213ef978534b122da735ca5dc14bc973a1b03849dc7f81c254072a`（3次取消+1次攻击），原档在工作区`live-battle-baseline-v29-20261021/`，不是当前候选实页结果。候选仍需同场渲染/设置返回/焦点/翻页、注入add/full/remove、规则改变与最终支付的内置浏览器验证；远端CI与发布不在本次本地门证明内。
