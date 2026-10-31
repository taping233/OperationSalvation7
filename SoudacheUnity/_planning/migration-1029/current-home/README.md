# 现行首页原生迁移切片（2026-10-30）

已替换旧 Unity 首页结构、旧字形标题和 AK 圆形入口，保留已有进入存档链。现行源为同工作区 `../搜打撤/game`；源文件与资源逐项 SHA256 见 `source-receipt.json`。本切片冻结在源结构/资源/入口完成、原生画面和输入待主会集中验收的状态；不能据此宣称视觉效果全部等价。

## 来源和原生对应

| 现行来源 | 原生职责与落点 |
| --- | --- |
| `index.html #title.home-composed` | `TitleScreen.cs`，保留 `home-scene / title-inner / home-command / home-support / home-footer` 分组及 11 个控件 ID。 |
| `ui-scale.css → title-p0.css`，随后 `ak-skin.css`，再 `home-polish.css` | 1920×1080 基准；主组 left6.6%、top13%、width28%；品牌宽91%；主按钮108px、指南72px、主组间距20px；右组 right6.6%、top32%、width22%，收藏90px/22px间距，系统58px/6px间距、顶距38px。 |
| 同上最终级联 | 正式 PNG wordmark（3200×1486）；主按钮40px、收藏24px、系统21px；保留最终 `.home-button-copy::after { display:none }`，未把隐藏英文副标添加为可见内容。 |
| `title-wallpaper.js` | `CurrentHomeAssets / CurrentHomeMotion`；顺序 snow-road、baita-heixiang、xingyue-piano、wu-bass、baita-station、xingyue-reeds、companions-dinner；默认 wu-bass（4/7），同一 `sdt-title-wallpaper` 全局键保存；七层独立500ms交叉淡变，包含连续点击与环回。 |
| `home-fx.js / home-polish.css` | `CurrentHomeMotion / CurrentHomePlate / CurrentHomeAmbient`：时钟、视差、漂移、暂停、悬停文本位移、按钮光层、主按钮扫光、点击波纹、雪粒、字标闪点。 |
| `home-layers.js / home-layers.css` | 斜板、边角、左侧标尺、CODE NAME 7 轮廓字及按钮编号；源 SVG/渐变参数由 `sync_home.py` 转为独立原生素材。 |
| `home-menu-motion.js` | `CurrentHomeMotion`：首次/返回分档、180ms离场、只看壁纸260ms隐藏/恢复分档；减少动态效果复用 `sdt-reduce-motion`。 |
| `title-credits.js / title-credits.css` | `CreditsScreen.cs`；当前团队/鸣谢/模型姓名、原生模态、Esc/外侧/返回关闭、姓名左右入场。 |
| `menu-feedback.js / feedback.local.js / page-settings.css` | `HomeInboxScreen / HomeInboxDeleteDialog`；`sdt-suggestions-v1`，待处理优先/每页20条/完成/二次确认删除/单条与全部导出/空态。只使用现行 Saves.Global 数据，不接旧 Unity 文件存储。 |

## 入口与数据

`mStart → SlotPickerScreen`；`mGuide → GuideScreen`；`mAch → AchievementsScreen`；`btnCardLib → App.OpenCardLib`；`mSettings → SettingsScreen`；`mCredits → CreditsScreen`；`btnTitleExit → Application.Quit`（源首页直接退出，未再进入旧告别页）。静音复用 AudioService，底部 `mInbox` 为真实信箱；原有 SuggestionBox 写信入口归主会维护。

信箱读取失败保留原值；完成只附 `done:true`，不添加源没有的 `doneAt`。导出按源 formatVersion1/records 格式，原生文件目的地为 `Application.persistentDataPath/output/feedback/`，在页面显示实际路径。源可选浏览器诊断摘要没有对应原生来源，因此不添加。旧 `TitleScreen.FmtPlayTime` 方法仍保留供现有 SlotPicker 消费，首页本身不再展示旧 Archive/撤离数。

## 已做检查

- `python _planning/migration-1029/current-home/verify_home.py`：源指纹、资源 SHA、原图逐像素、全部控件、七壁纸顺序/默认、透明无损导入设置；报告 `verification.json`。
- `python _planning/migration-1029/current-home/check_compile.py`：仅本切片10份 C#，引用已导入 Unity 程序集，独立 `compile-home-only/` 输出；0警告、0错误。没有启动Unity、切前台或写共享 compile。早期 `compile/` 整域尝试遇其他属地正在写入，已由此定向检查替代，不算全项目通过。
- PNG importer保留3200px字标（4096上限）、关闭mipmap/压缩、保留alpha；现有 `.meta` GUID不覆盖。源不删除，旧资产不删除，未提交。

## 原生验收和已知效果差异

主会统一生成新图、更新 current ID 输入探针后，另做独立原生复核。此次未运行任何原生窗口、截图或点击。

初始切片的效果缺口及后续消费者修复现见 [current-surface-effects](../current-surface-effects/README.md)。该后续批已补实际生效的 backdrop、离场滤镜/flash、screen/soft-light、真描边字/渐变遮罩/180秒滚动和近雪遮罩；工具伪层则经最终级联核对为 `content:none`。固定种子颗粒载体、其它光效细节及所有新增材质的原生画面/输入仍未验收，不能据静态或编译通过宣称效果原样完成。
