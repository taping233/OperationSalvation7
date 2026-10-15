# 六只宠物 NAI 原图与内置画风重置

2026-10-13。老板要求六只现行宠物重新设计，先以 NAI 4.5 full 出完整角色，再以项目块面厚涂画法做内置重绘，最后接入游戏。角色外形由本轮独立设计，不复用旧宠物图身份。

## NAI 已完成

`generate.py` 使用 `tools/nai_gen.py` 的令牌、请求节流和额度护栏，配合 `tools/nai_style.py` v1.3；每张 1024×1024、28 steps。完整正负词、模型、seed、SHA256 见各 `*-request.json`。原图保存在本目录 `source/`，单张超过 1MB 的 PNG 不进 git，按相对路径及请求记录获取。选用：`dog.png`、`falcon-v2.png`、`cat.png`、`robot.png`、`fire-v3.png`、`penguin-v2.png`。

企鹅首次请求 seed 585864825：curl 退出码 56，虽然收到 HTTP 200，但 ZIP 被截断，未产出可用图片。核对 `request-rate.json` 为非 pending、无输出文件后，单独生成 `penguin-v2.png`。猎鹰第一稿翅尖贴边，火焰前两稿分别偏人形、黑球，因此保留并以 v2/v3 修正，不用于接线。

## 内置重绘

`final/fire.png`：使用 `fire-v3.png` 作造型参考，项目 `artifact-template-anime-block-brush` 原图 5 作画法参考，内置 image_gen 完成火焰内部分层和真实透明背景。源图存于本目录，SHA256 `f1bc4db954d80c9060f699bd1ec58bd4cfa9752bb9bdd14cab7b00315d089b4a`。其余五只内置请求连续遇到网络发送错误，尚未产出可用图；不能把其他会话的图算作本轮结果。

另一会话仍登记宠物旧图属地。本轮新图先保持在独立目录；游戏接入、旧图清理、实页验收按实际完成状态补记。无提交、推送或发布。
