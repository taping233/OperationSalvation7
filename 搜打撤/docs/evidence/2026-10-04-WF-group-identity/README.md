# 群像人物校正（2026-10-04）

- 老板授权：按人物立绘和锚点修人物；续令衣服不换、表情不纠正。最终只校正人物脸型、眼色、肤色、发型等；原服装配饰保留，第一遍改变的笑容与神态在第二遍按六步后原图回调。
- 参考：`game/assets/portraits/full/{wu,changwuyu,baita,heixiang,xingyue}.webp`，与现行人物库和运行映射核对。两处分镜的黑发少年未找到独立权威锚点，沿原图保留。
- 内置 image_gen：原6输入请求被工具在执行前拒绝（最多5路径），未生成图；实际两遍请求见 `request-pass1.json`、`request-pass2.json`。第一遍修无、常无欲、白塔、黑像；第二遍补星月并回调全部表情。
- 画面保留六步构图、明暗、玻璃材质、指尖裂纹、前景层次与统一色光。输出已在聊天中查看展示；不宣称逐像素不变或老板已认可。
- 最终候选：`.tmp/imagegen/group-identity-20261004/group-identity-clothes-expressions-kept-v2.png`（相对搜打撤）；SHA256：`5F14DE7333FDDDA8D85F9AFC1A9218C9B1D7797AC32276546CCBB4794C5ED402`。获取方式：内置生图原件 `C:/Users/太平/.codex/generated_images/01a10761-b2cd-7273-8993-bc9254de3e5a/exec-af958784-23e1-4654-9a92-7bb9584b271e.png` 直接复制；大图仅本地，不进git。
- HEAD：`425d03920e4323b016433419ec11aec4a7f3795b`；远端未刷新。仅候选图与本轮证据、登记；游戏资产/引用/源码未改，不build、不提交，无服务或后台进程。
