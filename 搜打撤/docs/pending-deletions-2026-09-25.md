# 删除报批清单（2026-09-25 汇总）

> 老板批前**一律不删**。批准方式：直接回复「同意第 N 类」或圈掉例外项。
> 删除执行时逐项用 git 记录（tracked 文件走 git rm 留痕）。

## 1. 临时工作文件（lint 收口批副产物，已无用）
- `搜打撤/.tmp-codemod.mjs`
- `搜打撤/.tmp-lint-analysis.mjs`
- `搜打撤/battle-lint.tmp.json`
- `搜打撤/full-test.tmp.log`

## 2. 卡面死图 5 张（card-art-coverage KNOWN_ORPHANS 在案，id 已退役）
- `game/assets/cards/martial-cc-treasure.webp` —— 盗宝旧 id（现役 cmtn1i64j7y7 已有图），09-12 落错名事故遗留
- `game/assets/cards/martial-cc-jianghu.webp` —— 江湖救急旧 id（现役 cmtn1wnhhym 已有图）
- `game/assets/cards/spell-cc-manasupply.webp` —— 法力补给旧 id（现役 tt7-maxsupply 已有图）
- `game/assets/cards/equip-tt3-dark-blade.webp` —— 灭魔之剑整卡退役（09-16 留言已批删卡，图成死图）
- `game/assets/cards/martial-builtin-sha.webp` —— 「杀」改名 starter-attack（09-20 affecbc）后遗留旧 id 图
- 删除后须同步收窄 tests/card-art-coverage.test.js 的 KNOWN_ORPHANS 白名单（留 martial-melee/ranged 两条合法兜底）。

## 3. 走查/验证截图产物
- `搜打撤/game/.sdt-shots-upgrade/`（9 张验证截图，未入库）

## 4. NAI 中间产物（本次三图生成的 zip 残留）
- `game/assets/scenes/lab-ending/ending-{1,2,3}.zip`（nai_gen 设计上保留 zip，webp 已另存）

## 5. 体检基线 worktree（09-24 临时验证产物）
- `D:\素材\_wt-head-check\`（含 node_modules 目录联接）
- `D:\素材\代号柒\.git` 内对应 worktree 注册记录（`git worktree remove` + `git worktree prune`）

## 6. 资产孤儿（09-25 专项盘点已补全，详见 docs/orphan-audit-2026-09-25.md）
- **高置信删除候选 81 文件 / 2.67MB，分 7 组**：cursor-art 三件套连带 9 文件、白名单死图 5 张+thumbs 5 张（并案第 2 类）、字节别名副本 2 文件、被替代旧场景图 14 文件、杂项 9 文件（sign.webp 有测试负断言锚定）、game-icons 素材库 31 svg、home-prototype 旧原型 6 svg——逐文件路径见 orphan-audit 报告 §资产孤儿。
- **中置信 26 文件 / 3.53MB 待老板拍板**：tt-peach 2 张（卡现役但 itemArt 漏登记，删图或补映射二选一）、resources-redraw-preview 24 张对比底稿。
- art-source 36 张创作源归档零引用但**不入候选**（创作档案）；sfx/frames/卡面/图标经动态构造规则穷举全活，零误杀。

## 7. CSS 孤儿（09-25 专项盘点已补全，详见 docs/orphan-audit-2026-09-25.md）
- 文件级：`game/css/cursor-art.css` 唯一（零 link、零 JS import、index.html 无挂载点）。
- 规则块级：87 块全类名零生成点（去重 ≈82），分组在报告 §4.2；**行号会随在途改动漂移，执行删除必须按选择器类名重扫**。

## 8. 观望项（不删，仅记录）
- `tools/__pycache__/nai_gen.cpython-38.pyc`：建议改 .gitignore 停跟踪（首次提交需 `git rm --cached`，属删除类操作，待批）。

## 9. 调试钩子删除项（09-25 只读调查结论 A：可安全删）
- `game/src/battle/battle.frames.js` 308-316 行（基于 HEAD c89b289）：`window.__bfDebug` 快照钩子，
  09-20 a59e2ff 排查「立绘闪现」的观测工具；该提交即根因修复批且实机验收通过，此后无复发；
  全仓 `bfDebug` 仅定义处一条、零消费、无测试断言。删除须同步跑 `tests/battle-frames-lifecycle.test.js`。
- 行号在 battle 重构批次后会漂移，执行时以 rg `__bfDebug` 重定位。
