# E2 展示缺陷后续记录

记录时间：2026-09-27 13:17（UTC+8）。基线 HEAD：`480e1f6d4c9aae981057e91a75d0711e2ca883cf`。本地 `master` 相对已有 `origin/master` 领先 6、落后 0，未 fetch，非远端实时声明。本记录对应其上的未提交 E2 修复；并行 E3 修改另有归属，不纳入 E2 交付。

## 结论

E2-VIEW-01 已最小修复，原实页“剑荡妖邪 → 选择手牌 → 跳过”路径现在状态与画面一致为 41/50。新增定向回归 1 文件、2 项通过。独立 origin 的新档开局与正常保存/继续路径已通过；旧玩家档 04/05 的具体进入问题仍未归因。真实鼠标悬停仍待人工，不能标记 E2 完整实页全部通过。

## 根因和改动

真实 `BattleView` 先按快照更新单位，`spawnFloats` 随后为命中演出将常驻敌人 DOM 写回 `hpBefore`。选牌等弹层替换 `ovBody` 后，排队的 `hpAfter` 按旧容器查询不到敌人；返回战场时复用旧节点，层内签名仍等于最终状态，导致跳过更新，画面持续残留受击前血量。

只修改 `game/src/battle/battle.layers.js`：敌人节点断开后重新挂载时失效 HP 文字/百分比签名，并即时恢复快照对应的文字、主血条和延迟血条。持续挂载的普通渲染沿用原演出逻辑。未修改战斗规则、快照契约、反馈调度或 fixture，也未扩大至己方/盟友显示路径。

## 验证与证据

- 新增 `tests/e2-view-hp.test.js`，使用真实 BattleSession、BattleView、VFX 和命令。原实现下普通反馈通过，反馈期间弹层往返用例失败：实际 `50/50`，期望 `41/50`；修复后两项通过。
- 正常演出断言：伤害帧后为 `50/50`；反馈结束前触发一次仍连通的普通重绘，仍为 `50/50`；反馈完成后 `41/50`，两条血条均为 82%。弹层用例通过真实打开/关闭墓地复现节点替换竞态。
- 定向命令：`npx vitest run --no-file-parallelism tests/e2-view-hp.test.js`。最后补时序断言后再次通过，未运行全量、build，未暂存或提交。
- 当前窗口实页：13:16:15.876（UTC+8），原剑荡妖邪样本跳过选牌后，`phase=player`、`busy=false`、队列 0、`handSelecting=null`，快照敌 HP=41，DOM=41/50，主条与延迟条均 82%。证据在 `docs/evidence/e2-view-followup-2026-09-27/hp-fixed-records.json`、`hp-fixed-dom.txt`、`hp-fixed.png`；`hp-console.json` 无 warning/error。
- 修复页存储快照保持 38 键、SHA256 `9c2508455c380d5753f91ba75816f9f0cf574fa4766e700f112afadbc53db0c7`；只证明取样时一致，不证明期间从无写入尝试。

## 主入口有限补验

使用已有 Vite 依赖在 `http://127.0.0.1:5188/` 启动本地服务，不跑 predev/build、不修改配置。先进入只读隔离 fixture，DOM 证实该 origin 存储初始为 0 键、空数组 SHA256 `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`。原 `:5187` 玩家档未操作。

通过真实 UI 新建档位 1、进入基地、整备、选择人物并出发。E3 在途修改 `game.session.js` 曾触发 Vite 自动刷新，服务日志明确记录；这是本次验收干扰，不归为游戏缺陷。随后本轮服务以 `createServer({server:{host:'127.0.0.1',port:5188,strictPort:true,hmr:false}})` 关闭热更新重启，再通过“继续对局”恢复地图；完成“保存并回主菜单 → 进入档位 1 → 继续对局”，实际显示第 1 层、35/35 HP、两条相邻路线及“已读取【档位 1】存档”日志。

证据为同目录 `isolated-origin-baseline.json`、`main-01-new-slot.png`、`main-02-persisted-run.png`、`main-03-restored-map*`、`main-04-normal-resume*`、`main-console.json`。主流程正常写入测试存储，随后 fixture 记录为 38 键；`isolated-origin-after-main.json` 的 `storageEqual=true` 是该新页面与自身基线一致，绝非主流程没有写存储。

本验证运行于包含 E3 在途改动的共享工作区，不能归为纯基线版本或 E3 最终交付验收；它证明隔离新档的自然进入/保存/恢复路径可走通，不能证明旧 04/05 档案的特定迁移或结构问题。未复制玩家档、清理存储或修改主菜单/加载流程。

## 未完成与交付边界

- 真实 hover 仍按 Friday 裁决转人工；当前工具没有真实 hover 接口，不用脚本事件替代。
- Sol 独立审查实际差异、补强后的两项回归及实页截图/DOM/JSON，确认无待处理问题，E2-VIEW-01 当前修复与原路径复验可关闭。测试红绿复用实施代理实际执行结果，审查者未重复跑测试。
- 最终 Git 门禁尚未执行；全量/index/提交须由 Friday 协调独占窗口，当前未取得窗口。
- E2 自有文件为展示修复、专属回归、本记录及上述证据目录。E3 的结算命令、`game.bag.settle.js`、`game.session.js`、测试和结果记录不属于本批。
