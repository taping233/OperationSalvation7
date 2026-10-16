# 云端第三轮独立完整验收

结论：R3 静态门全部通过，普通全量测试仍有 4 个失败用例；Vite 编译成功，正常 build 的 postbuild 原预算仍有 4 项超限。R2 的 5 个失败文件本轮未再失败。没有修改来源、测试、consumer 指纹、门禁或预算，不能宣称 R3 全量通过或最终提交通过。

## 优先失败定位

普通 `npm test` exit 1：463 文件中 461 通过、2 失败；4319 用例中 4313 通过、4 失败、2 跳过，无 R2 那样的套件导入失败。

- `tests/agent-console-jump.test.js:82`：点击设置入口后立即查找 `.settings-page`，结果为空
- 同文件 `:94`：`devcGoto` 未注册；`:101`：`devcClose` 不是函数
- `tests/selftest-paths.test.js:19`：`node game/selftest.js` exit 1，唯一自测红灯为“档位概览仅展示游玩时间与已解锁成就”

最小静态诊断：控制台测试 `:78` 在 `goto.click()` 后同步断言，没有等待新菜单异步模块；后两个失败可能受首个未完成打开影响。`game/selftest.js:24` 的 GAME_PARTS 只含旧 `ui/game.menu.js`、未含新 `game.menu.pages.js`，而 `:95` 仍在拼接源码中搜索 PLAYTIME/ACHIEVEMENTS。上述诊断不代替真实行为复验；原始红灯保留，未改测试断言或自行修复。

## 输入、隔离与完整性

- 来源：`/workspace/scratch/b7a53a06c872/OperationSalvation7-f0e84c5d`，HEAD `f0e84c5dc34afcbc1176b1519258d2c3010c62cb` 上的未提交工作树
- 独立目录：`/workspace/shared/cloud-iteration-verification-r3-20261016`
- 父明确冻结：2026-10-15 20:51 UTC；快照完成：20:52:53 UTC
- 11033 文件、705293459 字节；20 秒稳定窗口，复制前后来源 SHA 与副本 SHA 完全一致
- 真正 `.git` 和依赖在全部门运行前独立复制，逐项核验前后字节；无来源共享 inode、无共享可写依赖、未安装或升级
- Git 复制前确认无 remote/credential、外部 alternates、符号链接；未披露配置值
- 排除 `docs/previews/roster-cutouts-20261016/`、`docs/previews/wu-cutout-20261016/` 两组预览（含其新大 PNG）、冻结引擎、旧构建/缓存、历史重复仓库/runtime 快照及 >1MiB 历史证据
- 正式 wu cutout、room 的 PNG 原件与 WEBP 均包含，没有物理删除来源原件
- 未操作浏览器或端口服务，未提交/推送；R1/R2 结果完整保留

父审定 review 脚本 SHA `1dbb7522f32a2e6a60575864ce625aee077717a4662276cc790bb211dbf00c18` 精确匹配；本轮发布排除 165 项、0 警告，没有自行刷新 consumer 指纹。

## 全部门执行

| 检查 | 退出码 | 实测 |
| --- | ---: | --- |
| Node/npm/依赖版本 | 0 | Node 22.23.3、npm 10.9.9，锁版本匹配 |
| check:syntax | 0 | 425 文件 |
| validate:data | 0 | 原内容检查全部通过 |
| typecheck | 0 | 8 套配置 |
| lint | 0 | 原 lint 范围 |
| docs:check -- --json | 0 | 49 页、461 相对链接、0 发现 |
| 普通 npm test | 1 | 上述 4 失败；146.042 秒 |
| 正常 npm run build | 1 | prebuild 通过、Vite 成功、postbuild 4 项预算失败；15.219 秒 |

未降低预算、未使用跳完整门/staged snapshot 逃生变量、未跳过 pretest/prebuild/postbuild。

## 真实构建收益与原预算

| 指标 | R2 | R3 | 原阈值 |
| --- | ---: | ---: | ---: |
| 总包 MiB | 128.43 | 120.80 | 112 |
| entry gzip KiB | 312.5 | 288.1 | 270 |
| initial JS gzip KiB | 357.9 | 333.5 | 310 |
| 全部 CSS gzip KiB | 194.5 | 195.6 | 136 |
| 重复 MiB | 0.02 | 0.02 | 0.883 |

相对 R2 精确减少总包 7995570 字节（约 7.63 MiB），entry/initial 各减少 24992 字节（约 24.41 KiB），全部 CSS 总 gzip 增加 1077 字节（约 1.05 KiB）。独立菜单 CSS 仍完整计入总预算，未通过拆块逃避计数。startup 6/40、battle 45.3 KiB、narrative 31.0 KiB 在各自门内。

R3 产物 1322 文件、126673218 字节。预算源码 SHA 仍为 `35972fa6e3fd93f363f9b7b53fe2c05f8c44d9a73ecfddc7a8ad0bc7934ae7e8`，四项超限保持红灯。

正式资产额外核对：

- `wu-default-cutout-v1.webp` 来源与发布件均为 1011996 字节，SHA `68fe23ed56b3b9fee7e3fbfef64546ddc260da282897b87703034446b00432de`
- room WEBP 来源与发布件均为 607272 字节，SHA `97469c1514ef8441515f07df056e91aaac67739367605cbb9da751bb5daa1861`
- room PNG 原件 1031685 字节在来源快照完整保留，未重复发布；SHA `66e3bb17dc7eef8424e08551f33c0efd395b248fc8011172d14f3b08223cb747`

本轮核验源码与发布字节，没有重复进行 263 sprite 的原始/重编码像素等价专项审计，也没有进行图片外观或实页验收。

## SHA256 与末次守卫

- 来源输入清单：`bf2e4dffb52d302525344f38dc61c1b325e35923e0ec8234c499411b0a8e96d5`
- 复合输入清单（来源/依赖/Git/审定脚本/正式必含资产）：`fb562f9db23cda9532968db31b19193744e4feece4e3dd1bc5f3752a10593f54`
- 依赖清单：`a289651fefbddca18476c65ada7fdef5d4c739dac9bfc08c971d237a04d2eff6`
- 初始 Git 元数据清单：`3ad857e42e007b8d55fad440c83d4c5f9bc5acc76baeb4d1a45cbf7fa42a9c04`
- 产物清单：`0754a018fa4724fe193cbc03dfd43dedefc850d4f1b3fe3e354c34b28c045526`

副本仅正常 build 重写 generated/art-manifest.js 与 thumb-manifest.js，没有源码/测试/门禁意外改写，依赖字节未漂移。

副本 index 原始字节发生附属/缓存元数据变化，但 13377 个暂存条目的 path/mode/object ID/stage 完全相同，前后语义 SHA 均为 `13e8908944a91adfe96cb270c8bf608eec8f7d7dd206f99066ab7fe6ac3929c2`，没有暂存内容变化或来源 index 回写。

末次来源漂移观察为 20:57:53 UTC，仅 PLAYLOG 修改与新增 `44-layer-gate-after-r2.png` 截图；这些后续记录不属于本轮冻结输入。之后任何新代码/测试修复、未来提交、远端 CI、当前实机与持续游玩均不在本结论内。

## 证据

`checks.json` 保存每条命令、退出码、UTC 时间、耗时和日志；`logs/`、`log-manifest.json` 保留原始日志与 SHA。`runtime-asset-review.json`、`required-formal-assets-verification.json`、`build-metrics-comparison.json`、`post-validation-integrity.json`、`git-index-integrity-diagnosis.json` 保存专项核对。真实产物位于 `snapshot/搜打撤/desktop-app/game/`。
