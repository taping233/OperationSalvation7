# R7-a 两组混编实施契约

仅新增两组固定双人遭遇：L2 `archer+cavalry` 与 L4 `fire_el+grass_el`。不新增敌人行为、奖励、经济或卡牌。Elite 判定继续最先执行（L3 3%、L4 10%）；非精英才以一次 enemy 随机选择旧 entry 或新 group。旧 entry 数量区间和重复单敌规则不变；group 固定两只。非法 group 不重掷，按已选索引稳定回退旧 entry并记录原因。

真实战斗验收用 50 HP、4 攻、两张真实初始攻击、2 能量。L2 两顺序分别为一张攻击击杀3血射手后结束回合，以及一张攻击压低6血机动兵后结束回合；以真实 BattleSession 观测 HP/status。L4 两顺序均打出两张4伤初始攻击，分别集中7血灼热或12血滋生；burn/curse 仅在攻击实际造成伤害后出现，最终断言以真实异步回合时点为准。Checkpoint 保存 enemyDefs/opts/RNG，恢复不得重新组怪。

样本改为独立 `@fs` QA 页面，只加载两组目录、真实 BattleSession/BattleView 与白名单 UI/Art/Cards ports，不导入 main、正式事件总线或经济订阅者。fixture 明示与普通出征不同：固定50血/4攻/两张初始攻击，无奖励/存档；可退出并从初态重开。页面只读取真实 localStorage 快照用于显示零写入，不能替换浏览器 Storage。

文件范围：`game/data/map.json`、`game/src/game.run.scenes.js`、纯组队选择模块、`game/src/r7a.qa.js`、`docs/previews/r7a-encounters/index.html`、相应R7-a测试与交付文档。不改 battle AI、奖励结算、存档结构、R0规则或R7-b。

