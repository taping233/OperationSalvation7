# 游戏 UI、排版与动效原则研究（2026-10-10）

上一版改造未达到老板的美感目标。本轮先形成设计依据，不继续改游戏源码。以下分为来源中的原则、对现页的判断和下一轮候选；候选尚未定稿，不写成项目长期规范。

## 材料与阅读用途

| 材料 | 类型与读取范围 | 主要用途 |
| --- | --- | --- |
| [Riot：User Interface Design](https://www.riotgames.com/en/artedu/user-interface-design) | 游戏团队官方课程；已读公开说明，未完整观看视频 | 区分体验流程与界面表现：信息在玩家需要时出现，设计由受众和任务出发 |
| [GDC 2025：从Persona到Metaphor，建立新系列的视觉身份](https://gdcvault.com/play/1035332/From-Persona-to-Metaphor-ReFantazio) | Atlus主界面设计师Koji Ise；已读公开介绍，未完整观看演讲 | 游戏UI的题材表达、开发迭代和独立风格建立；不能将介绍当成演讲全部结论 |
| [GDC：Art Direction—Graphic Design is Key](https://www.gdcvault.com/play/1023276/Art-Direction-Graphic-Design-is) | Ubisoft Montreal的Liam Wong；已读公开介绍 | 字体、图形、图标、色彩和动态共同构成游戏的视觉身份 |
| [NN/G：视觉设计五原则](https://www.nngroup.com/articles/principles-visual-design/) | 已读文章 | 比例、层级、平衡、对比、视觉分组；解释构图为什么吸引人或显得杂乱 |
| [Carbon：网格与布局](https://www.carbondesignsystem.com/building-blocks/foundations/2x-grid/guidelines)、[间距](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview) | 已读布局正文和间距资料 | 从内容目的选择结构，保持关键对齐线，用疏密表达关联；借鉴方法，不套用IBM外观 |
| [Carbon：Typography](https://www.carbondesignsystem.com/building-blocks/foundations/typography/overview) | 已读正文 | 按文字职责组合字号、字重、行距，区分展示性文字与高频阅读文字 |
| [Carbon：Motion](https://www.carbondesignsystem.com/building-blocks/foundations/motion/overview)、[Choreography](https://www.carbondesignsystem.com/building-blocks/foundations/motion/choreography) | 已读正文 | 高频反馈与表现性动作的分工、缓动、动态时长、同语义动作一致和整体编排 |
| [Material：动效编排](https://m1.material.io/motion/choreography.html) | 已读经典版本正文 | 用共同元素维持视线焦点，显示来源与去向；版本中的具体数值不作为游戏统一标准 |
| [Xbox XAG 102：对比度](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/102)、[XAG 117：动态干扰](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117) | 已读公开指南相关章节 | 文字/图形可读性的边界，以及阅读界面中动态内容的控制方式 |

## UI如何设计

先写清玩家在此页的主要目的，再建立信息出现的顺序。Riot的课程说明将“需要时取得所需信息”作为UI与UX合作的重点。照相馆同时能检索规则和欣赏原画，下一轮应明确首屏更侧重哪一种体验。[来源](https://www.riotgames.com/en/artedu/user-interface-design)

视觉主题需要覆盖字体、形状、图标、光影和动作。GDC的Liam Wong演讲介绍将这些要素作为游戏视觉身份的组成部分。因此，“照相馆”应有一组能约束选择的设计词，例如定格、取放、翻阅，再把它们对应到真实控件和照片行为；仅换背景颜色无法完成这项工作。设计词是本轮候选。[来源](https://www.gdcvault.com/play/1023276/Art-Direction-Graphic-Design-is)

对照相馆的候选阅读顺序：照片 → 名称与身份 → 当前操作 → 检索与统计。每个控件应有清楚的行为暗示，选中、悬停、键盘焦点、稀有度分别表达。让反复浏览的基础动作稳定，把收藏的满足感集中到当前对象。

## 页面如何排版

大小、明暗、位置和留白共同建立阅读顺序；平衡不要求对称。同样大的格子可以提供稳定秩序，但所有区域都同样显眼时，玩家难以判断重点。关联内容靠近，无关区域拉开，减少靠框线反复切割的需要。[NN/G](https://www.nngroup.com/articles/principles-visual-design/)

网格应先服务内容和玩家目标，再确定列数与比例。保持照片、名称和控件的关键对齐；用重复形成秩序，用适量的尺度变化与留白形成节奏。Carbon指出，过多重复且缺少留白会产生单调；同一尺度展示全部内容也会削弱层级。[Carbon布局](https://www.carbondesignsystem.com/building-blocks/foundations/2x-grid/guidelines)

字体按职责选择。馆名承担身份，照片名承担识别，规则正文承担阅读，标签与编号承担辅助。标题可以有表现力，正文保持稳定的字号、字重和行距；不能用多种字体或把全部内容加粗来制造层级。这里借鉴Carbon的角色分工，不引入其字体依赖。[Carbon字体](https://www.carbondesignsystem.com/building-blocks/foundations/typography/overview)

明度层级不能以牺牲正文辨识为代价。Xbox对普通重要文字给出4.5:1的对比目标，较大文字/元素为3:1，具体适用尺寸随平台不同。此项是可读性检查，达到数值仍需判断构图与风格。[XAG 102](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/102)

## 动效如何设计

Carbon区分高频、克制的操作反馈与少量重要时刻的表现性动作；动作时长随距离和面积变化，相关动作共享语义。下一轮先确定动作解决什么问题，再选择移动、缩放、淡入或形变。[Motion](https://www.carbondesignsystem.com/building-blocks/foundations/motion/overview)

放大一张照片时，让来源照片保持可追踪，信息随后进入；收回时回到合理来源。不同元素同时出现时安排先后，避免所有面板各自飞入、同时争夺视线。Material强调共同元素维持焦点；Carbon也要求空间关系与动作含义一致。[Material编排](https://m1.material.io/motion/choreography.html)、[Carbon编排](https://www.carbondesignsystem.com/building-blocks/foundations/motion/choreography)

以下是本轮原型的建议起点，不是已验证参数，也不是来源中的游戏通用标准：

| 动作 | 要表达的意思 | 原型起点 | 阅读与操作要求 |
| --- | --- | --- | --- |
| 按下/悬停 | 对象可以操作，输入已收到 | 约80–140ms、小幅变化 | 立即响应，不影响格子位置 |
| 筛选/局部切换 | 当前内容集已改变 | 约150–250ms | 条件与结果先明确，控件保持可用 |
| 取片/放大 | 同一照片靠近观看者 | 约250–400ms | 主对象连续，进退有来源 |
| 入馆 | 建立整个收藏空间 | 约300–500ms的整体编排 | 总时长计算错峰延迟，不拖慢每次浏览 |
| 趣味动作 | 一次有性格的回应 | 由具体动作原型确定 | 围绕照片或夹子，不打断读字和选片 |

持续运动放在阅读区时要允许控制；关掉动态后信息仍完整。Xbox XAG117为与文本并存的移动、闪烁和自动更新内容提出暂停、隐藏或关闭方式。[来源](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117)

## 对上一版照相馆的判断

以下为基于[上一版截图](after.png)的设计判断，不是外部材料直接给出的结论：

1. **主构图变化不足。**顶部大面积筛选面板、等大照片墙与常驻详情栏仍维持原结构；配色变化没有重新安排第一眼的重点。
2. **工具面权重偏高。**明亮检索面板占据整条顶部，读图前先遇到一整排字段。如果主要目标是赏图，检索宜成为紧凑的辅助层。
3. **陈列节奏单一。**同尺寸、同底纸和同等级首组连续重复，缺少大与小、密与疏的变化；新增阴影不足以改变整体感受。
4. **选片台利用率偏低。**同图同时在网格和右侧重复出现，右侧下半留出大量空白；可以研究让选中照片承担更强主视觉，或按浏览状态收放信息。
5. **趣味动作与题材联系还弱。**相片依次抬起能被看见，但没有形成取片、夹子轻弹、翻到背签等更有含义的动作体验。具体候选须先看原型再判断。

## 下一轮设计顺序与评价

1. 用现有真实照片做低细节构图稿，先比较阅读顺序、照片面积、检索密度和选片空间。
2. 选一条普通与一条特殊等级照片的浏览—选片—放大—返回链，统一纸边、夹子、光向、文字和动作语言。
3. 静态构图成立后制作短动效原型，分别检查首次进入与连续浏览。
4. 用老板的审美反馈判断美术是否成立；用操作、可读性与性能证据判断是否能交付。此前测试不能代替这一判断。

本轮完成的是资料核实、原则提炼与问题诊断。美术重设计和新动效原型尚未实施；未安装素材/字体/工具，未提交或发布。
