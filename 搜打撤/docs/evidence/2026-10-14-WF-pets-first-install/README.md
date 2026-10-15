# 六只宠物第一版内置重绘实装

2026-10-14，老板指定采用本聊天第一版六张内置重绘图。狗、猎鹰、猫、机器人、火焰精灵、企鹅均采用首轮结果；不采用后续可爱版或Q版候选。

## 接入

六张图片替换 `game/assets/icons/base-v3/companion-*.webp`，现行 `hub.visuals.js` 已统一消费这些路径，伙伴缩略图与大图共用资源，无须修改玩法或源码。沿用现有编码参数：720×720、WebP quality 88、method 6，保留RGBA透明通道。资产清单仅更新对应六条的字节数、SHA256和来源。旧制作源图保留。

`encode.py` 保存固定选图和编码过程；`receipts.json` 记录原图获取路径、本地副本、原图与产物SHA256及透明通道检查。原图来自本聊天内置imagegen，使用NAI造型与项目块面厚涂参考；PNG本地副本位于 `source/`，忽略Git，原生成目录仍保留。需要恢复时按receipts的generatedSource复制并校验SHA256。

## 验证

- 六张产物均为720×720 RGBA，alpha极值0/255；来源与产物SHA256已登记。
- 增量资产审计：本轮六张零问题；全局审计仍有93项范围外错误、618项既有警告，完整结果见 `asset-check.json`，不宣称全局门通过。
- Codex内置浏览器，当前1280×720窗口，`http://127.0.0.1:5200/`，复用现有服务。通过真实UI输入进入档位01→配置→伙伴，逐只切换六只；未解锁伙伴以现有未相遇状态展示。七个图片节点均complete、naturalWidth/naturalHeight为720。未改宠物解锁、等级或玩法数据。
- 静音按钮class含muted；本轮页面error日志为空。截图分别为 `dog-page.png`、`falcon-page.png`、`cat-page.png`、`robot-page.png`、`fire-page.png`、`penguin-page.png`，哈希见 `screenshots.json`。
- 仅替换已引用图片与来源清单，无游戏源码变化，未跑玩法全量或build；无提交、推送、发布或EXE重打包。
