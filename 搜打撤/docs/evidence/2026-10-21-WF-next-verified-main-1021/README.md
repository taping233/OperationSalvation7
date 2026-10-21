# 卡面/缩放描述与陈旧呈现续跑守卫（准备中，未验收集成）

正常冰刺卡基础伤害 2、法术加成 2 时，旧卡面说明显示 6，而徽章为 4。`cardHTML` 已解析描述又交给 `descRich` 二次解析；本次只把已解析结果交给仅作富文本标记的函数。公共 `descRich`、转义、256 条/2048 字符富文本缓存和 32 变体整卡缓存边界不变。卡牌数据、消耗、可用性和效果规则不改。

精确基底为 `17013cc69237f5b2f64120f8ddc4dbfdef66d409` / tree `442bfad9c26df27edcc8dd01257eeb1edc221d25`。原卡面 R2 候选源 blob 为 `0aa03e734a2b057dfd78926b4903dab1baf28dff`，最终加上缩放修复后为 `42d6d07fb48b67deac39828d85c05dd8abafcb7b`；[冻结清单](card-frozen-manifest.json)记录来源文件、测试和补丁 SHA256，历史原始证明未改写。

## 已有定向证据

- 同一最终 R2 测试在精确旧源码上 [3 失败、1 对照通过](baseline-r2-failing.log.txt)，候选 [4 套件 / 50 测试通过](focused-r2.log.txt)。包含公共 renderer、结构化字段、转义及同一卡/同 options 下 bonus 2→4→2、inactive、reactivate 的回归。
- [操作计数](operation-counts-r2.json)证明 cold miss 的 provider/描述解析各由 2 次变 1 次；不是耗时收益或 FPS 证明。
- [runtime checkJs](runtime-checkjs-r2.log.txt)、[定向 lint](eslint-r2.log.txt)、[源](syntax-source-r2.log.txt)/[测试语法](syntax-test-r2.log.txt)均通过。[原始命令与退出码](command-receipts-r2.json)、[检查后源身份](postcheck-source-identities.json)列明实际候选范围与路径。

这些是候选作者在隔离覆盖层实际执行的证据，不冒充本批完整门禁。当前集成只完成精确基底恢复、补丁与文件身份核对；正常完整门禁、标准构建、当前窗口实页和远端 CI 均尚未运行。普通文案的重复清理也可能因移除第二次解析而不同；缩放中的引用链接渲染器纳入下述同族修复；没有生产调用的检查器长文路径不在本次范围。

## 范围与后续

完整挂载查询 R2 保留在独立实验，不合入本批。本批另含独立验过的单行陈旧呈现续跑守卫，边界见下节。Boss/elite、美术、MV、音频和部署不在本批。

合入前按项目原有冻结 index 流程运行 FULL 门禁，再用标准 `npm run build`（保留 prebuild/postbuild 和原预算）；上述生产修复按已审顺序合并；本批合并后的精确 staged tree 仍须新验，不复用候选覆盖层的 receipt。提交前重新读取远端 master，任何推进须保留并重做语义核对；本记录不宣称已提交、推送或发布。

## 陈旧父呈现续跑的防御性守卫

在原 `animateBattleTransition` 返回后增加一次已有的 `isCurrent()` 判断。只在同步协作者回调已触发新呈现时，停止陈旧父调用继续执行 Boss 标记、浮字/ready 调用和刷新；不加入挂载查询 helper、第五参数、缓存或新动画记账。

[独立结果](guard-summary.json)为 18 套件 / 416 测试通过；[原始定向输出](guard-focused.log.txt)、[精确旧源反例](guard-baseline-fails.log.txt)、[命令/退出码](guard-command-receipts.json)与[冻结源/测试身份](guard-frozen-manifest.json)保留。四个压力案例覆盖 energyDown/phase × 同/新 token 重入，使用真实 transition/feedback 调用点，但 Sound.sfx 被 mock 为同步重入，Boss 快照也是构造的；不是自然复现的音频或普通玩家流程 bug。浮字仅断言调用数，ready 被 mock，因此只证明不再调用，不证明队列消耗或异步 gate 语义。

此守卫不撤销返回前已发生的转场副作用，也不修复重入 WAAPI 的全局 handPhaseAnims/handPhaseTarget 记账；不宣称性能收益。原完整挂载查询 R2 和未验实验继续独立保留。

## 同族缩放显示修复

正常战斗选择/注能入口可调用 `UI.showCardZoom`，它通过引用链接渲染器替换卡面说明，因此仅修卡面仍会显示重复加成。最终补丁导出原有 `richResolvedDescription` 纯格式化 helper，引用渲染器解析原文一次后调用它；`descRich(raw, id, card)` 仍保留一次解析的既有语义。没有添加游戏状态缓存或改变卡牌规则。

带卡面 R2 的旧缩放链 [3 个反例失败](zoom-baseline-final-failing.log.txt)，最终候选 [5 套件 / 53 测试通过](zoom-focused.log.txt)，覆盖真实非照相馆 `UI.showCardZoom`、实时加成变化、structured onPlay、引用按钮/转义与空描述。[操作计数](zoom-operation-counts.json)、[命令/退出码](zoom-command-receipts.json)、[独立冻结身份](zoom-frozen-manifest.json)及 runtime checkJs/lint/语法原始日志保留。整次缩放可能分别渲染卡体和替换说明，本结论是每个描述解析边界只做一次，不宣称整次 UI 只调用一次 provider。

首次只含卡面 R2+guard 的冻结 quick 尝试在发现此正常缩放遗漏后中断，未完成、不可复用；其旧 tree `e1270e497d37602c9b712a5273af8ede74184fb0` 的日志和快照另存，未混入最终验证。最终树须重新冻结。完整门采用原 `runStaged` 的真实 QUICK receipt，再在同一保留快照执行原 hook 的 `FORCE_FULL_TESTS=1` 路径；FULL 结果及前后输入哈希单独记录，不把 QUICK receipt 改称 FULL receipt。

## 既有 VM 性能证明夹具兼容

正常 CPU0 冻结 QUICK 在旧最终树 `01cd4afbde876750182650151130b4acdb17d5cb` 实际跑到 30 套件 / 469 测试，其中 29 套件 / 468 测试通过，唯一失败是旧 VM 提取器未去掉新增 helper 的 `export`，不是游戏断言失败。[原始失败日志](integration-quick-before-fixture.log.txt)与[失败绑定](integration-quick-before-fixture-binding.json)保留，不复用为通过证明。

仅在 `runtime-hotpaths.test.js` 的源码提取器额外去掉精确命名的 `richResolvedDescription` 导出语法；所有 6,400 次调用、字节一致性、100 倍查词比与缓存边界断言不改，三个生产文件不变。[精确旧夹具失败](vm-fixture-baseline-failing.log.txt)、[修正后 3 套件 / 12 测试通过](vm-fixture-candidate-focused.log.txt)、[关闭 memo 的负对照仍在原比例断言失败](vm-fixture-negative-memo-disabled.log.txt)、[命令退出码](vm-fixture-command-receipts.json)和[冻结身份](vm-fixture-frozen-manifest.json)列明范围。修正后仍须重新冻结并走原 QUICK→独立 FULL hook→标准构建；此前失败/中断快照只归档，不作为可运行快照或可复用 receipt。
