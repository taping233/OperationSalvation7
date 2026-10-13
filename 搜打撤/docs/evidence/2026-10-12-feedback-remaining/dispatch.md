# 留言增量与追加调整

老板确认标题页三项与卡牌库一项完成，本轮处理其余27条；旧基地、选人到地图和战斗改造会话均已结束，接手保留既有成果。原始输入为 Downloads/sdt-feedback-all-2026-10-12T12-56-17-484Z.json，清单见 checklist.json。

追加要求：整备卡牌改四张每行并加间距；人物招式卡牌缩小并为外伸卡框留顶部安全区；按现有其他游戏参考板重做选人页；交易所切卡减少晃动；鱼塘增加关雨与开源项目衍生小玩法；内部浏览器测试全部静音并写入个人记忆。

## 并行边界（老板明确要求）

- 主代理：选人页、人物招式、整备、交易所本地动效、共享CSS/入口/文档/登记；统一内置当前窗口实机。
- pond：hub.courtyard-v3.js、courtyard-vendor/KoiPond.js、base-courtyard-v3.css、对应测试与SOURCE.md；独立关雨、投喂和摸鱼、水纹与水光。
- combat：battle/view的aim/view/vfx/feedback、battle/bag的bag/slam-skill、combat-feedback/battle-hand-overhaul/expedition-rewards CSS及对应测试；核对跟手、技能次数、贴纸、搜刮比例。
- map_events：map-generator/expedition.view、game.boot仅地图点击、node-scene-view、地图HUD/事件CSS与对应测试；首战前不可达火堆、二次点击、节点信息、Q版小人。

任何代理不改主代理feedback-oct12.css、index.html、docs/rules.md或共享台账；不build、不提交、不启动额外服务。实机与fixture、真实输入和合成事件分别记录。

## 参考依据

- 选人页沿既有绝区零参考板第16节与images/agents.webp：大角色形象、独立身份栏、紧凑肖像阵列、确认按钮独立；不改角色人设与选人规则。
- 鱼塘沿已接入MIT上游 [interactive-koi-pond](https://github.com/rzrabbi/interactive-koi-pond)：投喂、指针水纹、鱼群避让和柔和水光；新增页面内互动计数不接入基地经济。
