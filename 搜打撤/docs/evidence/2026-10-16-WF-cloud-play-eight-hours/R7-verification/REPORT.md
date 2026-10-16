# R7 独立冻结整体验收

结论：静态门通过；普通全量最新一遍通过，492文件中492通过/0失败，4695 passed/0 failed/2个既有条件skip，0个unhandled error。普通build exit 1、原预算4项失败，原始结果完整保留。资产专项通过，195项排除、0警告；不能称全部质量门通过。

## 冻结输入及最终作者版本

- 来源`/workspace/scratch/b7a53a06c872/OperationSalvation7-f0e84c5d`，HEAD `f0e84c5dc34afcbc1176b1519258d2c3010c62cb`未提交工作树；源码稳定复制完成`2026-10-15T23:53:58.845575+00:00`
- 新目录`/workspace/shared/cloud-iteration-verification-r7-20261016`；11668个输入文件、714432977B；20秒稳定窗，复制前后来源与副本SHA相同，三类输入独立核验后才通知解冻
- 源manifest SHA256 `54344d79e7d41f9caa608e6434878e7bf73fba81321dc776e150f4ed80fbb102`
- 独立依赖7738项、真实Git13239项均检查前复制/hash核验；reflink或独立inode普通复制，没有共享可写inode
- Git预检无remote/credential配置、外部alternates、symlink，不披露配置内容
- 复用R6排除类：活动roster/wu cutout预览、冻结引擎、历史重复快照、>1MiB历史证据、产物和缓存；新增项目已ignore的.vite-cache按缓存排除
- R6后37项生产/测试增量见r6-r7-production-delta.json：scenes复原UI、safepearl入口、真实grant失败notice优先、BOSS有效卡/内部直接释放、药水pointercancel生命周期、祭坛完成态与.gitignore缓存项等
- 作者最终8条SHA逐项匹配，包含inspection最终SHA `5ede79e3981ab8c83ffe9408e3c736a1123c4213c82ecd1e19afdb10ee70eac2`；详见author-final-fingerprints.json
- 此结论只来自本轮普通完整命令；作者早前33文件390pass、小补91pass及旧来源full的4645/17/2红均不混算，旧红证据保留
- 未写共享生产/测试/断言/门禁/预算/指纹，未共享源build、未操作浏览器/服务或提交；验收worker未操作原PID469现场或重启服务；父在解冻后自主重启，不属于本验收操作

## 正式原始命令

| 命令 | exit | 耗时 |
| --- | ---: | ---: |
| node --version | 0 | 0.006s |
| npm --version | 0 | 0.123s |
| npm ls --depth=0 | 0 | 0.682s |
| npm run check:syntax | 0 | 1.467s |
| npm run validate:data | 0 | 0.354s |
| npm run typecheck | 0 | 1.059s |
| npm run lint | 0 | 13.230s |
| npm run docs:check -- --json | 0 | 0.561s |
| npm test | 1 | 179.191s |
| npm run build | 1 | 15.835s |
| npm test（第二遍，同原配置/时限） | 0 | 189.218s |

正常npm test含pretest剧情编译和数据校验，typecheck运行完整8套配置；正常build保留prebuild、Vite和postbuild。无skip/no-verify、调预算或绕过变量，条件skip不算覆盖通过。所有UTC起止与完整日志见checks.json、auxiliary-checks.json、logs/。

首遍普通full为3文件/3项红，原日志/退出码完整保留，第二遍在父保持静止界面、无其他测试时用同一npm test/同一时限执行；两遍结果分别见checks.json及second-full-check.json。最新结果不抹掉首遍失败。

首遍测试失败清单：
-  FAIL  tests/acceptance-gate.test.js > 分层验收选择 > 卡牌稀有度规则改动选中直接契约测试
-  FAIL  tests/runtime-asset-redundancy.test.js > reviewed production-only asset omissions > omits exactly the 15 reviewed shadowed originals and their thumbnails, retaining the four referenced card pairs
-  FAIL  tests/workflow-cli-integration.test.js > 流程入口集成 > JSON模式与直接字段混用在读文件前拒绝，close漏项不被自动填成完成

父另提供独审最终probe日志：1文件11项通过，SHA c9d9b8f7f75965c4fe47a244b6cd222e8bf0a57715682b40f27855c31a93bdad，作为独立补充材料留存。该探针由独审执行，不计入本轮正常full数字，也不扩张本轮普通门覆盖声明。

三文件原配置/原时限定向复跑3文件78项通过；该绿只作定位，不覆盖原full三红。两个原20秒超时明确；workflow-cli原日志只有status=null，没有记录error.code/signal，其10秒子进程时限只能支持疑似负载相关，不能标为已观察到ETIMEDOUT。详见test-failure-diagnosis.json。

## 真实产物与原预算

| 指标 | R6 | R7 | R7-R6原始字节 | 原阈值 |
| --- | ---: | ---: | ---: | ---: |
| 总包 MiB | 119.588 | 119.595 | +7829B | 112.00 |
| entry gzip KiB | 288.943 | 289.943 | +1024B | 270.00 |
| initial JS gzip KiB | 334.356 | 335.356 | +1024B | 310.00 |
| 全部CSS gzip KiB | 196.490 | 196.730 | +246B | 136.00 |

第二遍正常npm test后逐文件产物manifest与首遍build完全相同，未重复build。产物1293文件、125404820B、重复字节16540B。收益只按真实产物；所有CSS块纳入原CSS预算，首屏JS及全部CSS逐项见build-metrics-comparison.json。

原postbuild失败：
- 构建体积 119.60 MiB > 112.00 MiB
- 入口 JS gzip 289.9 KiB > 270.0 KiB
- 首屏 JS gzip 335.4 KiB > 310.0 KiB
- CSS gzip 196.7 KiB > 136.0 KiB

预算源码SHA `35972fa6e3fd93f363f9b7b53fe2c05f8c44d9a73ecfddc7a8ad0bc7934ae7e8`，与R6相同，perf-budget脚本也逐字一致，没有放宽门槛；R6及更早全部原红日志未覆盖。

## 资产和完整性

- preflight与构建后collect仍195项、0警告；没有盲刷审定指纹
- 195项审定源图与冻结SHA相同且副本保留；30张旧卡图/缩略图1291352B保留、原路径和同SHA副本不发布，两生成manifest无旧路径
- 30张当前替代原图/缩略图发布SHA相同、两manifest引用完整；wu cutout/room WEBP继续发布，room PNG原件保留且不重复发布
- 副本完整性通过；源码/测试/新增输入/mode与依赖无意外漂移，共享inode0。正常build生成变化：
- `搜打撤/game/src/generated/art-manifest.js`
- `搜打撤/game/src/generated/thumb-manifest.js`
- R6/R7冻结HEAD与tree相同，两次git diff --cached均为空；初始Git manifest只有原始index附属/stat-cache字节不同，非提交或暂存内容变更，见git-baseline-semantics.json
- Git index 13377条path/mode/object ID/stage语义不变，语义SHA `13e8908944a91adfe96cb270c8bf608eec8f7d7dd206f99066ab7fe6ac3929c2`，原始index字节变化如实记录且不回写来源
- 产物manifest SHA `203ce0aecfb8b71037ce18d3f43aa88b03e8be99ead47cbdcfce793a0e4d8c92`
- deps manifest SHA `a289651fefbddca18476c65ada7fdef5d4c739dac9bfc08c971d237a04d2eff6`
- Git manifest SHA `9e1198869ac88ab9d0354ee0c0f3d0618864db72b663d27ced091b023160edb7`
- 复合输入清单SHA `c058ca5389ffc5d4a1788a8954634cd5118b8087ae565cc22efccbb59c969602`

## 解冻后边界

末次观察`2026-10-16T00:04:15.504536+00:00`，既有来源输入变化：
- `搜打撤/docs/PARALLEL-REGISTRY.md`
- `搜打撤/docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md`
- `搜打撤/game/src/battle/core/battle.core.js`
- `搜打撤/game/src/battle/view/battle.preview.js`
- `搜打撤/tests/r3-a-preview.test.js`
- `搜打撤/tests/skull-sword-effective-session.test.js`

另新增10路径，逐项见post-validation-integrity.json。所有解冻后变化、后续提交、远端CI、浏览器实页、真实输入与持续游玩均不在本轮冻结全量结论内。

完整大manifest、独立快照、产物及执行脚本保留在`/workspace/shared/cloud-iteration-verification-r7-20261016`；主evidence仅复制精简证据。
