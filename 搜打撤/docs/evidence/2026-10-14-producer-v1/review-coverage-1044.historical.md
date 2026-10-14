# 当前全项目审查证据覆盖重建

快照：2026-10-14T10:44:53.962621+00:00；344个原始运行JS逐件映射；只读，未运行测试/build/browser/Git。

## 核心判断
- 当前runtime JS 345件，完整语义读审可由当前SHA证据确认 342件；另有完整结构化数据载体 3件，尚余 0件全文/结构证据待齐
- 完整结构化runtime数据载体 3件，来源与字段检查有证据；与手工语义读审独立计数
- 未完整runtime中 0件已有在途补审，0件尚无在途整读归属
- 本轮5组补审中5组已交最终证据，其他仍不计完成；父六文件已交SHA绑定全文证据
- bf612952 tree本身含 340件runtime JS；09:24的344清单已含本轮新增4件，当前逐件同时标upstreamMember与baselineMember
- 当前完整测试、生产build/预算、最终实页均未由本汇总核验；父独立验收在途状态以其回执为准。定向测试数量不相加；源码SHA相同只支持该源审查，不足证明整个测试依赖闭包未变
- 旧报告/manifest与当前源码不一致时，该路径旧读审/修复验证不可继承。旧08:24全量/构建不代表当前通过

## 逐域矩阵
| 域 | 路径 | 当前完整 | 结构化 | 定向 | 只测 | 未审/仅指纹 | 在途未完整 |
|---|---:|---:|---:|---:|---:|---:|---:|
| boot | 14 | 14 | 0 | 0 | 0 | 0 | 0 |
| storage | 18 | 18 | 0 | 0 | 0 | 0 | 0 |
| settlement | 10 | 10 | 0 | 0 | 0 | 0 | 0 |
| departure | 10 | 10 | 0 | 0 | 0 | 0 | 0 |
| inventory | 9 | 9 | 0 | 0 | 0 | 0 | 0 |
| shop | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| world | 13 | 13 | 0 | 0 | 0 | 0 | 0 |
| events | 15 | 14 | 1 | 0 | 0 | 0 | 0 |
| altar | 5 | 5 | 0 | 0 | 0 | 0 | 0 |
| library | 20 | 20 | 0 | 0 | 0 | 0 | 0 |
| cards | 22 | 22 | 0 | 0 | 0 | 0 | 0 |
| battle-rules | 30 | 30 | 0 | 0 | 0 | 0 | 0 |
| battle-runtime | 33 | 33 | 0 | 0 | 0 | 0 | 0 |
| battle-view | 20 | 20 | 0 | 0 | 0 | 0 | 0 |
| base-economy | 13 | 13 | 0 | 0 | 0 | 0 | 0 |
| base-scenes | 23 | 23 | 0 | 0 | 0 | 0 | 0 |
| ui | 38 | 38 | 0 | 0 | 0 | 0 | 0 |
| assets-audio | 15 | 13 | 2 | 0 | 0 | 0 | 0 |
| render-core | 20 | 20 | 0 | 0 | 0 | 0 | 0 |
| agent | 27 | 27 | 0 | 0 | 0 | 0 | 0 |
| pipeline | 71 | 70 | 1 | 0 | 0 | 0 | 0 |
| preview | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| frozen | 4 | 0 | 0 | 0 | 0 | 0 | 0 |

## 无在途归属的当前不完整项
当前未分派证据缺口为0。
这些是证据缺口，不是已确认bug；结构化数据应采用相应完整检查，不要求假称人工逐行语义读审。

## 当前证据声明歧义
- save-recovery原报告“已检查”不是18件全文；补证诚实区分原10全文/6片段/2未审，后补8全文并验证10件旧全读原字节，当前18路径均已给出明确读深度。行为测试仍只属于原冻结输入
- event-extraction原25文件仅关键路径证据，后补真实全文与当前SHA已经接纳；其中nest二轮容量修复单独接链，原40文件350项不能当二轮新字节的验收
- sound.bank/sfx-audition原证据只有发布边界；父后补当前SHA绑定全文读审已接纳，未额外执行开发试听或改变发布策略
- shop三个页面现由父补完整读审SHA；每路径匹配当前源才能计入完整，早前局部修复记录不倒推全文
- generated art/thumb/narrative已由父补完整结构解析、全部资源存在性及Ink内存编译一致性；仅当前结构范围成立，最终消费者图与生产发布仍需build验证

## 本轮五组补审
- base-departure-completion-20261014：Four domains: all modules without complete read evidence; worker reports reading finished but final frozen report pending；声明路径56件，初始输入SHA 5件，frozen_delivered_read_evidence
- cards-data-completion-20261014：cards22 plus five specified library leftovers and core/notes migration; final frozen report pending；声明路径29件，初始输入SHA 6件，frozen_delivered_read_evidence
- global-ui-completion-20261014：boot14 + ui38; worker reports whole-source reading completed, final frozen report pending；声明路径52件，初始输入SHA 0件，frozen_delivered_read_evidence
- battle-visual-audit-20261014：battle-view20; final frozen report pending；声明路径20件，初始输入SHA 20件，frozen_delivered_read_evidence
- pipeline-completion-20261014：Only devtools remaining Agent4/pipeline53/preview1; package-lock structured check; final frozen report pending；声明路径58件，初始输入SHA 0件，frozen_delivered_read_evidence

## 已变旧证据（逐路径，不能沿用为当前）
- `game/src/agent/agent.scenes.runtime.js` ← `devtools-audit-20261014/coverage.json`：原 `84d9ea15475c0460973f10744ad435bcc16f4c7682636ecb6d61f9b888b29c59`；当前 `f5a9b734f46430b5e586b314ae9bd7bd2d1025d4840ebc8bd4312d9202603d35`
- `game/src/cards/card-rarity.js` ← `photo-page-audit-20261014/reviewed-input-manifest.json`：原 `155b338a000e571eb58e29905bd2a631a95edb2846da35f963703b4f912151a8`；当前 `7df4211548e6e4bcc46fac07d5b7541265f7c04dfcab23b72b899be7637028fe`
- `game/src/cards/card-rules.capability.js` ← `battle-rule-audit-20261014/module-coverage.json`：原 `4044acfd52099325ff5abf324951e3e6c0e49782e92653368d5a3928d9f892e2`；当前 `76ba46beb7218d35afb6ec9e139251d0f0cda2a84debdfb06cec5e4361310719`
- `game/src/core/notes.js` ← `render-input-audit-20261014/reviewed-input-manifest.json`：原 `b89f7a0fbc5201107fa4b818ae25e416d87bdaf593a26bbfb42a9015f804201e`；当前 `a8d32c5265aa2185901fb1795d25297fa618a2e0aec9a66abf0152b6b75b902d`
- `game/src/game.boot.js` ← `render-input-audit-20261014/reviewed-input-manifest.json`：原 `91288f1494b80d0d50d8dff6de71d64cfdb4eb9bfd463b9f44e58166c06ffa9f`；当前 `6b99b8fd8d0cf1fb75cfb034a513eaabdc7a3ace0580f53185d24ce636cc063c`
- `game/src/game.boot.js` ← `map-node-audit-20261014/reviewed-modules.json`：原 `d313bf38021d22c4fda1c3ade8089c2c74a593ee536c6569390d69e934c0a364`；当前 `6b99b8fd8d0cf1fb75cfb034a513eaabdc7a3ace0580f53185d24ce636cc063c`
- `game/src/game.boot.js` ← `hub-lazy/modified-files.json`：原 `d313bf38021d22c4fda1c3ade8089c2c74a593ee536c6569390d69e934c0a364`；当前 `6b99b8fd8d0cf1fb75cfb034a513eaabdc7a3ace0580f53185d24ce636cc063c`
- `game/src/home/home.commands.js` ← `base-inventory-audit-20261014/coverage.json`：原 `e36ea8c36851c7b80047ef4374392f61a4184acb42782ab92ac93b5311fd9714`；当前 `eb75d1a2444b1082ed5b8c97b5559dc7e480e91cf68bb0074f9c609c0dbe6c82`
- `game/src/hub/base-departure.commands.js` ← `base-inventory-audit-20261014/coverage.json`：原 `bbe418b489490e7bf8ce90d0bfbc1dc5279ec504684a0283ed2e31ade2ffe72b`；当前 `12b2efbc86c2ca3e54ef8e588d8b86e357c161cd48feddf2a7d08802fe322cfc`
- `game/src/hub/base.js` ← `save-recovery-audit-20261014/final-test-inputs.json`：原 `b26a989b2e073e80bbc4188c30b6bc630c0538af04de46e7bdb329a818235717`；当前 `f14e7d36faca09b35cc8cf621ba529b16b38f86fcc4c5e06e0377f99e71a6834`
- `game/src/hub/departure.drag.js` ← `base-inventory-audit-20261014/coverage.json`：原 `41a84862c72f1217152eab4701d3e6b485c12e7e3491da03d04b1269f191dc63`；当前 `ce271515794670e761b766a3884646a3be274244cea466e7cfff17060befe1da`
- `game/src/hub/departure.summary.js` ← `base-inventory-audit-20261014/coverage.json`：原 `22075a2bbc9c2152a4fc04d762e0b61830a106476366c7f012cb6728a9b404e7`；当前 `7dbdb862ba22d9c0371a437b4f5ec767b98379b0517e7acc873f0e44e0270efb`
- `game/src/hub/departure.view-updates.js` ← `base-inventory-audit-20261014/coverage.json`：原 `e80b400b2a15b3f8964cb5dfc4e9506f393004a2e003201afd038faa5b2cb5db`；当前 `451d7134e62c3977e96edf1b399a07968503f3f43863a4b195164005abc0f73c`
- `game/src/hub/game.bag.drag.js` ← `base-inventory-audit-20261014/coverage.json`：原 `312765187861827f5ed614c430db472d950dd3cb34498b7a599b5a73e1382dac`；当前 `eb63fd79d16d579593674fa403f166d9a557bda820adc89fb28f1069e89fb65b`
- `game/src/hub/game.bag.js` ← `base-inventory-audit-20261014/coverage.json`：原 `add3f8df0d2c3ece5324774e098fef86b96a0995652b45257fbde179e2a5d5d2`；当前 `9da8ce5b6c1030d2a120ad6b310dc16558ad7163869100d2957a6d2ea7039fec`
- `game/src/hub/game.hub.depart.js` ← `base-inventory-audit-20261014/coverage.json`：原 `8cb0eea82ad4c1dbe0cfdfa844ed8f69566a2d56703557c44f1828fdc5ce17a1`；当前 `04f81459d50cf7b5dffe8b454e8774d3b3b08c65c35d56e67147c2a0e7a0a67e`
- `game/src/hub/game.hub.depart.js` ← `class-choice-lazy/modified-files.json`：原 `8cb0eea82ad4c1dbe0cfdfa844ed8f69566a2d56703557c44f1828fdc5ce17a1`；当前 `04f81459d50cf7b5dffe8b454e8774d3b3b08c65c35d56e67147c2a0e7a0a67e`
- `game/src/hub/game.hub.home-scene.js` ← `base-inventory-audit-20261014/coverage.json`：原 `59c2148600083bd505f71f0ad2200387b4865fc79bf4958ab9d05cc6833a8506`；当前 `8074951f9b829a3c3469a3b5eabff2199d1808c7d47a70f25d5f13418c9a5f06`
- `game/src/hub/game.hub.preparation.js` ← `base-inventory-audit-20261014/coverage.json`：原 `e996aab5e3407ae2c1841290bf8f3c09b0e9ac55f9e50fec754f8a760a0b32de`；当前 `fda1adb467141690785f4bff4de5140a7c615059d4313899e7cadae7347243da`
- `game/src/hub/game.hub.runtime.js` ← `base-inventory-audit-20261014/coverage.json`：原 `6ea7020d419a4dfe6df1e9e2d1ec6a2556f3da6bd5786a1e7a90a9d04c962e09`；当前 `ec93d2fbb98a7cd7e15702f0b6da46e98d932e834ce2ed9efde6c58fbc9b9e79`
- `game/src/hub/game.hub.runtime.js` ← `hub-lazy/modified-files.json`：原 `90b797afc11468a8a3bae69c0858e51c5939ce9c6fdd8abff86ca378d1b550de`；当前 `ec93d2fbb98a7cd7e15702f0b6da46e98d932e834ce2ed9efde6c58fbc9b9e79`
- `game/src/hub/game.notes.js` ← `photo-page-audit-20261014/reviewed-input-manifest.json`：原 `d60c6964c677a7461ec21828a14f3d9a4b097fcba4cbb833af150044827cdcd6`；当前 `ca9d135d8edf227f4414cc447fc525c7a31363185e67d8958e2e56ebca07b30e`
- `game/src/run/game.nest.js` ← `event-extraction-audit-20261014/audit.json`：原 `d9dfa8f1c2c19fbf2dcb2f21bc41a03caa4a9b594f87c7d0a836cc94466708c4`；当前 `c4286a7ae1bfbc66a35a3e22ec58aa1f2728b03a312c51eb0a4d236711979633`
- `game/src/run/game.run.altar.js` ← `map-node-audit-20261014/reviewed-modules.json`：原 `dcb82f2939a901ce5d334ad7feefd0e59786b44b4004375e85c8164a5126b94d`；当前 `68b058ca7af6820d43b35001859a968c534e22141f586f41effbd74b7e1f34da`
- `game/src/run/game.run.altar.js` ← `hub-lazy/modified-files.json`：原 `5e933c7f7cceacca8655a12983fa4f2ba4716c511012f4772b2ec95a42bf5a43`；当前 `68b058ca7af6820d43b35001859a968c534e22141f586f41effbd74b7e1f34da`
- `game/src/run/game.run.altar.js` ← `class-choice-lazy/modified-files.json`：原 `dcb82f2939a901ce5d334ad7feefd0e59786b44b4004375e85c8164a5126b94d`；当前 `68b058ca7af6820d43b35001859a968c534e22141f586f41effbd74b7e1f34da`
- `game/src/run/game.run.flow.js` ← `map-node-audit-20261014/reviewed-modules.json`：原 `de9b3790d73765f52a180d66affbaf8e8dbdb675fbc853900b86d36dc7ee8543`；当前 `8402efd535632d515d867866558c00df29a86c4eba5de6316c0adebf55ca2d70`
- `game/src/run/game.run.scenes.js` ← `map-node-audit-20261014/reviewed-modules.json`：原 `c7efb7a660950d4f0a5068864edcb602d6964b54657f89fe862d2bb5386cd9fa`；当前 `497a9b4e539b2dfc61b7bea5b142ad292a38d2d7a08266dae53e3077a407eeaa`
- `game/src/run/game.run.shop.js` ← `shop-inventory-audit-20261014/manifest.json`：原 `e618f516d0ebe787c77efd0d25bc59ee7a7b46e42af19c203230cda61cf3072b`；当前 `c1bd7f880b77046edc8a7e6c01238eae8ffa44e51b40710f327be13b8e4283cd`
- `game/src/run/game.session.js` ← `map-node-audit-20261014/reviewed-modules.json`：原 `946ecd91a7dc7ab7bfb544d3a407b6ab7b11bf77488a3c0ae8f3108242c88c53`；当前 `b0359d705bfe0da357270b9d1243221e7461445e63d96455bf109742289b1e54`
- `game/src/run/game.session.js` ← `class-choice-lazy/modified-files.json`：原 `946ecd91a7dc7ab7bfb544d3a407b6ab7b11bf77488a3c0ae8f3108242c88c53`；当前 `b0359d705bfe0da357270b9d1243221e7461445e63d96455bf109742289b1e54`
- `game/src/ui/game.menu.js` ← `save-recovery-audit-20261014/final-test-inputs.json`：原 `d62f45e15097ac7ba147d6fc8a0e8e759d49e84b4cc9bbd22e418c70421c250d`；当前 `82dda77c7a40305130c2cc3f7ded34f2faf38d67703326e88a9a32c5361b5aa1`
- `game/src/ui/game.menu.js` ← `hub-lazy/modified-files.json`：原 `385c26f9fc6ee629d44f60063688e1323cba96eeae0d18864dfbc91a86d23e27`；当前 `82dda77c7a40305130c2cc3f7ded34f2faf38d67703326e88a9a32c5361b5aa1`
- `game/src/ui/game.menu.js` ← `class-choice-lazy/modified-files.json`：原 `faa1313145065fdb4ccf62f29507dfad8a167ae4e776a838238e2794cc007eea`；当前 `82dda77c7a40305130c2cc3f7ded34f2faf38d67703326e88a9a32c5361b5aa1`
- `game/tools/agent-supervise.mjs` ← `devtools-audit-20261014/coverage.json`：原 `3131649654435adbdc98cb7670970f194a03d87a4293e5936e115c4acfad237d`；当前 `8dcf3f1cb34ac5b2292d23b72bef90210bb799169e747168855d32ed3adf39b8`
- `scripts/architecture-graph.mjs` ← `hub-lazy/modified-files.json`：原 `bb6ed52266a4b9c3fe28351681c1fc3bce8ab451a6027f9c8103d8205a0ad50e`；当前 `fa051c2d025bdc0bbcbb6a270ce373346e9002d1745290073efd428be891bf81`
- `scripts/gate-plan.mjs` ← `performance/modified-files.json`：原 `e654170cf75ed57c5604ee821df036a263f85241d809872620ef3b8088416315`；当前 `cefcf51ad1a596ec61b3ae243b62d9bffbae6e5c2536b0e54db482080d25ac2b`
- `scripts/iab-drive.mjs` ← `devtools-audit-20261014/coverage.json`：原 `b084a0979375e246e4e29f6ac000813d00695388da340c5fd2021d7c9a38e7a9`；当前 `77e713c29f1a3975c497afa3f114cef105596a9329e8c4bdff7b8d659b54c39e`
- `scripts/runtime-asset-publication.mjs` ← `performance/modified-files.json`：原 `e3f8e93cf9d16f6a9383947e3235e2c0ed2eeda4dcf43ce6b94f8ccfd8f052d8`；当前 `71f0569ee3e962eef77bd87496d86428afe9ff982b63da79b7b6f8621c47f88e`
- `scripts/runtime-asset-redundancy-review.mjs` ← `devtools-audit-20261014/coverage.json`：原 `ab0c69b435f02b66c9e04b7055875497448075db8ee8595e2f542f1afc1f1459`；当前 `67754686cf7d7bc1385e8ceb6faec75695e4254dad28ad39df8802f181cead1e`
- `scripts/runtime-asset-redundancy-review.mjs` ← `redundancy-audit/modified-files.json`：原 `ab0c69b435f02b66c9e04b7055875497448075db8ee8595e2f542f1afc1f1459`；当前 `67754686cf7d7bc1385e8ceb6faec75695e4254dad28ad39df8802f181cead1e`
- `scripts/runtime-asset-redundancy-review.mjs` ← `pipeline-completion-20261014/coverage.json`：原 `ab0c69b435f02b66c9e04b7055875497448075db8ee8595e2f542f1afc1f1459`；当前 `67754686cf7d7bc1385e8ceb6faec75695e4254dad28ad39df8802f181cead1e`
- `vite.config.js` ← `performance/modified-files.json`：原 `dd0327287ad41bddfd0cb3b1175316831a3de30ccb7f36a1671ab6996dfd1db0`；当前 `6c28d058ca8de9752410c70f5caa17c345b79f36f19dc1fc3b5fd880592d64d1`
- `vite.config.js` ← `redundancy-audit/modified-files.json`：原 `78e28e1bce7c9e2ffd0ef33cc4ef8f544c2198211c7a879cb9e84725a49bc694`；当前 `6c28d058ca8de9752410c70f5caa17c345b79f36f19dc1fc3b5fd880592d64d1`
- `game/src/README.md` ← `hub-lazy/modified-files.json`：原 `b69bdb6cbfd50a5c50bff1aa20fc1b3fbaddc9745d02e0fa48d53ef13622f67e`；当前 `4a739b1a72b4b9a2960929e50f74fa1707670cf4ea90e28a8d39698e709bc631`

## 未闭合风险与待决策
- 研究所牌盒30/35及满时1换1规则尚无可复用实现。当前reward/altar/shop直接push，已登记待玩法实现范围决策；本审查未擅改成丢奖励或拒买，完整源码读审不代表该规则已实现
- Agent监督方已拒绝旧产物误成功；合法新weights/history的同一次训练归属仍无run-ID或完成marker证明，没有真实训练验收
- 实页/GPU/audio/native focus/跨标签全部组合、CSS全页面级联和视觉未因此次完整源读审获得全量行为证明；相关最终实页仍须独立验收

## 最终验收必跑/必补事项
1. All workers freeze final source/tests/manifests; reconcile current SHA after the final writer releases ownership. Whole-source reading or complete structured data check must be evidenced per path; resolve remaining ambiguous save/event/audio declarations.
2. Run the current integrated check:syntax, validate:data, typecheck and lint with all required configs and affected sentinels. Record command, environment, log, exact input fingerprints and passed/failed/skipped separately.
3. Run current integrated npm test once after all source/test changes settle. pretest compiles narrative and validates data; freeze the resulting generated input too. Do not add directed test counts or reuse old full-suite logs.
4. Parent alone runs current production npm run build including prebuild/postbuild; preserve all budgets and report actual package/entry/initial/CSS output. Old 08:24 compilation succeeded but postbuild exited 1 and all four budgets were red; not a current result.
5. Use only current platform built-in browser, current window, against final stable input. Distinguish actual input, constructed callbacks, screenshots and refresh/recovery. Cover startup/title/load/delete/fallback, class-choice/departure, base inventory/trade/facilities/home, photo/notes, map/events/chest/nest/altar, battle selection/runes/skill/grave/victory, extraction/death/retry, audio mute/unlock/dispose and reduced-motion/overlay cancellation.
6. Check current source-to-published asset graph, generated manifest validity, canonical URLs, dev-only exclusions, font/license exact-byte retention and unchanged budget limits against that production output. Earlier generated-manifest equality does not verify later bundle consumers.
7. Resource current-input guard previously invalidated six changed consumers. Current review config has been fully re-read/rebound and 6 files/34 focused cases pass; the final production output still needs exact consumer/plan/graph binding without weakening the guard.
8. Git-specific workflow/gate/CI evidence remains blocked in the no-.git snapshot. Only a real authorized checkout/index/commit can provide staged receipt and Actions state for the exact commit; do not fabricate .git, bypass gates, commit/push/publish without approval.

## 文件与口径
- coverage.json：逐路径当前SHA、证据路径与SHA、声明深度、匹配/失效、在途归属、域统计
- inventory.json：当前相同逐路径清单，不继承09:24旧状态
- gaps.json：所有不完整项及无在途归属项
- reconcile.py：只读重建脚本；重新运行只刷新本输出目录
- 任何“完整读审”只说明源码实际完整阅读并在给定任务职责内审查，绝不等于所有行为/组合无bug；结构化扫描也不等于实页级联正确
