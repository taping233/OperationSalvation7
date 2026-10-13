# 五人 Q 版头像重绘

内置 ImageGen 按现行立绘身份与默认块面手绘画风逐张重绘无、常无欲、白塔、黑像、星月，统一透明底大头胸像。老板反馈后，黑像按「厉兵秣马」卡面将下脸颊斜疤修为眼外侧纵向缝线疤；另按「禁咒 I」新增星月暗牧版，紫瞳、深色新月、黑灰高领服与紫披肩。

五张默认图沿用 `game/assets/portraits/avatars/<角色id>.webp` 实际引用；新增 `xingyue-dark.webp` 单独保存，本轮未增加形态自动切换行为。完整原始提示见 request.json，修订与暗牧提示见 refinements.json，来源指纹、旧图指纹与运行资源记录见 receipt.json。原始 PNG 与替换前 WebP 位于 `.tmp/imagegen/chibi-avatars-20261010/`，不进 git。

已目视核对工具返回画作。未测试、未实页验收、未 build、未提交。
