> 状态：本轮方案已撤回，以下仅为历史记录。素材、模块与测试已移出运行目录，两处既有源码已恢复；本文不代表当前实现或已完成验收。

# 普通战斗命中至胜利表现：定向证据

- 2026-10-20，工作树基线 HEAD `6a489a1182`；只改 `game/src/battle/view/battle.vfx.js` 与定向测试。
- 审阅链路：`staged-playback` 在命中反馈队列清空后延迟释放死亡状态；`battle.layers.js` 由 `bt-death-pending` 切换倒下类；`battle.victory.js` 以战斗 token、弹层状态和减少动态守卫收束。该链路未改。
- 修复一：普通重击与真实击倒共用 `fx-finisher` 舞台亮震，致死重击后又由 `sticker-boom` 重震。舞台亮震现仅由实际击倒贴纸触发；重击仍有原本的受击抖动和顿帧。
- 修复二：同目标连续伤害时，旧一击的血条红闪清理可能删掉新一击的红闪。现取消旧清理，并以脉冲身份阻止已排队的迟到回调修改新状态。
- `npm run check:syntax`：通过，510 个项目文件。
- `npm run test:target -- tests/battle-vfx-continuity.test.js tests/battle-victory-presentation.test.js tests/battle-feedback-stickers.test.js tests/contracts.test.js tests/architecture-boundaries.test.js`：通过，5 文件 49 例。覆盖重击→击倒拍、连续受击红闪、减少动态最终血量、胜利离场取消及基础契约。
- `git diff --check`：通过。当前会话未启动服务或浏览器；真实输入下的战场视觉节奏与胜利画面由主会话实页验收。
