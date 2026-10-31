# 最终桌面包：菜单/基地回程与指南独立实绘复查

结论：这组16张实际Standalone图片中，除主线已登记的Guide-more-4“安全格不参与首脑编组”源文案错误外，未发现新增确证P1/P2。该已知文字项不计为本审新增，也未在本报告宣告修复；应以主线后续构建复验为准。

本审直接看新图与现行源实际入口/最终CSS，不复用旧图、旧passed或旧矩阵结论。未启动Unity/构建/前台，未改Assets。图片来自 `desktop-final-player-1`：passed=true、进程退出0、正常ScreenSpaceOverlay/CanvasScaler 1.33333、2560×1440、DPI120、D3D12；zeroAlphaAndNonactivating=true，程序构造输入，无OS硬件输入。Build GUID为 `ce4c060a81664db7bf661b9e01dae9e9`。PNG本身为2560×1440；常规查看工具缩至2048×1152用于全页检查，并对Guide-more-3使用原始尺寸复查正文/折行。

## 直接观察与源核对

| 图组 | 本次结果与边界 |
| --- | --- |
| 首页与returned-title | 当前左右菜单、原版wordmark/壁纸、静音/信箱/壁纸/只看壁纸均可见；没有按钮标题截断、图标空白或层级重叠。returned-title已实际恢复完整首页，不是空栈黑底。与当前index.html及home-polish.css生效结构对应。未测壁纸逐项切换或所有hover状态。 |
| returned-base | 基地公共顶栏、四资源、七导航、事务卡、整备/难度/预设卡完整可见；没有此前camp过场半黑帧。使用源hub.home-v3.js实际operations-v5场景，未把场景资源名称判旧。 |
| returned-slots | 五档完整呈现，05为已建基地档，进入/覆盖/删除/备份区可见，顶左返回按钮未被覆盖。未用该图声称所有导入失败路径通过。 |
| slots-backup | 该图只显前3张，是卡片分批入场中的取证帧。CurrentSlotEntry有.22+.05*i延迟且整体约.86s，Capture未专门等此动画；同批returned-slots已显示稳定五档。不能据这帧认定生产缺失04/05。若主线因已知文案重跑，可只补等待.9s后的静态图，不为此另开构建循环。 |
| slot-archive-export | 档位05导出弹层、来源说明、桌面专用JSON格式、复制/导出/返回完整，输入区和底栏无重叠/截断。背景备份展开区仍可识别，未串入其他档位文案。此图证明呈现，不替代slot隔离/校验/写失败功能probe。 |
| Guide六章 | 六目录、章节序号、当前章指示、左右正文、截图与标号、上一章/下一章边界均可见；正文没有行首孤立标点、整句挤成窄列或末行截断。没有空feature方块。与beginner-guide.js / beginner-guide.css及当前data结构对应。 |
| Guide More3/More4 | 展开后内容可读，More4顶端标题随文章滚动离开是当前滚动位置，不是遗漏；底部控制与分页不盖住最后正文。死亡/放弃抢运呈现已使用实施中的修正文案；safe首脑项仍沿主线已登记处理。 |
| Guide原图与局内指南 | 原图reader显示完整growth图、说明与关闭大图入口；局内指南顶栏未被run HUD压盖，与源CSS隐藏runTopBar要求相符。 |

另外直接逐像素比较当前源六张WebP与Unity CurrentGuide PNG：prepare/growth为1280×720，其余四张1600×900，六张RGBA像素均一致。原图中的旧UI细节来自源指南示例截图，不是Unity在本页调用了那些旧页面；导入没有二次降采样。没有将插图源分辨率当成实时字体清晰度证据。

当前Source JSON与Native Guide数据的差别仅pages[3].notes[1]的title/text、pages[4].notes[2].text这三字段（对应主线先前两项执行规则纠错）；本审未修改或扩写文案。对于后续新增safe修正，以其收据/新包为准。

## 证据指纹与复核边界

- result.json SHA256：`04365227bf527c0d13e8e272880ba68b8ebcc5d2ae8c7d4621c71db309ef7863`
- process.json SHA256：`a0c7f2fc7ec43b1a5ed24fb8e0e3bf5a7d81ad06b7723a8f52ecb3079ce362c4`
- Source直接读取：`game/index.html`、`game/css/home-polish.css`、`game/css/base-framework-v7.css`、`game/css/beginner-guide.css`、`game/src/ui/menu-slots.js`、`game/src/ui/beginner-guide.js`、`game/src/hub/hub.home-v3.js`、`game/data/beginner-guide.json`及其六图；Native读取CurrentSlotEntry/Capture、CurrentBeginnerGuide呈现和当前指南数据。
- 程序输入和静态图能证明的范围分开报告。未执行本审自己的硬件输入、导入/恢复错误注入、全菜单往返或多尺寸检查；未检查分派给另一独审者的商店/战斗/节点/重编/撤离图片。

- `player-title.png` — `67b3c98f23cc81359ece307d41b78ca97c2c09d332ec1deed99f7784a50b2a57`
- `player-slots-backup.png` — `cd63beb4a6d37cd5f83c9e41ca2b8a90e6654e9b0e2b6c8228e26c43eab81aa5`
- `player-returned-base.png` — `e00aed21019637a146f1801f59110a3191ee09d4027b83e0c3e40f4467fa5291`
- `player-returned-slots.png` — `7a3b52ea4c3fe3924e97a731a7c9eef1b5aa3ca444bd574f0392f7b2e3838878`
- `player-returned-title.png` — `27529c5ba122dea5ee5936e2040a10b9fab65060c72bdb91b5fded5b9c03a343`
- `player-slot-archive-export.png` — `30080f951685d64fa0303ff09822dd1ec998672085df40a2cae4a15bf3cbcfe2`
- `player-guide-0.png` — `edf0008af7dced546be2019d7c53ff5fd878281d52f97e76340c1ff4c2098e53`
- `player-guide-1.png` — `45ae2e0a7aa2448e8feab661c9741ae6203e758914d566218f8cb9542a2a108d`
- `player-guide-2.png` — `39d9a46ed51c94c910f3693efea6345dbf338d2ada853d0002ae08594a655df9`
- `player-guide-3.png` — `3574f3b98f7236c27e5e44370719935b3a957726ecc233400967ee16d48a0660`
- `player-guide-4.png` — `d27a3328dcd56893b8da230536bc77b68f6bd767a8b3a75f062df261f748b852`
- `player-guide-5.png` — `c946e5f9dd81ddcb8efb65ac626737f1fb7c41ee4f3d4d87197e09338bba853e`
- `player-guide-more-3.png` — `9217d75ee5380658db849decc6201158e0d953a5737ebe62c1b49cba799abccf`
- `player-guide-more-4.png` — `0eb3f49349bae2fb0f91bdcdb3d643fcaa9092ef4b61e0259c1e0ab6687a4ab6`
- `player-guide-original.png` — `6b2fbb427373af9de941c38d83646a11c02cb7514f1cee20deae5c1d95b62525`
- `player-guide-in-run.png` — `12815c3cfa816f539edfcef37d499782cf88ba99961fdd075e7c16bd031c0dcf`
