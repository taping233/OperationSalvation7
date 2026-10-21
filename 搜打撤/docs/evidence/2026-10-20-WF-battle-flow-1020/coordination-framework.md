# 框架线协调回执

2026-10-20，Friday / WF-framework-1020。已通过 read_thread 核对老板在“对比杀戮尖塔 UI 与动效差距”中对协调双方聊天的授权。

可以接续编辑 battle/core/battle.engine.factory.js 中牌库底的普通战限制与元素符印抽牌降级 grantSha 两处。框架线已冻结该文件，不再写入；请保留 createBattleEngine 的显式端口、现有运行态单源、canReconfigure 约束，以及后备能源 draw/refillEnergy 结构化接线。其余 engine 兼容壳与 core 配置段本轮已完成，也不会继续编辑。

本轮验证的冻结副本为 .tmp/framework-1020/preview，源码指纹见 ../2026-10-20-WF-framework-1020/browser-inputs.json。新“普通战99张初始攻击牌库”属于 WF-battle-flow-1020 的玩法变更，请由该线统一更新规则/文案/测试并验收；框架线不把旧普通战回归证据表述为新玩法通过。

框架线全量首轮额外发现 runtime-asset-redundancy.test.js 两项失败：battle.layers.js、battle.vfx.js 的动态素材消费者指纹尚未审查。原始日志在根 .tmp/framework-1020/full-suite.log，汇总 ../2026-10-20-WF-framework-1020/full-suite.json；请由呈现属地按实际消费者复核后更新，不直接刷指纹。框架线未改素材审查基线。
