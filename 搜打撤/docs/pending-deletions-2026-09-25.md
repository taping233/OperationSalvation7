# 删除报批清单（2026-09-25）——**已执行完毕**

> 老板 09-25 批示：「UI 图标重绘方案暂时取消，其他你都执行」。除图标方案外全部落地，
> 分三笔落库：资产批、`cd6c3ba` JS 死代码批、`49f7cd7` CSS 死块批。本清单留档。

## 已执行

1. **临时工作文件 4 个**：`.tmp-codemod.mjs`、`.tmp-lint-analysis.mjs`、`battle-lint.tmp.json`、`full-test.tmp.log` ✅
2. **卡面死图 5 张 + thumbs 5 张**：martial-cc-treasure / martial-cc-jianghu / spell-cc-manasupply / equip-tt3-dark-blade / martial-builtin-sha（含 thumbs 镜像）；`card-art-coverage` KNOWN_ORPHANS 白名单同步收窄至 martial-melee/ranged 两条合法兜底，守卫测试绿 ✅
3. **走查截图产物**：`game/.sdt-shots-upgrade/`（9 张）✅
4. **NAI 中间产物**：lab-ending `ending-{1,2,3}.zip` + `*.payload.json`（6 个，webp 本体保留）✅
5. **体检基线 worktree**：`D:\素材\_wt-head-check` 及注册记录——核实已不存在（此前批次已清），仅销账 ✅
6. **孤儿资产 108 个跟踪文件**（orphan-audit 高置信 81 + 中置信 26 + license 1）：
   cursor-art 三件套连带 9、别名副本 2、旧场景图 14、杂项 9（sign.webp 系 09-23 拍板移除）、
   game-icons 整目录 31+署名、旧原型 6、tt-peach 2、redraw-preview 底稿 24 ✅
7. **CSS**：`cursor-art.css` 死文件整删（含其 2 行在途改动，零挂载无效果面）；
   `overlays.css` 死规则块 85 行（旧 HUD 徽章族/旧战斗面板族/旧基地容器/旧背包网格/shop-list，
   含报告漏列的 slot-hud 族——补核零生成点后删）✅
8. **meta.js**：`track('extract'/'death')` 孤儿 case（纯 switch 无反射，零调用方）✅
9. **休眠代码**：cardslib 分页机制残留（libPageIndex/分页条渲染/三页缓存/预热任务/keepPage 死分支/
   libPagePrev-Next 死注册）、overlay.js sceneNext 死探测、run.scenes finishScene/sceneState ✅
10. **`.pyc` 停跟踪**：`git rm --cached` + `.gitignore` 拉黑 `__pycache__/` ✅

## 取消 / 保留 / 延后

- **UI 图标重绘方案：取消**（老板 09-25 拍板）。关联项 `gear.png` 画错（循环箭头非齿轮）**维持现状**——无备用图，随方案取消一并搁置。
- **ending-3 人影**：保留原样（出图定版语义）。
- **art-source/ 36 张创作源归档**：零引用但属创作档案，报告 §3 建议保留，未动。
- **CSS 死块余量 43 块**（base/battle/cards/expedition-library/hub/scenes/winter 七文件）：文件含 UI 审查会话在途改动，避让延后——待其落库后由巡检轮按类名重扫清除。
- **`cursor-art.css` 上 UI 审查会话的 2 行在途改动**：随死文件删除一并消灭（该文件零挂载，改动无效果面），已在提交披露。
