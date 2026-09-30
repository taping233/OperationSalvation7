# 主线代码审查（2026-09-30）

审查时间：2026-09-30 22:00（Asia/Shanghai）。负责人：Friday，本聊天只读审查。

## 范围与基线

- 用户授权：只 review 主线代码；没有修复、提交、回滚或清理授权。
- 本地分支 `master`，HEAD `fd38468ea6025fa616ba8bfa0a0cdd466ee7617a`；相对本地 upstream 引用 ahead 24 / behind 0，未 fetch，不代表远端实时状态。
- 仅 `搜打撤` Vite 主线。重点读档/保存、出征、死亡/撤离、战后结算、宝箱和战斗生命周期；地图恢复与战斗时序作定向核对。不是全仓逐行扫描或全部卡牌语义审计。
- 实时核对：`game/src`、`game/data` 及本次 9 个相关测试均匹配 HEAD。其他会话的流程工具、文档、音效试听页及素材未纳入审查。
- 开工已读取根 AGENTS、README 路由、REGISTRY、PENDING 与相关存档/质量规范；记忆仅作为历史背景，结论由现场源码与复现支持。
- 本轮未取得当前游戏留言来源页，留言未核验；未操作其他会话的浏览器标签或服务。
- 源码指纹见 [source-fingerprints.json](source-fingerprints.json)。文件列表表示本轮重点/片段审阅的模块，不表示每个文件逐行审完。

## 确认问题

### F1 / P1：回退读取提前授予旧运行态覆盖权限

位置：`game/src/hub/game.storage.js:96`。

`readRun` 在 prev 自愈时直接修改 `writeBaseline`，所有 `read` / `readForPreflight` 都会走这条路径。该备份随后如果被业务预检拒绝，运行态仍属于旧局，但它已经获准写入自愈后的主档。复现先装载旧局，再模拟另一对局的主档损坏和不支持的地图备份：预检返回 `UNSUPPORTED_LEGACY_MAP`；此前被拦截的 `saveGame()` 此后返回 true，把旧局 seed 写到 `replacement-run` 的身份下。

影响：失败的读档也能解除跨标签旧局保护，覆盖另一对局，并把旧局数据绑定到新局身份。建议回退读取与写基线采纳分开，由完整预检成功后的 `acceptLoad` 授权运行态；回退自愈不能自动给旧运行态写权。

### F2 / P1：终局后残留 prev 可复活已结束对局

位置：`game/src/hub/game.storage.js:206-211`；关联 `hub/recoverable-pair.js` 的 Run 删除与 `recovery.commands.js` 的 `onChanged`。

终局两键事务使用 `afterRun: null` 删除主键，回调 `_invalidate` 只刷新缓存/基线，不清 prev。新局第一次 `write` 因 `currentRaw === null` 也不覆盖旧 prev。复现通过实际 `createRecoveryCommands.commitBaseAndRun` 完成终局，创建具有新 runId 的新局，然后损坏新主档：`read` 回退后 seed 和 runId 均变回已结束的旧局。

影响：回退越过对局边界，当前新局被旧局替代，与已经结算的基地状态不一致。建议终局提交/恢复及新局创建同步处理旧 prev，确保回退备份属于仍有效的同一对局。未声称已复现重复发奖。

### F3 / P2：正常读档清空已保存的首脑选择

位置：`game/src/run/game.session.js:533`；调用链 `restoreGame` → `enterLayer` → `saveGame`。

`restoreGame` 先恢复 `s.bossPlan`，随后 `enterLayer` 无条件设为 null 并立即保存。第四层 `bossPlan: 2` 的有效存档装载成功后，运行态和持久值均变成 null；下次首脑面板会重新随机选择。

影响：刷新/继续游戏会改变已经确定的首脑，破坏现行“层内固定、读档恢复”的语义。建议区分真实换层和同层恢复，只在需要重新选择首脑的换层入口清空。

### F4 / P2：撤离整理备份首次恢复误报身份不一致

位置：`game/src/run/game.session.js:245-247,257-258`。

预检先对坏主档调用 `readIdentity`，随后 `readForPreflight` 才进行 prev 自愈。即使备份包含合法的撤离记录及匹配的 `_r2.runId`，身份校验仍使用自愈前的失败结果。复现第一次返回 `INVALID_EXTRACTION_IDENTITY`，同一存档第二次预检成功。

影响：可恢复的撤离整理档首次进入失败，玩家被误导为整理记录损坏。建议在获得生效候选原串后读取/绑定其身份，并保留 `acceptLoad` 的原串变化检查。

## 验证证据

现有依赖，无安装。独立 Vitest 配置只载入实际源码与 jsdom；不读玩家 localStorage，不开游戏服务、不构建。为避免调用其他会话正在修改的 workflow/acceptance-gate，直接执行既有 Vitest，并在本目录留日志。沙箱初次阻止 esbuild 子进程（EPERM），经自动审批允许后完成执行。

```powershell
node node_modules/vitest/vitest.mjs run --config docs/evidence/2026-09-30-mainline-code-review/review.config.mjs --reporter=verbose
node node_modules/vitest/vitest.mjs run --config docs/evidence/2026-09-30-mainline-code-review/related.config.mjs --reporter=dot
```

- [复现夹具](repro.test.js) / [复现日志](repro.log)：4/4 确认观察结果；断言描述现有缺陷，不是修复后的验收绿灯。
- [相关测试配置](related.config.mjs) / [相关测试日志](related-tests.log)：9 文件 / 154 项全部通过，包含读档、prev、终局恢复、撤离、战斗结算/解析和两个架构哨兵。
- 现有测试通过而本轮缺陷仍可复现，说明这四个组合路径缺少覆盖。日志中的保存失败提示是原测试主动故障注入，不计为额外产品缺陷。
- 运行结束 HEAD 未变，游戏源码及所选测试仍匹配 HEAD。

## 已知事项与未验证项

PENDING #13（照相馆路径）、#19（句内终局短路）与 #20（终局保存窗口）已有记录，不计为本轮新增；未借此修改或重新拍板。没有启动浏览器、操作玩家档、全量测试、生产构建或远端 CI，因此不宣称游戏实页/全部卡牌/整局体验通过。

本轮只新增本证据目录，未修改游戏代码、共享台账或其他会话文件，未提交。没有新建服务、工作树或遗留后台进程。

后续：老板授权修复这四项；修复与回归证据见 [四项修复记录](../2026-09-30-mainline-review-fixes/README.md)。本目录夹具断言记录原基线缺陷，保留作历史复现，不是修复后验收入口。
