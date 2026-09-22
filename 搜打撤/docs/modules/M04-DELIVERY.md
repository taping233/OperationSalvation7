# M04 视觉、UI 与可接入资产交付

## 接口与范围

本包交付 M04-a 方向样张和可消费视觉规范，不生成或冒充最终房间／家具美术。`game/src/home.visuals.js` 导出冻结的 `M04_VISUAL_PACK`、`getM04VisualPack()`、`HOME_VISUAL_IDS` 和纯投影函数 `projectHomeCell()`；不写经济、存档、布局或战斗状态。

房间直接投影 M03 `base-room-01` 的 8×6 网格与原 zones。屏幕投影为 dimetric：1920×1080 基准、原点 `(960,252)`、格尺寸 `(112,56)`。家具与角色使用脚底中心轴心；地毯、普通家具、人物、前景、热点依次分层，热点保持最高层和至少 44px 点击区。

六家具视觉 ID 分别为 `home-furniture-display-cabinet-proto`、`home-furniture-work-table-proto`、`home-furniture-chair-proto`、`home-furniture-table-lamp-proto`、`home-furniture-woven-rug-proto`、`home-furniture-wall-decoration-proto`。M05 按 visualId 查询 `VisualPack.assets`，不在业务 UI 散落路径。原型素材各自独立 SVG，清单为 `game/assets/home-prototype/manifest.json`。

## 样张与资产状态

- `docs/previews/m04/base.html`：六家具、角色尺度、五热点、全部旧入口、满仓与缺钱。
- `docs/previews/m04/collection.html`：真实长度卡名、实体归零、未解锁与空分类。
- `docs/previews/m04/loadout.html`：满仓、缺卡、职业禁带、禁用确认。
- `docs/previews/m04/combat-tip.html`：现有敌人素材、长卡名、焦点、意图和闪避解释。

已有正式素材只作为上下文复用：星月战斗立绘、boss_general 敌人图与 battle-street 场景。本轮新增 `home-prototype/*.svg` 均是原创几何占位，带 PROTO 标记；没有候选正式图，也没有调用生图。房间材质、光照、家具造型和最终 UI 装饰等待制作人确认代表性目标后再铺量。

## M04-A～D 状态

- **M04-A：完成（原型包）**。manifest 路径、尺寸声明、独立文件、pivot、占地与层级已检查。正式像素资产的 alpha 边缘仍待后续生产。
- **M04-B：部分完成**。四页覆盖长卡名、空／满仓、缺钱、未解锁、缺卡和禁带。Codex 内置浏览器检查 1920×1080 基地页无溢出；1280×720 四页均无横向溢出、破图或小于 44px 的可见交互控件。制作人审美尚未确认。
- **M04-C：完成（样张层）**。五热点和出征、仓库、商店、升级、人物、成就·收藏室、返回、帮助均有位置。游戏内 hit-test 与 `winter.css` 级联归 M05 接入验收。
- **M04-D：待制作人**。本包停在方向样张；不能宣称新增视觉最终通过。

定向检查：`npx vitest run tests/m04-visual-pack.test.js tests/m04-preview-contract.test.js --no-file-parallelism`。本包不改 `main.js`、`game.hub.js`、`art.js` 或公共样式；正式游戏入口尚未接这四页。
