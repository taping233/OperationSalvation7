# player-6 独立像素复核

已逐张查看当前16张2560×1440播放器PNG，并查看两张规则区原像素crop；不沿用player-5失败图作当前结论。未启动Unity/CUA或修改生产。

## 已在当前图片关闭

- Guide六章均能进入，章节标题、lead、插图、图注和右侧正文定位完整，player-5图像漂出屏幕与空feature大块已消失。
- 原图阅读能显示当前第六章原图和关闭键；局内Guide图未叠加run HUD。
- 卡规则说明已为右侧滚动条保留宽度，当前native crop未见之前的半字遮挡。
- 启动片头、标题、设置、照片馆当前图未发现新增的大块遮挡。
- 当前密度对照metadata确实区分legacy 1.33333与native 2.0；前次两者相同的证据问题不再存在。GameBoot现有单例守卫，根会话已记录重复Boot/Review修复，本报告不把旧采集竞态当作新图问题。

## 当前仍未闭环

### P2：generic context 与物理共享header重叠

`player-altar.png`、`player-door.png`左上实际可见区域/层文字与返回、静音、头像重叠；同一地点信息在中央header已有完整显示。`CurrentNodeScene.cs:26-27` 的context为x58/y30，header控件y16–74，当前截图确认其几何相交已变成真实可读性错误。

源最终实现必须如实描述：`node-scene-view.js:44`仍为generic输出context；`entry-events.css:157-161` 的“one navigation row”覆盖只隐藏event-themed context，`room-footer.css`说明header overlays rooms。没有证据声称源最终CSS已经隐藏generic context。此处是继承源残留布局与新共享header碰撞，不能把源码某一层数值当成可接受的最终效果。

最小修正建议：在native共享header实际可见时隐藏generic context整个容器，header缺席时保留。区域/层语义继续由源共享header显示；不移动故事/按钮，不更改背景或字号。需要将其记录为对源残留碰撞的最小适配，而不是虚称逐字复制既有CSS。若必须严格保留generic context，另一个选择是将它放到header下方，但源没有给出下移后的坐标，属于更大的布局决定。

### P2：中文折行仍不等价，卡面与Guide均可见

`card-rules-native-actual-pixels.png` 第一行仅“选择 2”，下一行搬入长中文词段。源 `card-layout-selected.css:115-118` 的规则span为white-space:pre-wrap、overflow-wrap:anywhere；不是要把整个中文片段作为不可断词搬行。

同类问题实际出现在Guide：`player-guide-0.png` 第三条正文的“行囊里留些空位”后换行从逗号开始；`player-guide-2.png` 正文有Esc后大段重排、末尾单句号一行；`player-guide-3.png` 在“每个珍珠盒提供 9”后大段断行。所有文字尚可读，但排版质量未达到源浏览器的中文自然折行。Guide CSS未声明卡面那种anywhere，修复时应保留中文禁行首/禁行尾标点，不应把所有字符无条件拆开。

最小修正建议：在展示层对中文自然边界提供软断点，卡规则使用源anywhere能力，Guide使用自然CJK断行；保留原始文案与富文本/icon索引映射，不写死某张卡换行、不改数据文字、不缩字号或扩大卡面。实现后用当前血毒双镖和Guide0/2/3实图验证，另检查长文本滚到底。

## 密度证据的准确结论

`density-comparison.json` 当前有22项样本：内容、逻辑rect、字体设置均保持一致，只有1项line-start序列变化，即血毒双镖规则说明。

- legacy glyphDensity 1.33333337，requested font pixels约14.67；native为2.0、22。
- 规则line-start从 `[0,18,34,48,57,71]` 变为 `[0,5,20,34,48,57,71,85]`。
- 逻辑行top间距从16.5变为18，增加约9%。因此“rect与字体设置不变”不等于文字布局完全不变。
- 原像素crop显示native字形边缘更清晰，改善可确认；native第一行短行和更多滚动内容仍需按上条修复。该JSON的passed本身已明确暴露行差异，不应对外解释为排版完全通过。

## 剩余验证边界

16图证明这些构造页面在当前播放器输出能绘制；真实OS键鼠输入、多步骤奖励业务、叙述/卡规则滚到底尚非本次独立审图覆盖。root的总体自动检查通过与上述两项真实图像缺陷并存，后者修复前不能宣布本轮玩家可见问题全部收官。
