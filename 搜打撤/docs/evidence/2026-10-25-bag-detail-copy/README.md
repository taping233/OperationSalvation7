# 背包详情操作精简

按老板截图删除普通卡牌详情底部的“拖动整理 · 拖至盾钮存入安全格”，不再输出空提示段落；安全格转移按钮改为纯文字。其余道具/资源/安全格说明和移动/丢弃行为保留，保留所有既有增量。

修改：`game/src/hub/game.bag.js`、`game/src/hub/game.bag.safe-transfer.js`；同步 `tests/icon-hydration.test.js` 的原图标断言，未增加测试。

定向检查：`npx vitest run tests/icon-hydration.test.js tests/bag-page-lifecycle-review.test.js --reporter=dot`，93通过、2失败。图标文件6项通过；背包文件两项失败分别为“唯一合法安全格自动整格交换后，详情退出与背包关闭仍正常”（59行safe未变true）、“结晶使用回执保留复原名单与容量剩余，并保留装备可被结晶复原的规则”（390行status节点为空）。

只读基线核对：`.tmp/bag-detail-copy-baseline.config.mjs` 在Vitest转换阶段还原本轮两源码的提示/图标修改，不写回源文件；转换含恢复成功断言。只跑上述两项，同位置、同原因失败。故两项失败在本轮展示修改前已存在，本次不处理其行为。

实页：2026-10-25，Codex内置浏览器，`http://localhost:5200/`，当前窗口。真实点击开发商店→整理背包成功；测试局只有初始攻击，无法验证转移按钮。转到开发小宝箱后页面多次在读取和点击之间返回标题，控件消失；未完成截图对应详情页复核，不计实页通过。未换外部浏览器、未改存档、未启停服务。未build、未提交推送。
