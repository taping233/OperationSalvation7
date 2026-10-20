# 规则数值与描述同源：最小接入

现行“包扎”的回复生命/获得护甲和“坚守”的获得护甲/抽牌完整已审阅句式，从 `rules.triggers.onPlay` 的 `amountField` 或合法字面量 `amount` 读取数值。当前卡库已审阅文案逐字保持；修改对应规则字段后，卡面、富文本和照相馆搜索渲染同步更新。卡面缓存键包含最终描述，避免同一卡对象更新数值后复用旧文案。

支持范围限定为无注能、以自身为目标、只有 `onPlay` 的上述两个完整句式；数值限正整数。其他时点、重放、装备/背包域、附加条件/参数/效果、缺失声明、改写描述与错配 ID 均保留旧入口结果。没有修改卡库、schema、capability 或规则解释器。旧二参数描述调用保持兼容，可选第三参数提供当前完整卡对象。

验证：专属回归和 hotpaths 两文件 28 项通过，详见 `description-target-tests.log`。覆盖当前卡库原文不变、真实消费者接线、字段与字面量数值变化、同对象缓存更新，以及不完整/复杂声明整段回退。现有 `card-description-text.test.js` 首轮通过，随后重跑因当前卡库缺少 `tt12-hitechrd`、`tt12-freezeray` 失败两项；本子任务未修改对应属地，未据此扩范围。首轮 benchmark 由环境变量门控跳过，未作性能结论。

输入证据：编辑前三个既有文件的字节副本与 SHA256 在 `.tmp/sts2-description-before/`；指纹复制为 `description-before-fingerprints.json`。最终当前输入指纹在 `description-current-inputs.json`。首轮未记录同时刻全卡库指纹，不能把后录指纹当作首轮基线。首轮工具输出与后续失败摘录分别转存 `description-first-run.log`、`description-existing-regression-failure.log`。

未运行 build、服务、游戏实页、安装、提交；该最小接入保持现行玩家文案不变。共享工作树的卡库缺项由 root 集成时统一核对。
