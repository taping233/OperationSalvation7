# 代号7：战术终端视觉规范

## 方向

原创日系战术二次元视觉：灾后废校、搜索与撤离、工业终端信息层。只借鉴高层特征（清晰剪影、强对比信息、非对称模块、斜切几何），不使用任何现成角色、Logo、UI 贴图或品牌符号。

## 色彩

| 用途 | 色值 |
| --- | --- |
| 页面/凹槽黑 | `#070A0D` / `#080C10` |
| 面板石墨 | `#151D23` / `#1B252D` |
| 主文字 | `#E7EDF0` |
| 次文字 | `#AAB7BD` |
| 琥珀警示/行动 | `#E8B04B` |
| 青色确认/导航 | `#62C4B0` |
| 危险/受伤 | `#E26D57` |
| 奥术/特殊 | `#7AA9D8` |

## 字体层级

- 页面标题：Segoe UI / Microsoft YaHei，粗体，字距 5–7px。
- 区块标题：11–13px，全大写或短中文，字距 2px。
- 数值：14–18px，优先使用高对比文字与颜色状态。
- 说明：11–13px，`#AAB7BD`；不可用状态降至 `#718088`。

## 面板与按钮

- 面板使用 1px 冷灰边框、3px 小圆角、轻微内高光；避免厚重羊皮纸纹理。
- 按钮采用深石墨渐变；确认动作使用琥珀，完成/导航使用青色，危险动作使用珊瑚红。
- 采用斜线、细网格、非对称留白作为结构提示，不能遮挡地图棋盘与卡牌文字。

## 资产生成约束

- 角色：原创成年搜索员，实用分层装备与清晰剪影；不模仿具体作品角色、制服、发饰、武器或标志。
- 场景：灾后校园、混凝土/钢材/湿地面、冷青环境光与少量琥珀应急灯；不含文字、Logo、水印。
- 角色与场景位图逐张独立调用内置 ImageGen；需要精确小尺寸字形的 UI/应用图标可由项目内确定性绘制脚本直接生成 PNG/ICO。所有最终文件复制到 `prototypes/map-system/assets/`，记录 prompt 或绘制规格、尺寸、SHA-256。

## 已接入资产

- 标题页视觉（2026-09-05 起为现行真源；旧 `title-hero-codename7-anime.png`、`title-hero-codename7-v2.png`、`title-cover-codename7.png` 及历代候选图已删除）：
  - `assets/title-winter-reverie.png`：`index.html` 冬日标题横幅图 `<img class=”winter-title-art”>`，1920×1080，SHA-256 `F055FAC72BBD0ACDAF03559CFFA71DF4824F009F94694CFF9381FD3EDEA53CE2`。
  - `assets/title-wallpaper-ruin-girl-1080p.webp`：`#title` 默认背景（`css/title-soft.css`），SHA-256 `518EBDC22ABA5136C7E5853C84E7B4C2F853B2544D93DE324CA210A40C86F7E9`。
  - 标题壁纸切换器（`src/game.boot.js`）按顺序接入 5 张 1080p 调色 webp：`title-hero-ascension-cartoon-1080p-winter-graded.webp`（`A742F65A55F6BE3AD6868323795221BA9670147F63DDE5DDFFB42C41506277C3`）、`title-wallpaper-02-whitehair-man-1080p-winter-graded.webp`（`15890BE673408B28CE3394A73FA8A82EB6ECA0435E0A32644BEF4AD94F39BA77`）、`title-wallpaper-03-capped-youth-1080p-winter-graded.webp`（`73BA2A046842EA32B8CF1D7B3D2D336CDC56B4E54953B7DF9257244982E8B8D7`）、`title-wallpaper-04-whitehair-woman-1080p-winter-graded.webp`（`9188DBBEBC815089C2CE56F173504798991EC81F19C31BD72A6D6A77EF1E3083`）、`title-wallpaper-05-white-suit-man-1080p-winter-graded.webp`（`D696B5211FF3E4D4A17980ACB39489959A71B3FAE73860051FBD3E49E7501866`）。
- `assets/brand-mark-codename7.png`：确定性工业战术”7”位图标识，256×256；用作网页 PNG favicon，并由 `desktop/make-icon.ps1` 将同一 PNG 数据封装为唯一桌面外壳的 `desktop-app/app.ico`。

环境资产第二次独立生成请求因网络错误未产出，未引入外部或版权素材。
