# 卡牌全入口同步与旧规则清理

老板要求新卡牌样式同步战斗、发现、手牌、背包和商店，随后明确要求删除旧规则。共用银墨卡面覆盖正式界面、悬停预览和直接挂在 body 下的购买飞行卡牌；字号统一按卡宽缩放。

删除156条旧规则：card-v3 40条、winter 103条、battle 6条、expedition-battle 2条、ak-skin 5条。删除清单见 [removed-rules.json](removed-rules.json)。从旧规则中保留牌库卡宽、字号与宝箱不同卡数的字号；保留页面排布、卡槽、交互反馈、逐卡 object-position 和词条提示。未删除文件，未改卡牌数据、玩法、渲染器或存档代码。

2026-10-10，Codex内置浏览器，当前窗口，无尺寸覆盖：

- 战斗与手牌：localhost:5200已有独立验收档位02，真实进入对局；grid卡体、绝对定位全幅图、按卡宽字号、稀有银墨图层生效，见 [battle.png](battle.png)。
- 发现：真实点击药水魔法→自己，三张药水卡显示相同银墨饰纹；无卡体内容溢出，见 [discover.png](discover.png)。
- 战斗背包：真实点击背包，安全格卡牌沿用银墨卡面，见 [bag.png](bag.png)。未进行安全格存入操作。
- 商店：用正式CSS与此前读取的法力光波/药水魔法结构建立 [shop-fixture.html](shop-fixture.html)，确认卡体、全幅图、饰纹与价签可显示；无卡体内容溢出、页面error日志0，见 [shop-constructed.png](shop-constructed.png)。此项是构造样本，未验证真实购买、神秘货箱及购买飞行动画。

共享树热更新曾使实际游戏重载回标题；恢复独立测试档后完成战斗与背包取证。只读浏览了127.0.0.1既有档位04普通背包；后续交互均在localhost已有验收档位02进行。游戏真实交互与商店构造样本分别记载，不互相替代。

定向测试：hand-cost-patterns、battle-card-inspection、contracts三文件23项通过。样式解析、文档守卫与差异检查结果见 [checks.json](checks.json)。未运行build、全量测试、提交、推送或发布；无新服务。
