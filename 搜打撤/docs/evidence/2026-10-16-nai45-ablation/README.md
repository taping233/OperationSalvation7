# NAI 4.5 画师与复杂度对照

2026-10-16，老板授权多组排列组合与消融。固定4.5 Full、1216×832、28步、CFG5.5、Euler Ancestral/Karras、Rescale0、Variety+关闭、seed3058649506；基础吃饭场景、角色槽、负面词与字段设置相同。A与D复用本聊天已有请求/原图并核对完整payload及SHA256，新生成B/C/E/F/G/H六张。

原四人链：quasarcake0.9、rella0.5、gomzi0.4、piromizu0.3。

| 编号 | 配方 | 用于比较 |
|---|---|---|
| A | 原四人链，无high complexity | 原基线 |
| B | 原四人链，有high complexity | 与A比较复杂度词 |
| C | 原四人链＋ASK0.2，无high complexity | 与A比较低权重ASK |
| D | 原四人链＋ASK0.2，有high complexity | 与B比较ASK，与C比较复杂度词 |
| E | 原四人链＋ASK0.5，有high complexity | 与D比较ASK权重 |
| F | 从D去掉piromizu | 单项消融 |
| G | 从D去掉gomzi | 单项消融 |
| H | D中rella从0.5提高到0.8 | 单项强度调整 |

所有完整请求、原图路径、哈希、复用来源和逐组结果见[manifest.json](manifest.json)。串行调用现有nai_gen/nai_guard，不绕过节流；失败即停，不自动刷图。对照板位于根.tmp/nai/nai45-ablation-20261016/comparison-A-H.jpg，不入Git。

本轮仅有一个种子，改词仍可能改变构图；不把单种子差异归纳为画师的稳定分工。样图未获老板选择前不更新共享默认、不接入游戏。无测试、build、提交或服务端口。
