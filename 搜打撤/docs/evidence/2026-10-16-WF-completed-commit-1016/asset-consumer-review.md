# 动态资源消费者复核

本次复核范围为 sound.js、battle.frames.js、battle.layers.js、art.js 相对HEAD的差异，随后才更新现有发布审查中的源码指纹。保留现行195项精确省略清单，不新增省略，不调整预算或放宽守卫。

- sound.js 只交换已有界面音效与战斗音效加载顺序；样本路径、并发解码限制和回退未改。
- battle.frames.js 只复用同一tick几何及轮询尺寸，角色帧catalog、皮肤选择、纹理路径与fallback未改。
- battle.layers.js 调整输入读取区域、手牌尺寸/焦点、名牌与血条/属性布局。角色Art.battleArt/classArt、怪物monsterArt、随从资源调用与回退沿用原路径。职业技能图改由独立battle.skill-view.js的固定new URL枚举提供，均为本轮显式静态资产，不借动态消费者回指已省略原图。
- art.js 只调整预取让步条件和响应体流式消费，资源注册、URL解析、覆盖表、默认立绘及别名选择未改。

原差异见 `asset-consumer-review-diff.json`，新旧规范化LF源码SHA见 `asset-fingerprint-review.json`。后续素材省略契约和源码漂移回退测试仍须通过，不能仅凭更新指纹判定安全。

后续复核的选择器：chests.js的宝箱仍通过同一chest-opening-art.js固定帧集；奖励总览、容量/回执和背包返回改动不新增动态资源构造。game.run.scenes.js的增量为节点复原持久化及动作/文案，不改变scene资源选择。game.run.data.js、battle.scenery.js、scenes.css把战斗场景统一到显式platform-minimal-1016三层，三条新URL均不在旧省略清单。map-node-art.js保留原类型美术仅加状态文字，renderer.js复用几何及道路缓存仍经同一美术选择器，camp-entry.js保留CUT_SCENES表仅加图像准备与取消。未恢复任何精确省略路径，映射/原稿文件未改。
