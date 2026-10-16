# NAI 提示词第一步调整

2026-10-16，老板授权执行第一步：以原v3.0为基线，移除厨房遗留词与质量尾的high complexity，替换头发与边缘描述；版本记为v3.1，效果尚待出图确认。

新增头发句：`Hair consists of broad flowing locks with irregular painted highlights and shadow masses.`

替换边缘句：`Use lost-and-found edges, with crisp focal edges and softer turning edges.`

保留完整轮廓、脸手刻画、皮肤过渡、衣料块面以及其他原描述。原画师链、负面基线和nai_gen客户端不改。修改前共享常量与客户端SHA256见[before.json](before.json)，历史认可请求不回写。

本次仅修改配方与同步文档，不生图、不接入游戏、不提交。验证结果见[verification.json](verification.json)。
