# R4 独立冻结综合验收

结论：R4 冻结版本静态门与普通全量测试通过；466 个测试文件全部通过，4390 passed、2 个既有条件 skip，exit 0。正常 build 的 prebuild 与 Vite 编译成功，postbuild 原预算仍四项超限，exit 1；不能写成全部质量门通过。资产专项通过：195 项发布排除、0 警告；新增 30 张旧卡图/缩略图源字节保留而不发布，替代图全部发布，两生成清单不再引用旧图。

## 冻结范围与隔离

- 来源 `/workspace/scratch/b7a53a06c872/OperationSalvation7-f0e84c5d`，HEAD `f0e84c5dc34afcbc1176b1519258d2c3010c62cb` 上的未提交工作树；冻结完成 `2026-10-15T21:38:34.284645+00:00`
- 独立目录 `/workspace/shared/cloud-iteration-verification-r4-20261016`；11125 个输入文件、707294151 B；20 秒稳定窗口、复制前后来源 SHA 与副本 SHA 一致
- source manifest SHA256 `2c6b9b5116a6164cf8b39329d35380ff31793e95a7ca6d2cba5447359be6c2c8`
- 真实 Git 与 7738 项依赖在运行检查前独立复制、逐字节核验；来源/依赖/Git 共享 inode 全为 0，没有共享可写依赖目录
- Git 复制前确认无 remote/credential 配置、外部 alternates、符号链接；不披露配置内容
- 延用 R3 排除边界：活动 roster/wu cutout 预览、冻结引擎、历史重复快照、>1MiB 历史证据、构建产物与缓存；实际 Vite 源码、素材、测试、脚本与现行文档纳入
- 未修改来源生产源码、测试断言、门禁、预算或 consumer 指纹；未 build 共享树，未操作浏览器/端口服务，未提交/推送；R3 保留原样

## 正式检查与原始退出码

| 命令 | exit | 耗时 |
| --- | ---: | ---: |
| node --version | 0 | 0.035s |
| npm --version | 0 | 0.132s |
| npm ls --depth=0 | 0 | 0.601s |
| npm run check:syntax | 0 | 1.304s |
| npm run validate:data | 0 | 0.343s |
| npm run typecheck | 0 | 0.969s |
| npm run lint | 0 | 10.258s |
| npm run docs:check -- --json | 0 | 0.453s |
| npm test | 0 | 132.602s |
| npm run build | 1 | 14.095s |

syntax 实查 425 文件；typecheck 为 8 套配置；docs 为 49 页、461 相对链接、0 发现。普通 npm test 包含正常 pretest 剧情编译与数据校验，132.602 秒；正常 npm run build 包含 prebuild/postbuild，14.095 秒。没有跳过完整门或使用 SKIP_FULL_TESTS、SDT_STAGED_SNAPSHOT、GATE_RECEIPT 等绕过变量；现有 2 个条件 skip 如实保留，不当作测试覆盖通过。

全部命令、UTC 起止、退出码与日志见 `checks.json`、`auxiliary-checks.json` 和 `logs/`；`log-manifest.json` 保留原始日志 SHA256。

## 资产发布实证

- 审定排除集合 195 项、0 警告；审定脚本 SHA256 `ac7ac392eb5cf6995ec4cfcb3b03b0c867313e5b725cc9765a2a78cf24593da4`
- 新增旧卡图共 30 个文件（15 原图 + 15 缩略图），合计 1,291,352 B；来源冻结 SHA、快照 SHA 与验收时来源 SHA 全相同
- 30 个旧路径未出现在产物，产物中也无同 SHA 字节副本；art-manifest 与 thumb-manifest 均无旧路径引用
- 30 个当前替代原图/缩略图全部发布，发布件 SHA 与源图相同，对应生成清单引用完整
- 全部 195 个审定排除项的源图均存在且 SHA 保留，快照原图也未删除；逐项见 `shadowed-card-publication-verification.json`
- 正式 `wu-default-cutout-v1.webp`（1,011,996 B）与 room WEBP（607,272 B）继续发布且 SHA 相同；room PNG 原件（1,031,685 B）保留而不重复发布；见 `required-formal-assets-verification.json`

本轮只核验源码/发布字节与清单，不重复原始/重编码像素等价审计，也不替代图片外观或实页验收。

## 构建预算与 R3 对比

| 指标 | R3 | R4 | 原阈值 |
| --- | ---: | ---: | ---: |
| 总包 MiB | 120.80 | 119.58 | 112.00 |
| entry gzip KiB | 288.08 | 288.00 | 270.00 |
| initial JS gzip KiB | 333.49 | 333.41 | 310.00 |
| 全部 CSS gzip KiB | 195.60 | 195.84 | 136.00 |

R4 产物 1292 个文件、125385273 B。相对 R3 净少 1,287,945 B（30 个文件）；entry/initial 各少 80 B gzip，全部 CSS gzip 增加 248 B。重复字节仍 16,540 B；startup 6/40、battle 46.2 KiB、narrative 31.0 KiB 在各自门内。全部独立 CSS 均计入预算，没有用拆块降低计数范围。

四红原因精确为：总包 119.58 MiB >112、entry 288.0 KiB >270、initial 333.4 KiB >310、CSS 195.8 KiB >136。原预算源码 SHA256 `35972fa6e3fd93f363f9b7b53fe2c05f8c44d9a73ecfddc7a8ad0bc7934ae7e8` 与 R3 相同，没有放宽阈值。详见 `build-metrics-comparison.json` 与 `logs/build.log`。

## 末次完整性与覆盖边界

- 副本只由正常 build 重写两份 generated 美术清单；源码/测试/门禁没有意外改写，依赖输入未漂移
- 副本 Git index 原始字节变化，但 13377 条 path/mode/object ID/stage 语义全部相同，语义 SHA256 `13e8908944a91adfe96cb270c8bf608eec8f7d7dd206f99066ab7fe6ac3929c2`；无暂存内容变更或来源 index 回写
- 产物 manifest SHA256 `e0621ad8ff3799d2294e5ee70fabda19c9a57a5c42a34f2798a80350d03af4c3`
- 依赖 manifest SHA256 `a289651fefbddca18476c65ada7fdef5d4c739dac9bfc08c971d237a04d2eff6`
- Git 初始 manifest SHA256 `3ad857e42e007b8d55fad440c83d4c5f9bc5acc76baeb4d1a45cbf7fa42a9c04`
- 复合输入清单 SHA256 `1e3f5204f8241e4fab510458c300133df4a4fa744aa211a8d447d2b0dacef569`

父解冻后继续工作。末次来源观察 `2026-10-15T21:42:36.693838+00:00` 发现以下既有路径改变：
- `搜打撤/docs/PARALLEL-REGISTRY.md`
- `搜打撤/docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md`
- `搜打撤/game/css/expedition-rewards.css`
- `搜打撤/game/src/battle/core/battle.lifecycle.js`

另新增 battle-round-recording.test.js 及相关证据等 13 个文件，完整列表见 `post-validation-integrity.json`。其中 battle.lifecycle.js、expedition-rewards.css 与新增 round-recording 测试不在 R4 冻结全量覆盖内；后续修改、未来提交、远端 CI 和持续游玩结论均不得套用本轮通过结果。

完整大 manifest、原始独立快照与产物留在 `/workspace/shared/cloud-iteration-verification-r4-20261016`；此目录只复制精简证据，未将大快照纳入项目。
