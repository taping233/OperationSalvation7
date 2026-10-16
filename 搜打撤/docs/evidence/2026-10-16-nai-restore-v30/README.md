# 恢复 NAI v3.0

2026-10-16，老板明确要求调整回v3.0。以 `../2026-10-16-nai-style-step1/before.json` 保存的v3.0常量为恢复来源；版本、画师链、通用画法、质量尾和通用UC逐字恢复。修改前源码保存为[before-nai_style.py.txt](before-nai_style.py.txt)。不覆盖构建器与其他历史代码，客户端模型/尺寸/采样不改。

恢复四画师链quasarcake0.9/rella0.5/gomzi0.4/piromizu0.3，移除共享默认中的ASK；恢复high complexity质量尾与原头发/边缘句，取消v3.2新增通用光色句。人物关系与适度重复写作原则继续保留，历史请求/候选不改；原v3.0画法里的kitchen用语亦按快照原样恢复。

仅ASK样图在老板改令前已成功生成并实看，完整请求及哈希见 `../2026-10-16-nai-v5-ask-only/request.json`，原图根 `.tmp/nai/nai-v5-ask-only-20261016/wu-ask05.png` 保留；该图不代表当前默认。此次恢复不另生图，不接入游戏，无服务/build/提交。
