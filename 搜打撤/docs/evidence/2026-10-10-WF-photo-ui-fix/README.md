# 照相馆美术与动效修复

审查中的四项按老板授权范围完成：棱彩标签恢复实色文字；分类与选片使用220ms淡入/上移且可连续重播；装裱复用现有等级框的形体和厚度，选中另用金色轮廓与“选中”标记；四张禁咒定向重画为确认的块面厚涂，保留人物、服装、手势与原构图。没有重画已确认卡图。

## 当前行为

- 稀有度标签只承载清楚的文字，棱彩侧栏标签不再用透明文字叠整块渐变；标题与卡名原有颜色保留。
- 分类/筛选更新只给照片墙容器重播一次过渡，选片变化只给选片台重播一次。沿用窗口化、缩略图与原图延迟升级，不给所有照片追加逐张动画；减少动态效果规则关闭新增动画。
- 列表、选片台和大图共用既有photoMountFor映射与等级框素材。普通与传说实测使用不同装裱素材和边宽；职业/衍生保持分类语义，没有修改卡牌等级。
- 首次窗口化挂载后换选会清除旧选中态。修复了首次“下一片”可能留下两个选中标记的缺口；清态通过既有ID节点Map完成，不增加全网格扫描。

## 素材

四张禁咒I–IV各调用一次内置image_gen。完整提示词、编辑目标、画法参考与生成源见[request.json](request.json)，正式WebP、448px缩略图、原稿与旧图备份SHA256见[receipt.json](receipt.json)。导入使用既有game-card-art-fast脚本；art-mapping仅新增四卡revision，素材清单只改对应8条，其他记录保留。

当前运行路径：game/assets/cards/curse-{drain,freeze,venom,silence}.webp和game/assets/thumbs/cards/curse-{drain,freeze,venom,silence}.webp。原稿/备份位于.tmp/imagegen/2026-10-10-WF-photo-ui-fix/，不进Git。

## 验证

- 6文件71/71通过：[targeted-tests.log](targeted-tests.log)。包括boot、photo-zoom-lifecycle、photo-studio-presentation、card-library-performance-contract、contracts、architecture-boundaries；boot补了首次换选只有一个选中对象的回归断言，jsdom局部模拟滚动API。
- 本轮8个素材登记检查零问题：[own-assets.json](own-assets.json)。未引用全库素材审计通过。
- Codex内置浏览器当前1280×720，无viewport覆盖；真实点击类型筛选、连续换选、稀有度筛选、大图与Esc收回，未编辑备注。事实见[browser-facts.json](browser-facts.json)。
- 分类动画实际读取studio-panel-in-a/b与0.22s，选片动画可重播；四张新缩略图naturalWidth=448，禁咒I大图升级到1254像素新原图。返回后仅禁咒I选中，焦点回到对应照片。
- 增加的样式位于实际导入的photo-studio-unified.css。旧photo-studio-cover.css当前入口未加载，本轮不接入其整份主题。
- 当前首屏20张图片，保留既有挂载策略；没有帧率或滚动性能基线，因此不作性能提升/无回退结论。减少动态效果只核对源码规则，未修改老板设置。
- 未build、未全量、未提交；复用5200，未创建服务。

[最终照片墙](final-overview.png) · [新卡大图](final-zoom.png)

