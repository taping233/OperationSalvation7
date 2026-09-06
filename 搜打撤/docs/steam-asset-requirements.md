# Steam 商店素材规格清单（占位 · 发布期填内容）

来源：gamedev skills / steam-publish。发布前在此登记每项素材的文件、尺寸与状态。
当前项目基调：二次元 · 二维平面 · 卡牌 · 肉鸽 · 搜打撤。

## 库 Capsule（必须）

| 素材 | 尺寸 | 文件 | 状态 |
| --- | --- | --- | --- |
| Header capsule | 920×430 | — | ☐ |
| Small capsule | 462×174 | — | ☐ |
| Main capsule | 616×353 | — | ☐ |
| Vertical capsule | 374×448 | — | ☐ |
| Library hero | 3840×1240 | — | ☐ |
| Library header | 920×430 | — | ☐ |
| Library logo（透明 PNG） | 1280×720 内 | — | ☐ |

## 商店页

| 素材 | 规格 | 文件 | 状态 |
| --- | --- | --- | --- |
| 页面主图 | 616×353 | — | ☐ |
| 截图 ×5+ | 1920×1080 | — | ☐ |
| 预告片 | ≥1920×1080, 30~60s | — | ☐ |
| 简介短句（≤300 字符） | 文案 | — | ☐ |
| 成就图标 | 64×64 ×N | — | ☐ |

## 上架前置（steam-publish 流程）

- Steam Direct $100 / App ID / 专用构建账号（最小权限）
- SteamPipe：`app_build_<id>.vdf` + `steamcmd` 上传；构建产物复用 `npm run dist` 便携版管线
- 分支策略：default / demo / beta
