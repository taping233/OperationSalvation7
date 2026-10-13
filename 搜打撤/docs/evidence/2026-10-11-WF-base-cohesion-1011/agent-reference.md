# 基地与交易界面参考决策

状态：只读研究与实施建议。未改源码、未操作游戏浏览器、未起服务、未 build 或提交。新商店参考是否采用，由根会话目检与实现后确认。

核心判断：基地应呈现可经营、可停留的作业空间；商店集中购买与出售；仓库负责保管和找卡。当前角色壁纸、左侧菜单、右下大出征按钮的组合仍接近标题主页。只换背景与增加描边不能解决这层职责混淆。

## 原则与已看实物

本轮重新读取 [NN/g 视觉层级](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/)、[美学与必要信息](https://www.nngroup.com/articles/aesthetic-minimalist-design/)、[渐进披露](https://www.nngroup.com/articles/progressive-disclosure/)、[游戏可用性原则](https://www.nngroup.com/articles/usability-heuristics-applied-video-games/)。落地顺序是职责 → 视觉主次 → 操作反馈；必要信息不能因减字而消失，低频规则和跨任务入口应按需出现。

本轮实际目检本项目已保存的参考图，复核上一轮来源记录，不依靠游戏记忆判断：

| 参考 | 目检所得 | 本轮采用 | 适配取舍 |
| --- | --- | --- | --- |
| [明日方舟设施原图](https://syimg.3dmgame.com/uploadimg/upload/image/20190605/20190605103826_12292.jpg)，本地 `../2026-10-10-WF-base-design-audit-1010/r05-arknights-facility.jpg` | 空间设施在左、所选对象与操作在右；选中对象与详情对应 | 基地用作业空间、房间/设施身份支撑入口；扩建围绕所选设施 | 项目没有生产链，不新增虚假的发电/制造任务，也不照搬密集设施矩阵 |
| [重返未来1999 商店原图](https://files.lemooui.com/picturedata/20220831/1661939316630f2e7489b59.png)，本地 `../2026-10-10-WF-base-design-audit-1010/r04-1999-shop.jpg` | 图像、数量、名称、价格按固定位置成组；分类与商品货架分开 | 独立商店使用固定货格；金额与交易按钮相邻 | 采用物件质感与排版秩序，不照搬棕黑纹理、橙色分区和多货币分类 |
| [星铁库存原图](https://appdata.hungryapp.co.kr/data_file/data_img_m/202510/29/Wh30WAYIWApSDAVUDlIBWQZTWlVVXgZRXQBWWQdUUVZUCVE.jpg)，本地 `../2026-10-10-WF-base-design-audit-1010/r03-hsr-inventory.jpg` | 稳定网格、明确选中、大图与说明相邻；数量贴近物件 | 出售页先选自己拥有的卡，再看收益与数量 | 本游戏卡牌本体重要，保留完整卡面，不把卡牌降成星铁小物品方槽 |
| 当前基地 `../2026-10-10-WF-base-iterate-1010/home-final.jpg` 与补给 `../2026-10-11-WF-base-refine-1011/shop-final.jpg` | 前者人物抢占空间身份；后者商品图、空白与宽按钮占比偏重，交易比较路径长 | 改基地空间叙事；补给转交易货架与详情，减少重复宽按钮 | 这是历史截图比较，根会话须以当前窗口确认最终问题与效果 |

方舟肉鸽参考需要纠正名称：上轮的 [TapTap 仓库图](https://www.taptap.cn/moment/232541594144737749) 是常规仓库，不能作为“肉鸽仓库”证据。已目检的 [水月肉鸽入口](https://note.com/fine_sage503/n/na62348593dff) 可复用主题空间与单一出发任务关系，但其主入口仍不等于交易页。新检索到 [IS6 实际商店原图](https://is-central.github.io/guides/is6-sui/is6-progression/shop-rob-button.png)，出处 [IS Central 进度指南](https://is-central.github.io/is6-sui/is6-progression/)。网页已读取、截图地址已核对并交给根会话；子代理未宣称实际看过该远程图。它可补充肉鸽交易视觉证据，不用其抢夺、投资、货币或生命兑换机制扩展本项目玩法。

## 五条可实施的共同规则

1. **先呈现地点与作业对象。** 基地背景改成地图台、收纳柜、休憩座位组成的室内空间；入口对应明确房间/柜台，配短标签与可见选中。室内图保持手绘大色块、少纹理，功能周围留干净区域。任务面板只承载当前出征准备，取消占画面中心的口号与人物招牌。
2. **共用框架，内容各有职责。** 所有基地子页保持同一返回位置、页名、资源金额与操作底栏；以深蓝灰结构、灰白纸面和一种低饱和暖色建立统一材质。货架、人物展示、收藏图册可以有各自构图，但不再每页换一套按钮、圆角、边框与高光。金币金色仅用于金额身份，不给所有边线镀金。
3. **主次由面积、对比与分组形成。** 每页只保留一个主要交易/培养动作区，页名不做海报大字。物件图、名称、数量、价格紧邻；选择轮廓和主动作最清晰，线条仅分区，删除嵌套框和重复说明。禁用只弱化动作，物件身份与价格仍可读。空白用于分组，不在四商品页留多个空货架。
4. **购买与出售共享商店，保管留在仓库。** 商店只设“购买 / 出售”两种主模式；购买呈现现有商品和持有量，出售呈现玩家库存。所选对象的效果、数量、单价、合计和确认按钮在同一详情区；出售需要明确将消耗哪张牌及收益。仓库保留搜索、分类、详情、收藏/人物培养与容量，在需要交易时跳商店并带选中卡，返回保留原筛选与浏览位置。
5. **状态变化轻，动作反馈完整。** 选中货格、切购买/出售、进入房间共用短淡入与微位移；点击确认后金额/持有数就近更新，必要的缺币/满仓原因只显示一次。重要变化提供结果，低频规则展开查看；不让装饰常驻摆动、不让每次选卡重播整页入场。减少动态偏好下保持完整静态反馈。

以上是本项目实施选择；具体配色值、画面比例与时长并非参考游戏的测量值。根会话需用当前内置窗口检查：入口可识别、视觉不抢任务、同页不过载、完整卡面、金额可读、返回保留上下文，以及购买/出售的原命令和确认语义。

## 追加：老板否决主视觉后的场景原图研究

新约束覆盖前述基地构图建议：故事约在100年以后；基地是冬季城市外驻扎营地；积雪只在室外，室内用现代壁炉；禁止无意义旗帜、徽记、符号。保留原A的左侧大近景椅子与纵深，室内物品重排清减。前述人物壁纸、徽章和传统指挥所方案不作为继续生图依据。

以下为真实商业二游图源候选。检索获得图像预览描述，网页读取核对出处，HTTP HEAD 核对图片地址；子代理受派工边界限制不操作浏览器，工具没有向本子代理返回图片像素，因此不将预览描述写成已目检结论。根会话应直接打开图片后采用或舍弃，不用这些文字冒充实机。

| 候选直图与出处 | 检索预览的具体物件 | 对本次构图的候选用途 |
| --- | --- | --- |
| [明日方舟罗德岛休憩室背景直图](https://cc-img.townimg.com/uploads/2024/05/20240516125857291.jpg)；[转载CG图册](https://dimtown.com/108974.html) | 灰色沙发、金属低桌、百叶窗、少量补给箱、冷灰墙面 | 现代驻扎室的家具类型与低饱和配色；清减箱子与医疗瓶，仅保留两组生活/作业物件。转载图册不是原始发布；若实际图像不能确认官方背景身份，舍弃 |
| [少女前线《静止点》剧情CG直图](https://assets.st-note.com/production/uploads/images/109070130/rectangle_large_type_2_0ab18111658c7669ac7ec86285a6d79b.png?width=1280)；[2023-06-24剧情感想出处](https://note.com/texastype/n/n7cacfab50220) | 多人围低矮地图台、背后有限监控屏、工业墙面、文件与箱具 | 现代临时作业空间所用物件；只参考桌台与设备，人物不迁入主视觉，去掉密集屏幕与杂物 |
| [明日方舟官方2022室内家具场景直图](https://web.hycdn.cn/arknights/special/thankyou-2022/01.53daf58a.jpg)；[鹰角官方专题页](https://ak.hypergryph.com/special/thankyou-celebration-2022/index-bd.html) | 扶手椅、低桌、有限顶灯和落地灯、低柜、可走动空地 | 扶手椅与低桌成组摆放、物件尺度与留空关系；不迁移复古电视、图案地毯、暖棕/红满屏风格。该图是官方家具场景宣传，不冒称剧情背景 |

另有可核对原始出处的方舟官方背景备选：[日服官方fankit](https://www.arknights.jp/fankit)公开API `/api/resource/gallery/list?index=1&size=100` 返回2020年「バーチャル背景①〜④」四图；[2020-04-09配布报道](https://game.watch.impress.co.jp/docs/news/1246192.html)嵌有官方发布，明确是游戏内罗德岛/龙门背景。可按编号直接打开： [①](https://webusstatic.yo-star.com/ark_jp_web/assets/158641056122110370/01.jpg)、[②](https://webusstatic.yo-star.com/ark_jp_web/assets/158641070846417241/01.jpg)、[③](https://webusstatic.yo-star.com/ark_jp_web/assets/158641077292516862/01.jpg)、[④](https://webusstatic.yo-star.com/ark_jp_web/assets/158641080754314094/01.jpg)。API只提供编号，根目检前不凭编号编造哪张是休息室或走廊。

未把商业素材下载或复制进运行库。搜到的少前 Ruilur/平PING 等同人壁纸、VRChat仿作及方舟同人休息室均未纳入真实游戏图证据；1999复古书房暂不列优先图，避免新约束下重新滑向旧时代室内。

## 追加：真实官方壁纸与场景来源核实

本次仅研究，未生成图片。官方原图优先于上述转载图册和少前一代社区截图。根会话负责实际打开、截图及挑选；本子代理不根据搜索预览编造已看的物件清单。

### 方舟官方四背景，完整入口

- 官方展示页：<https://www.arknights.jp/fankit>。
- 官方公开列表：<https://www.arknights.jp/api/resource/gallery/list?index=1&size=100>。返回 `id:1390/title:バーチャル背景①`、`1391/②`、`1393/③`、`1392/④`；这些是本轮读取到的元数据。
- 原始官方发布：<https://twitter.com/ArknightsStaff/status/1248098331068252161>；[2020-04-09报道](https://game.watch.impress.co.jp/docs/news/1246192.html)嵌入官方发布，明确称其为游戏内罗德岛和龙门背景。
- ①：<https://webusstatic.yo-star.com/ark_jp_web/assets/158641056122110370/01.jpg>
- ②：<https://webusstatic.yo-star.com/ark_jp_web/assets/158641070846417241/01.jpg>
- ③：<https://webusstatic.yo-star.com/ark_jp_web/assets/158641077292516862/01.jpg>
- ④：<https://webusstatic.yo-star.com/ark_jp_web/assets/158641080754314094/01.jpg>

根会话查看后应优先留下实际室内图，按可见物件记录。编号不是房间名；不能由API标题推断「①一定是休憩室」。

### 少前2发行商实际截图（已排除本次室内参考）

[Steam发行商页面](https://store.steampowered.com/app/3308670/GIRLS_FRONTLINE_2_EXILIUM/)与[公开截图API](https://store.steampowered.com/api/appdetails?appids=3308670&l=english)可核对来源。API返回5张实际发行商截图。根已实际查看：①是舰炮，⑤是战斗；两张均排除室内参考，其余未列入采用范围。保留地址只为说明筛选过程，不能当Elmo室内证据。

1. <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3308670/ss_25ca57904c8aabd88cc8ee36a108c3352048c0c3.1920x1080.jpg>
2. <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3308670/ss_c9d6693d4bd09e2a893ecbb98b7bdc68e6f948b9.1920x1080.jpg>
3. <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3308670/ss_14e85907196e983d8d57bd8ea6f9df54d59b2f33.1920x1080.jpg>
4. <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3308670/ss_05147570b512027420b13b417ad73abab6173407.1920x1080.jpg>
5. <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3308670/ss_65659f8c4d26ad157591673722d935dd7e0890ee.1920x1080.jpg>

官方世界观页面确认艾莫号包括指挥、整备、仓储和休息空间：[中文官网](https://gf2.sunborngame.com/main/ar)。此事实只证明用途，不能替代室内图片证据。

### 少前2官方壁纸发布

[发布页](https://gf2.sunborngame.com/NewsInfo?id=1843&typeId=1)的[公开API](https://gf2-web-preregister-api.sunborngame.com/website/news/1843)本轮返回「【壁纸】现在为指挥官带来『忒弥斯棋局』版本壁纸」，日期2026-05-25，正文图片由官方CDN提供。它可证明这组图是官方壁纸；具体哪张是室内，仍交根实际筛选，室外图和角色海报不进入室内布置依据。

1. <https://gf2-cn.cdn.sunborngame.com/website/platform/1779681213946.jpeg>
2. <https://gf2-cn.cdn.sunborngame.com/website/platform/1779681222338.jpeg>
3. <https://gf2-cn.cdn.sunborngame.com/website/platform/1779681228589.jpeg>
4. <https://gf2-cn.cdn.sunborngame.com/website/platform/1779681234714.jpeg>
5. <https://gf2-cn.cdn.sunborngame.com/website/platform/1779681240774.jpeg>
6. <https://gf2-cn.cdn.sunborngame.com/website/platform/1779681247485.jpeg>

### 给根的物件与分组记录口径

对最终选中的2—3张实际室内图，各列5—8件看得到、能够说明用途或比例的物件，再分为前景、中景、后景；角色、UI、商标、旗帜和徽章不计入必要室内物件。未知用途就保留「桌上小盒」一类视觉名称，不编造设备功能。

依老板已定构图，本项目待比较的8件物件为：左侧大近景现代扶手椅、邻近低桌、杯子或一台闭合平板（二选一）、后景现代嵌入式壁炉、右后方小型作业桌、单台终端、封闭收纳柜、外景窗。空间分为左近景休憩组、右中后景作业组、背面采光/取暖组；中央地面保持通道。这里是项目布置清单，未声称所有参考图都同时出现这8件。再画储物箱、盆栽、地毯、武器、书本前，应由真实参考和场景用途确认；冬季差异限于窗外积雪与现代壁炉，不把室内改成森林棚或复古军营。

### 已获根会话截图后的实际目检补录

以上图源待目检状态在本段更新：子代理通过 `view_image` 查看根会话已保存的 `reference-official-bg-01.jpg`、`reference-official-bg-02.jpg` 和 `reference-arknights-office.jpg`，读取实际像素。没有访问游戏浏览器。①为龙门风格办公室，②为现代控制空间，不能把①称罗德岛休憩室。

| 实际图片 | 5—8件可见物件与空间分组 | 能借什么、该减什么 |
| --- | --- | --- |
| [官方背景①](https://webusstatic.yo-star.com/ark_jp_web/assets/158641056122110370/01.jpg)；证据 `reference-official-bg-01.jpg` | 8件：宽桌、平面显示器、键鼠、主机、文件夹、笔筒、长沙发、城市玻璃窗。近景为桌/设备/文具；中景为沙发和两侧小灯；远景为城市窗和装饰墙 | 借前大、中小、远窗的明确纵深和生活/作业两组。不可借龙纹、天花雕饰、红锦桌面、满屏橙光；这些与老板新约束冲突。该图用于构图比较，不能直接当本项目风格目标 |
| [官方背景②](https://webusstatic.yo-star.com/ark_jp_web/assets/158641070846417241/01.jpg)；证据 `reference-official-bg-02.jpg` | 8件：倾斜结构梁、分层平台、金属栏杆、斜面操作台、成组小屏、设备柜、橙色电缆、大面积外景窗。近景为平台边缘和结构；中景为操作台/挂屏；远景为窗与设备柜 | 借冷灰块面、少数暖色和屏幕亮度形成的层次；各设备都依附结构摆放。项目是驻扎休憩空间，去掉重工业平台和密集挂屏，仅保留单终端与小型信息面，空地留作通道 |
| 人事办公室；证据 `reference-arknights-office.jpg`，原图 [GameWith](https://img.gamewith.net/img/60d5c8b2ce713f59736320c839769df9.jpg) | 6类：两张会客椅、一低桌、杯子、文件柜、留言板、长条顶灯。中部为会客组，左侧为收纳组，右后为信息组；墙面标志不是必要物件 | 只借6类物件已说明用途的减法；不借巨大商标，不借小型正面平房构图。它是基建设施图，不冒称完整剧情背景 |

这两张官方背景的画法都是有体积的游戏环境原画；①暖而繁复，②冷而偏工程。新基地保留左近景大椅后，应让后方桌柜缩小退远；只有室外雪和壁炉改变冬季氛围，不能把冷灰工业空间、复古橙色办公室、青绿森林棚同时拼入同一室内。少前2发行商图①/⑤已排除室内参考；最终采用比较的是下段实际游戏背景，官方版本壁纸未列入采用范围。

### 少前2真实室内背景：已目检，Wiki归档来源

根随后查到并实际查看下列三张游戏原背景。子代理本轮读 [IOP Wiki Elmo图库](https://iopwiki.com/wiki/Elmo)和对应文件页复核归档属性：文件用于Elmo页面，分类标为 `GFL2 Background Images`。这是游戏原背景的Wiki归档，不称官方壁纸发稿，也不称Wiki拥有商业素材许可。

| 地点 | 游戏原背景直图 | 对应文件页与核对状态 |
| --- | --- | --- |
| 指挥室 | <https://iopwiki.com/images/a/a7/BG_None_Carriage_03_01.png> | [File:BG_None_Carriage_03_01.png](https://iopwiki.com/wiki/File:BG_None_Carriage_03_01.png)；根已核对。子代理网页工具未成功打开该文件页，Elmo正文图库收录指挥室 |
| 公共休息室 | <https://iopwiki.com/images/8/8c/BG_None_Lounge_01.png> | [File:BG_None_Lounge_01.png](https://iopwiki.com/wiki/File:BG_None_Lounge_01.png)；子代理已读取：2048×1024、2025-06-01归档、分类GFL2 Background Images、用于Elmo |
| 个人房间 | <https://iopwiki.com/images/3/3d/BG_None_PersonalLounge_01.png> | [File:BG_None_PersonalLounge_01.png](https://iopwiki.com/wiki/File:BG_None_PersonalLounge_01.png)；子代理已读取：2048×1024、2025-06-01归档、分类GFL2 Background Images、用于Elmo |

根与子代理均已实际目检三图：子代理用 `view_image` 读取根保存的 `reference-gfl2-command.jpg`、`reference-gfl2-lounge.jpg`、`reference-gfl2-personal.jpg`。个人房间左侧沙发与低桌成组；后方床和收纳是生活区；右侧办公桌、配套大椅和终端是作业区；窗外为白淡形。它比纯控制室更适合本项目的工作/生活分区。

| 已目检原背景 | 8件可见核心物件 | 真实空间分组及项目取舍 |
| --- | --- | --- |
| [个人房间](https://iopwiki.com/images/3/3d/BG_None_PersonalLounge_01.png)，`reference-gfl2-personal.jpg` | 沙发、低茶几、床、办公桌、带扶手工作椅、终端屏、封闭收纳柜、窗 | 左近景休憩组；后方床/收纳生活组；右侧工作组。窗光让近景轮廓变暗、后方变亮，体积和远近明确。优先采用这种真实工作/生活分区；项目已定大椅放左近景时，桌柜按纵深缩小。参考中的书堆、箱子、裸露顶棚设备不必全部画进来，床也不直接代表本项目必须增加卧室 |
| [公共休息室](https://iopwiki.com/images/8/8c/BG_None_Lounge_01.png)，`reference-gfl2-lounge.jpg` | 两组前景长桌、搬运箱、左墙信息屏、后侧沙发、分层台阶、咖啡机、茶水台/水槽、吧台高脚椅 | 前景是临时工作和物资组；后侧是坐席休憩组；右后是饮水补给组；中间通道连接各组。借用途分区与有限茶水物件；前景布桌和箱具太多，不照搬为主视觉，收纳集中到一个柜台或两箱，去掉大幅墙面符号 |
| [指挥室](https://iopwiki.com/images/a/a7/BG_None_Carriage_03_01.png)，`reference-gfl2-command.jpg` | 大幅窗、围窗控制台、斜面屏幕、独立细长终端、工作椅、平台/台阶、栏杆、硬质设备箱 | 前景台阶和箱具做遮挡；中景细长终端；后方控制台沿窗展开。窗与地面受光强化空间深度，台阶/栏杆说明路线。作为作业空间辅助参照，只留小终端与清楚通道；营地休憩页不移植舰桥全窗、密集设备箱和多层平台 |

三图的共同可见特征是灰绿/灰蓝大面、少数黄橙部件、深色近景遮挡、干净窗光；未来感主要来自结构和可用设备。它们含有工程编号、标志和大量顶部细节，本项目不借这些符号，仅借尺度、使用关系和分区。现代壁炉与窗外雪来自老板的项目约束，不能声称少前2个人房间本身已经有壁炉或积雪。

方舟四背景的根目检分类补齐：①龙门办公室、②控制空间、③走廊、④暗色办公/实验空间。室内布置优先比较少前2个人房间与公共休息室；方舟②提供块面空间/设备的辅助画法。当前停止生成图片，只研究和列布置依据。
