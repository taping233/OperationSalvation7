# FB035／FB036：容量去框与战斗二级玻璃

源码批次完成、未提交；实页未验。

## 用户原文与定位

来源：2026-10-18T16:11:06.012Z 导出的44条反馈，第35条背包 bag-count-summary「这里不要给底框」；第36条发现 battle-decision-head「发现界面还是太难看了，可以干脆改成透明玻璃底」。FB035是背包容量块，不是战斗容量或奖励容量块。

- 容量底框来自 expedition-inventory.css 的 bag-capchip 背景、描边、blur和胶囊padding；bag-design-system.css还把它并入通用描边规则。源定义去框，移除通用描边接入，保留flex布局、数量、容量条和文字。
- 战斗浮动工作区原来以 feedback-panel 的94%不透明底叠加 choice、inspect、infusion 三类实底；legacy发现外壳另有76%底。二者现在从 scoped secondary-ui-tokens 取同一玻璃材质。
- 内部选择/详情/注能区域去实底；选项去额外阴影，hover保留轻强调；主确认按钮保持不透明对比，危险说明/可用状态未改。手牌详情复用同一外层材质。
- 模糊仅放实际内容面板；全屏shield与card仍透明并清除blur。未添加动画或修改卡牌尺寸、JS、交互、存档。
- 保留 expedition-inventory.css 已有侧栏及返回按钮改动，与前一轮 tokens/背包规范改动。

## 验证

一次单worker集中执行：secondary-glass-style、battle-secondary-overlay、bag-ui-language、pearl-storage-interface、backpack-rail-alignment，5文件38项通过，见 tests.log。新增5项结构契约覆盖材质来源、导入、外层/内层玻璃边界、容量去框、主动作及hover留存。新测试eslint与自有diff检查通过。

这些是CSS结构及jsdom行为证据；不是浏览器计算样式、对比度或审美验收。半透明数值不是视觉完成标准。未运行全量测试/build，未启动服务或替代浏览器，未提交推送。

## 仍待当前窗口内置浏览器

1. 明暗不同战场打开发现，确认仍能看见场景、标题/描述/卡牌可读。
2. 选择、牌堆详情、注能和手牌详情：滚动、焦点、hover、禁用提示、危险确认与返回。
3. 背包容量计数和扩展容量长文案，确认去框后不挤压标题、进度条和换行正常。
4. 验证真实级联与玻璃性能；若需调材质只改共享token，不分页面重叠补丁。
