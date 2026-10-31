# Unity UI 独立审查（2026-10-30）

本记录保留 visual-2、visual-3 两轮独立审查。未读取历史通过报告，未启动 Unity、编译或操作前台。最新结论：**visual-3 收敛明显，本轮尚未全通过；后续修复待下一轮新图和输入证据。**

## 第二轮结论（visual-3，冻结）

逐图查看 `搜打撤/docs/evidence/2026-10-29-unity-desktop/visual-3/` 的 title、hub、preparation、library、cards-and-icons、icons-updated、map 共7张新图，并核对同轮 `frames.json`。

- 新图确认收敛：卡框与纸面同宽、矩形露边消失；地图“外围入口”“1层·战斗”“你”完整，未再见断裂；正文清晰；基地关闭按钮恢复36×36、庭院页签位于x1672..1898；照相馆筛选/类型/分页按钮为42px高、首行首列卡面完整；整备导航不再吞占正文。
- 独立核对新字体：Harmony Regular、Bold、许可证与现行 Vite 文件逐一SHA256一致；TTF OS/2 字重分别400、700，均非变量字体。Current Art 的769份PNG导入meta全部为 `nPOTScale:0`。以上与本轮卡框和字体画面一致。
- visual-3仍见：标题页右上档案文本互叠（档案行仍为默认100×100）；基地左上只有帮助问号、未建页面标题；成就与收藏室误用同一收藏室图标；卡价金币仍按普通内联图标缩小、缺现行源样式的暗底。已逐项交主会；主会随后通知已修改其中档案区、成就图标及卡价标，尚无新图供本轮独立验证。
- battle未在本轮完成生成，因此不能用visual-3宣称战斗HUD修复通过。背包/更长标题样本、真实命中、关闭后异步回调及PageIn运行布局仍须下一轮证据。离屏Capture会重建布局，静态图不能替代运行中的布局与输入验证。

## 第一轮问题定位（visual-2，历史基线）

| 问题 | 复现/当前证据 | 定位与影响 |
| --- | --- | --- |
| 基地关闭按钮被布局压成零高 | `hub.png` 没有关闭入口；同轮 `frames.json` 的 `✕` 为 `1920×0`，y=1080 | `HubScreen.cs:48–54` 的纵布局接管了 `SlotPickerScreen.cs:245–260` 的绝对定位按钮。不能点击关闭返回标题。 |
| 基地最小宽度越出当前画面 | 庭院按钮 x=1730..1964；出发/整备按钮 x=940.5..1948；底部门条 x=22..1964 | `HubScreen.cs:107–114` 关闭子尺寸控制，但两个 Text 各保持默认100宽，导致每页签234宽、116高，最小宽度传至整页。当前1920宽就有裁切。 |
| 基地页头纯白 | `hub.png` 上方54px为纯白 | `HubScreen.cs:58` 新建 Image 后没有赋色。与现行暗色页头不符，浅色文字对比受损。 |
| 庭院页签变成问号 | `hub.png` 庭院前为问号；表中使用 `leaf` | `HubScreen.cs:92` 与 `CurrentUiIcons.Paths` 不符，`InlineIconParser.cs:87` 必然回退 question。 |
| 照相馆三行控件过高、卡面首行首列裁切 | `library.png`；筛选、类型、分页按钮实高各205px；第一行只剩卡下半，第一列只剩右半 | `CardLibraryScreen.cs:103、130、158` 的横布局保留默认高度扩展；`:219–222` 的 cardwrap 未给真实卡槽尺寸，被父布局压缩。可读卡面区域显著减少。 |
| 整备导航吞占内容区 | `preparation.png`；“猛攻”按钮实高336.5px | `PreparationScreen.cs:38–39` 横布局保留默认高度扩展。三个导航按钮挤走大量可滚动正文。 |
| 战斗HUD超出屏幕 | `battle.png`；撤退 x=1854..1954、结束回合 x=1838..1954；能量球左侧/内容也裁切 | `BattleScreen.cs:386、419、438` 设拉伸锚点后未清默认offset；`BattleWidgets.cs:168` 只设minHeight，White Sprite的Image首选高度仍令按钮实高100px。操作文字与命中区域部分在屏外。 |
| 卡框与面板比例不一致 | `cards-and-icons.png`、`icons-updated.png`：纸面/插图矩形明显露出卡框两侧 | 源框为512×768，`CardVisual`亦按该尺寸定义开口；框贴图 `.meta:43` 的 `nPOTScale:1` 与 `CardFace.cs:45` 的preserveAspect组合存在导入尺寸变化嫌疑。露边已由画面证实，导入后尺寸仍需当前Unity记录确认。 |
| 地图标签字形断裂 | `map.png` 中“外围入口”“1层·战斗”可见缺笔，索引不可清晰阅读 | 同轮 `map-fonts.json` 只证明字符存在、几何高度达标；不能证明纹理输出。`BoardView.cs:595–599` 的字体与材质链需进一步定位。 |
| Regular/Bold字体资源实际为相同Thin默认实例 | 独立读取两个TTF：SHA256同为 `A3041811A78C361B1DE50F953C805E0244951C21C5BD412F7232EF0D899AF0DA`；OS/2 weight=100，fvar wght默认=100（100..900） | `Assets/Resources/Fonts/NotoSansSC-Regular.ttf`、`NotoSansSC-Bold.ttf` 未提供对应400/700静态字重。新图正文普遍细淡；需用当前变量源正确实例化后核对实际原生渲染。 |

## 第一轮真实覆盖与缺口

- 已逐图检查 title、hub、preparation、library、cards-and-icons、icons-updated、map、battle，共8张当前1920×1080原生离屏PNG，并核对同轮按钮bounds。动态更新样本的图标随文字移位、换行，未见字形方框；禁用按钮图标有相应透明度变化。
- 已读 InlineIconParser/Text、UIKit、Res、CurrentUiIcons、CardFace/Visual、HandPanel，及上述界面相关实现。CurrentAssets、CurrentThumbnails、CurrentUiIcons 中全部 Art/Audio 目标文件均存在；该检查不等于加载后比例与效果正确。
- 空安全格落点、标题入口文字区命中、背包关闭后延迟弹详情、照相馆搜索聚焦已交主会后台探针验证，本报告尚未据此宣称交互通过或失败。
- 本轮没有背包、各基地子页、放大卡面/长描述滚动的最新PNG；未验证真实前台输入，也未请求多尺寸。以上缺口不能由旧结论替代。

生产代码保持只读；问题已实时交主会修正。本记录于第二轮结束冻结，后续另开新轮证据，不能把代码已改或图片生成成功视为效果通过。
