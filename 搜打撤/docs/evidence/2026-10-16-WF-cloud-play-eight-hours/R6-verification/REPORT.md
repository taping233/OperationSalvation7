# R6 独立冻结整体验收

结论：静态门通过；普通全量失败，484测试文件中482通过/2失败，4604 passed/2 failed/2个条件skip，0个unhandled error。普通build exit 1，原预算4项失败，原始结果全部保留。资产专项通过，195项排除、0警告；不能称全部质量门通过。

## 冻结与独立输入

- 来源`/workspace/scratch/b7a53a06c872/OperationSalvation7-f0e84c5d`，HEAD `f0e84c5dc34afcbc1176b1519258d2c3010c62cb`的未提交工作树；稳定源码复制完成`2026-10-15T23:21:14.688803+00:00`
- 新目录`/workspace/shared/cloud-iteration-verification-r6-20261016`，11510个源码/素材/测试/文档文件、712828056B；20秒稳定窗、复制前后来源及副本SHA一致
- 源manifest SHA256 `975a608ad540ff8a3f42426a053db7d683c1256764e694fc9ad9daebdef3a007`
- 真实Git13239项与独立依赖7738项检查前复制/hash核对，来源/deps/Git共享可写inode0；reflink失败时使用独立inode普通复制
- Git预检无remote/credential配置、外部alternates、symlink；不披露配置内容
- 沿用R5排除边界：活动roster/wu cutout预览、冻结引擎、历史重复快照、>1MiB历史证据、构建产物及缓存。实际Vite源码、素材、测试、脚本和现行文档纳入
- 未改共享生产、测试、断言、门禁、预算或审定指纹；未在共享源build，未操作浏览器/服务或提交。R5及其所有原红日志保留原样

首轮复制因新建`docs/evidence/2026-10-16-skull-sword-start-audit/README.md`（6655B）而失稳，已拒用并保留invalid-snapshot-attempt-1，没有删除旧资料。第二轮稳定并完成三类输入核验后才运行正式门。父最后写入的截图76与evidence目录pending契约测试晚于源码稳定点，仅两项证据新增、没有生产/正式tests差异；已逐SHA记录source-after-stable-copy-delta.json，未合并进入冻结副本。

R5已修契约基线到R6的逐文件增量见r5-r6-production-delta.json，涵盖药水栏CSS、helper r2.3-final、黑市预览flow、chests notice/共享card-capacity顺序容量预估及bag/session接线、献祭scroll保留、珍珠盒UI。R5四文件契约修复已纳入本轮正式输入。

## 正式命令

| 命令 | exit | 耗时 |
| --- | ---: | ---: |
| node --version | 0 | 0.007s |
| npm --version | 0 | 0.131s |
| npm ls --depth=0 | 0 | 0.670s |
| npm run check:syntax | 0 | 1.319s |
| npm run validate:data | 0 | 0.441s |
| npm run typecheck | 0 | 1.184s |
| npm run lint | 0 | 16.484s |
| npm run docs:check -- --json | 0 | 0.593s |
| npm test | 1 | 196.838s |
| npm run build | 1 | 14.215s |

普通npm test保留pretest剧情编译/数据校验；typecheck运行8套配置。正常build保留prebuild/Vite/postbuild，原预算源码与perf-budget脚本均与R5逐字相同，无skip/no-verify/调预算或绕过变量。skip不算覆盖通过。测试仅含配置指定tests/**/*.test.js，不包含evidence目录的pending契约草稿。

测试失败清单：
-  FAIL  tests/acceptance-gate.test.js > 分层验收选择 > 数据与剧情改动走定向，不再一票全量
-  FAIL  tests/sys03-loot-shop-txn.test.js > SYS-03 搜刮页事务序（chests.js） > takeAll 满包时保留未入包卡，金币只领一次，明确放弃后才离开

附加定向复跑：原两文件、原20秒限制，exit 1；这只用于定位，不替代上面的普通全量失败。具体结果见diagnostic-checks.json、test-failure-diagnosis.json及logs/focused-r6-failures.log。

- acceptance-gate原失败为20秒超时；原限制定向复跑2.639秒通过，可标全量负载下超时/定向未复现，不能替代原全量失败
- SYS03失败由takeAll真实grant拒收后，render按预估重算cant并去掉已记录的拒收反馈；夹具canReceiveCard为true、grantCard拒收B的分歧已核实，不直接视为旧断言过期

## 真实产物和原预算

| 指标 | R5 | R6 | R6-R5原始字节 | 原阈值 |
| --- | ---: | ---: | ---: | ---: |
| 总包 MiB | 119.583 | 119.588 | +4687B | 112.00 |
| entry gzip KiB | 288.087 | 288.943 | +877B | 270.00 |
| initial JS gzip KiB | 333.500 | 334.356 | +877B | 310.00 |
| 全部CSS gzip KiB | 196.129 | 196.490 | +370B | 136.00 |

R6产物1293文件、125396991B；重复字节16540B。收益只按真实产物，全部独立CSS均计入原预算。首屏JS引用与全部CSS明细见build-metrics-comparison.json。

原postbuild失败：
- 构建体积 119.59 MiB > 112.00 MiB
- 入口 JS gzip 288.9 KiB > 270.0 KiB
- 首屏 JS gzip 334.4 KiB > 310.0 KiB
- CSS gzip 196.5 KiB > 136.0 KiB

预算源码SHA256 `35972fa6e3fd93f363f9b7b53fe2c05f8c44d9a73ecfddc7a8ad0bc7934ae7e8`，没有放宽门槛。原失败日志、退出码与时间完整保留。

## 资产与完整性

- 冻结副本preflight collect 195/0警告；game.bag.js珍珠盒UI未触发新增assetguard告警，没有盲刷任何指纹
- 全195审定源图SHA保留，副本原图存在而产物排除；30旧卡图/缩略图共1291352B保留，原路径及同SHA副本均不发布，两生成manifest无旧图引用
- 30当前替代原图/缩略图均按相同SHA发布，art/thumb两manifest引用完整；正式wu cutout/room WEBP发布、room PNG源件保留且不重复发布
- 资产逐项见shadowed-card-publication-verification.json和required-formal-assets-verification.json；本轮不重复像素/外观实页验收
- 副本完整性通过；无意外源码/测试/模式/新输入或依赖变化，共享inode0。正常生成变化：
- `搜打撤/game/src/generated/art-manifest.js`
- `搜打撤/game/src/generated/thumb-manifest.js`
- Git index 13377条path/mode/object ID/stage语义相同，语义SHA `13e8908944a91adfe96cb270c8bf608eec8f7d7dd206f99066ab7fe6ac3929c2`；原始index字节变化如实记录，不回写来源
- 产物manifest SHA256 `a905da11660bb0e5305b2f27165632c451089cd962d74484798b2328c81dd9cc`
- 依赖manifest SHA256 `a289651fefbddca18476c65ada7fdef5d4c739dac9bfc08c971d237a04d2eff6`
- Git manifest SHA256 `3ad857e42e007b8d55fad440c83d4c5f9bc5acc76baeb4d1a45cbf7fa42a9c04`
- 复合输入清单SHA256 `97767510d5928f9a119c7d01f0cd9f00be50af0e8e03b07fdef9bc15f1a75570`

## 解冻后覆盖边界

末次来源观察`2026-10-15T23:28:04.082065+00:00`，既有输入变化：
- `搜打撤/docs/PARALLEL-REGISTRY.md`
- `搜打撤/game/src/battle/core/battle.core.js`
- `搜打撤/game/src/battle/core/battle.engine.js`
- `搜打撤/game/src/battle/core/battle.exec-play.js`
- `搜打撤/game/src/battle/effects/battle.card-inspection.js`
- `搜打撤/game/src/battle/view/battle.aim.js`
- `搜打撤/game/src/battle/view/battle.hand-inspector.js`
- `搜打撤/game/src/battle/view/battle.layers.js`
- `搜打撤/game/src/battle/view/battle.overlays.js`
- `搜打撤/game/src/battle/view/battle.view.js`
- `搜打撤/game/src/ui/inventory-zoom.js`
- `搜打撤/tests/battle-engine-facade.test.js`

另新增24个路径，完整列表见post-validation-integrity.json。父已批准的后续BOSS有效卡修复、所有解冻后变化、未来提交、远端CI、实页与持续游玩结论均不在本轮冻结覆盖内。

完整大manifest、独立快照、产物与脚本留在`/workspace/shared/cloud-iteration-verification-r6-20261016`；主evidence仅复制精简证据。
