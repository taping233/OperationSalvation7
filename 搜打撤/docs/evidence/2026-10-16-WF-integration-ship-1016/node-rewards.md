# 地图与节点奖励集成收尾

三项失败均为测试与已交付行为脱节；本次未修改生产代码，未删除或放宽奖励、节点消耗、存档校验断言。

| 原失败 | 根因与依据 | 修复 |
|---|---|---|
| `map-travel-path.test.js` 入城闸门 | 测试仍要求 `entered=true` 就放行；现行 `docs/rules.md` 第 1 节要求入城补给全部领取后才允许前往其他节点。`game.run.flow.js` 的移动入口、`game.run.scenes.js` 的退出说明与 `node-reward-state.js` 一致。 | 明确断言打开补给页仍无其他节点路径，全部领取后才恢复路径。 |
| `node-reward-state.test.js` 入城闸门 | 同一旧契约，还把旧档 `taken:[0]` 视为解锁。`entered` 是兼容存档字段，不再代表奖励结清。 | 覆盖未领取、只打开、部分领取、全部领取；旧档缺少 `entered` 同样按剩余奖励判定；继续验证字段结构拒绝非法类型。 |
| `node-retrigger.test.js` 收益完成即锁 | 自动扫场景帮助函数缺少当前宝箱领取入口 `chestClaim`，停在宝箱页面；同时缺少打开演出 `chestReveal` 与独立金币领取 `chestCoins`。这些动作实际存在于 `game/src/run/chests.js`。 | 补齐帮助函数的现行动作，继续通过真实页面事件领取和结算，不直接改状态。原有收益增加、原位/返回不重复发放、资源点暂不领取可重进、商店离开才消耗的断言全部保留。 |

已查阅新号 45 项 `HANDOFF.md`、`PLAN.md`、奖励接班复核及现行 `docs/rules.md`、`map-travel.md`、`save-format.md`。三选一未选卡永久放弃、满包待领、完成节点保留原类型的交付保持不变。未改动此前已加入该测试文件的 F38 存档轮换回归。

验证命令：`npx vitest run tests/map-travel-path.test.js tests/node-retrigger.test.js tests/node-reward-state.test.js --reporter=verbose`。

结果：3 个测试文件、21 项全部通过，耗时 7.29 秒。jsdom 音频无 codec 支持及既有 `class:武` 素材映射警告仍出现，没有失败或未处理异常。本次只调整测试契约与自动操作帮助函数；未启动服务、未做实页验证、未暂存或提交。整体全量和冻结门由主代理执行。
