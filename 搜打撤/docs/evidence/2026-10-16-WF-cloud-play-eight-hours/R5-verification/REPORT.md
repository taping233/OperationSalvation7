# R5 独立冻结综合验收

结论：R5 静态门通过，普通全量测试失败，478 个测试文件中 4 失败/474 通过，14 failed/4509 passed/2 个既有条件 skip，另1个未处理错误，exit 1。普通 build 的 prebuild 与 Vite 编译成功，postbuild 原预算仍四项超限，exit 1。195 项资产排除与发布专项通过、0 警告；不能称为全部质量门通过。

## 冻结输入与独立边界

- 来源 `/workspace/scratch/b7a53a06c872/OperationSalvation7-f0e84c5d`，HEAD `f0e84c5dc34afcbc1176b1519258d2c3010c62cb` 上的未提交工作树；源码冻结完成 `2026-10-15T22:24:49.062624+00:00`
- 新目录 `/workspace/shared/cloud-iteration-verification-r5-20261016`；11331 个源码/素材/测试/文档输入、709517890 B，20 秒稳定窗口、复制前后来源与副本 SHA 一致
- source manifest SHA256 `b379f29db8c5f19a713f96aa00ad9fb4c2b63748f01015e684cab74b9422b109`
- 7738 项依赖、13239 项真实 Git 元数据在检查前独立复制、hash 核验；来源/依赖/Git 共享 inode 均为 0
- 每文件尝试 reflink，失败使用独立 inode 普通复制；没有共享可写依赖目录，没有在来源树 build
- Git 复制前确认无 remote/credential 配置、外部 alternates、符号链接；未披露配置值
- 沿用 R4 排除边界：活动 roster/wu cutout 预览、冻结引擎、历史重复快照、>1MiB 历史证据、构建产物与缓存；实际 Vite 源码、素材、脚本、测试与现行文档均纳入
- R4 保留原样；未操作浏览器/服务，未改来源生产源码、测试、断言、预算、门禁或 consumer 指纹，未提交/推送。来源仅在最后新增本自有证据目录

R4→R5 生产/测试 delta 逐文件见 `r4-r5-production-delta.json`：14 个 game/src 文件、1 个 CSS、game/index.html、审定指纹脚本与14个测试文件。涵盖 round 记录、献祭/结算 CSS、庭院与照片 probe 生命周期、Meta/base 坏输入及奖励原子保护、阿猫/征用附赠待领、额外传说待领、启动 guard、重复 battle 工具栏、MessageChannel/commDemo 惰性。覆盖按本轮冻结输入认定，不套用 R4 测试结果。

## 正式检查与原始退出码

| 命令 | exit | 耗时 |
| --- | ---: | ---: |
| node --version | 0 | 0.006s |
| npm --version | 0 | 0.152s |
| npm ls --depth=0 | 0 | 0.677s |
| npm run check:syntax | 0 | 1.372s |
| npm run validate:data | 0 | 0.346s |
| npm run typecheck | 0 | 1.457s |
| npm run lint | 0 | 12.934s |
| npm run docs:check -- --json | 0 | 0.502s |
| npm test | 1 | 132.341s |
| npm run build | 1 | 14.462s |

普通 npm test 保留 pretest 剧情编译、数据校验；typecheck 完整运行8套配置。普通 npm run build 保留 prebuild、Vite 和 postbuild，无 skip/no-verify/调预算或绕过变量。2 个条件 skip 如实保留，不算覆盖通过。原始日志、UTC 起止与退出码见 `checks.json`、`auxiliary-checks.json` 和 `logs/`。

## 全量测试失败诊断（原日志保留）

- tests/map-travel-motion.test.js：3败；tests/node-flow-confirmation.test.js：4败；tests/r6-story-flow.repro.test.js：6败
- 三个文件的旧game.run.scenes mock缺少新openFixedRewardsOnCell导出，flow.js:705组装controller时读取即抛错；r6最后的release is not a function与1个unhandled rejection同属此前置异常链
- tests/selftest-paths.test.js：1败；game/selftest.js:91用完整旧注释作为正则契约，game.bag.settle.js:394注释由“BOSS 战后不再进入整理背包”改为“BOSS 战后不再强制整理背包”，因此静态匹配失败
- 以上根因是已核实的mock接线/静态文本契约不一致；这不构成生产玩法通过证明。没有改源、改测试或在本快照内补丁重跑，原14败与unhandled完整保存
- 机器可读明细见test-failure-diagnosis.json。父已收到根因，后续修复与新全量结果应使用独立轮次，不覆盖R5原失败

## 真实产物与 R4 对比

| 指标 | R4 | R5 | R5-R4 原始字节 | 原阈值 |
| --- | ---: | ---: | ---: | ---: |
| 总包 MiB | 119.577 | 119.583 | +7031 B | 112.00 |
| entry gzip KiB | 287.997 | 288.087 | +92 B | 270.00 |
| initial JS gzip KiB | 333.410 | 333.500 | +92 B | 310.00 |
| 全部 CSS gzip KiB | 195.838 | 196.129 | +298 B | 136.00 |

产物共 1293 文件、125392304 B，重复字节 16540 B；首屏引用文件与全部 CSS 文件逐项见 `build-metrics-comparison.json`。收益只依据产物，不依据源码字符数或拆分预估；所有独立 CSS 都纳入原预算。

正常 postbuild 的四项原失败：
- 构建体积 119.58 MiB > 112.00 MiB
- 入口 JS gzip 288.1 KiB > 270.0 KiB
- 首屏 JS gzip 333.5 KiB > 310.0 KiB
- CSS gzip 196.1 KiB > 136.0 KiB

预算源码 SHA256 `35972fa6e3fd93f363f9b7b53fe2c05f8c44d9a73ecfddc7a8ad0bc7934ae7e8` 与 R4 相同，perf-budget 脚本也逐字相同；四项失败原日志完整保留。既有 R4 四红未被隐藏。

## 资产专项

- 审定排除仍195项、0警告，审定脚本 SHA256 `f881e09ded3fa22fbf553e021b99224341c9234115ac6bfad08d82dde29069f3`
- 全部195项源图与冻结SHA相同，副本保留；产物不存在其原路径
- 30张被覆盖旧卡图/缩略图共1,291,352B：来源/副本字节保留、未发布；产物也无同SHA副本，两生成manifest无旧路径引用
- 30张当前替代原图/缩略图均发布、SHA与源图相同、两生成manifest引用完整
- 正式wu cutout与room WEBP继续发布且SHA相同，room PNG原件保留且未重复发布
- 详见 `shadowed-card-publication-verification.json`、`required-formal-assets-verification.json`；本轮不重复像素等价或实页外观验收

## 末次完整性与覆盖边界

副本输入的正常生成变化：
- `搜打撤/game/src/generated/art-manifest.js`
- `搜打撤/game/src/generated/thumb-manifest.js`

其余副本源码/测试/门禁无意外变化，依赖未漂移；Git index 13377 条 path/mode/object ID/stage 语义一致，语义 SHA256 `13e8908944a91adfe96cb270c8bf608eec8f7d7dd206f99066ab7fe6ac3929c2`；index原始字节变化仅按实测记录，不回写来源。

- 产物 manifest SHA256 `4af10a2fac4d5425ebf27a764d97994f1a04089bb91e009f72c00cfb31be176b`
- dependency manifest SHA256 `a289651fefbddca18476c65ada7fdef5d4c739dac9bfc08c971d237a04d2eff6`
- Git初始manifest SHA256 `3ad857e42e007b8d55fad440c83d4c5f9bc5acc76baeb4d1a45cbf7fa42a9c04`
- 复合输入清单 SHA256 `1e74c989053771e7965d65ec4ec8fe323a916baf96f7de537471a23fe8ddfab8`

父在独立复制确认后解冻。末次来源观察 `2026-10-15T22:29:04.009112+00:00`，既有输入变化：
- 无既有输入内容变化

另新增 0 个路径，完整列表见 `post-validation-integrity.json`。这些解冻后变化、未来提交、远端CI、浏览器实页和持续游玩不在本次冻结全量结论内。

复制流程曾因监控编排错误重复启动一次snapshot命令；第二次正确拒绝合并已有目录、exit1，保留在 `logs/snapshot-duplicate-attempt.log`。第一份副本完成三类manifest与inode核验后才运行正式门，未覆盖旧资料或修改源代码。

完整大manifest、独立快照、产物与执行脚本留在 `/workspace/shared/cloud-iteration-verification-r5-20261016`；本目录仅为精简证据副本。
