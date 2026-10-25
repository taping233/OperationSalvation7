# 米高芬：朝右透明战斗立绘

按老板要求，米高芬在战斗随从位使用独立全身立绘：身体、头和双脚朝画面右侧，站立待机，保留棕色玩偶熊、纽扣眼、缝线与补丁。照相馆卡图保留原有插画。

立绘由内置ImageGen两轮生成，完整提示词及参考见[请求](request.json)。最终输出 `game/assets/portraits/allies/migaofen-v1.webp`，1024×1536 RGBA；编码保留透明通道并加透明安全边，Alpha范围0–255，四角Alpha均为0，完全透明像素950544/1572864。最终来源与SHA256见[收据](receipt.json)，源PNG保留在项目 `.tmp/imagegen/2026-10-25-migaofen-battle/`。

`battle.layers.js` 将米高芬及旧名称步兵的随从图片映射改为本立绘，素材清单新增本图。未修改名字、攻血、承伤或自动攻击行为。随从DOM显示测试11项通过，见[测试结果](ally-tests.json)；未做游戏实页、未build、未提交或推送。
