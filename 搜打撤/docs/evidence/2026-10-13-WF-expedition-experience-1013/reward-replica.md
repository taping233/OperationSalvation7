# 奖励页真实参考复刻

状态：实现和定向回归完成，等待主会话当前窗口实页复核。此前未经实图支撑的新增视觉工作曾暂停；本阶段依据老板指定真实参考恢复。

## 参考与结构

已实际查看本目录 `reference-images/arknights-reward-observed.jpg`：左側两列独立纵向奖励，大图/效果/青绿“收下”自上而下，右侧独立离开图标，暗背景中不再包裹一张有边框的仪表盘。

参考来源：[方舟肉鸽奖励原图](https://img2-tc.tapimg.com/moment/etag/FoD9d_8iQVPGTZiqOjdOCEybAZsb_20260124221129.png/_tap_ugc.jpg)。本地参考截图仅用于观察，不接入生产资产。

- 去掉旧 `reward-v14` 的 68/32 常驻详情表单，取消空白详情区与重复卡名、规则文本。
- 每列展示本作现有完整大卡，下方一个“收下”；点击卡图只放大阅读，放大层可直接领取，关闭不产生领取。
- 单张/两张卡使用更大的陈列尺寸，右侧独立继续/离开。只有多奖励时显示批量入口，任选一时显示唯一规则说明。
- 已收/已散落对象留在原位置降权，已收卡仍可放大复看；金币只在页首显示一次。
- 整理背包、满包提示、批量散落规则、放弃二次确认保留。继续/离开与整理稳定在独立操作区。
- 开局职业补给也使用同一陈列结构；已经完成的发卡逻辑不变，不增加第二次领取。
- 使用 `reward-scene-view.js` 共享纯展示壳；外层保留 `.reward-v14` 与 `.entry-reward-scene`，新增 `.reward-replica` 明确承载样式。
- `expedition-rewards.css` 旧 `reward-zzz`/详情表单覆盖区被收拢为当前单套规则。奖励卡入场仅短距离淡入，领取后原位重绘不重播入场；减少动态效果偏好沿用。

## 文件与边界

本阶段：`game/src/ui/reward-scene-view.js`、`game/src/run/chests.js` 的展示与点击动作、`game/src/run/game.run.altar.js` 的开局职业奖励展示块、`game/css/expedition-rewards.css`。未改变卡牌资源、卡牌数值、随机规则或此前修复的战斗领奖存档上下文/恢复事务。

测试：`tests/chest-click-flow.test.js` 增加放大关闭、卡下领取、放大层领取分支；`tests/sys03-loot-shop-txn.test.js` 只更新前部奖励展示断言，商店段归其他代理。

## 验证

- 7 文件 / 87 项定向测试通过：chest-click-flow、sys03-loot-shop-txn、four-player-chest-reload、battle-settlement-retry、expedition-page-lifecycle、contracts、architecture-boundaries。
- 已覆盖三选一、单领/批量、满包整理、已领不重发、离开二次确认、金币只发一次、真实战斗奖励多次刷新及事务失败重试。
- 本阶段修改 JS 语法、定向 ESLint、奖励 CSS 的 PostCSS 解析通过。仅文案去重随后调整，不改变点击路径。
- 实页基线保留 `05-natural-victory.jpg`。最终大卡比例、留白、真实特写和退场动效以主会话的内置浏览器证据为准；本记录不把静态检查当成视觉验收。
- 未 build、未提交、未删除文件、未修改共享登记。

实页返修：主会话 `19-reward-replica-first.jpg` 发现“收下”在卡列下方被裁切，DOM 实证为旧 `.bt-hand` 的 `max-height:46vh; overflow-y:auto` 留在新陈列容器。已从共享展示壳去除该旧类，音效采样改查 `.reward-objects`；卡列使用自然内容高度，唯一滚动层保留在 `.reward-stage`，每列卡牌和操作共同参与高度计算。等待主会话复查按钮完整可见。

`20-reward-card-detail.jpg` 显示共用放大层空备注与过小领取按钮。奖励/开局职业卡调用已采用主会话提供的 `hideNote:true`、`presentation:'expedition'`；奖励特写领取动作统一为宽青绿按钮。返修后 chest-click-flow、four-player-chest-reload、expedition-page-lifecycle 共 3 文件 / 9 项通过，待主会话同步实页复核。
