# 云端背包布局修复

## 结论

背包原来没有填满游戏画幅：固定 1920×1080 的游戏已经由 html 的 zoom 等比缩放，背包壳却又取浏览器显示尺寸 100vw×100vh。1188×761 窗口下，游戏实际画幅为 1188×668.25，背包则再次乘以 0.61875，缩到左上角约 735×471。

另外，背包详情只声明了 inventory presentation，漏接基地仓库已经使用的 decorateInventoryZoom。结果没有全文规则资料栏，动作页脚直接成为双列网格的第二项。

## 已核实依据

- 修复前截图：[背包](../2026-10-16-WF-cloud-play-eight-hours/screenshots/20-backpack-before.png)、[详情](../2026-10-16-WF-cloud-play-eight-hours/screenshots/21-inventory-detail-before.png)
- 父任务当前窗口只读测量：viewport 与 overlay 均为布局 1920×1080 / 显示 1188×668.25；ovBody 却为布局约 1188×761 / 显示 735.06×470.86，局部 zoom 为 1、transform 为 none
- 详情本身显示 1188×668.25，但子节点缺少 inventory-zoom-info；只有 backdrop、flash、close、card、note、foot、hint
- v2 bag-view 还继承旧版 34px 56px 28px 内边距，与自己的 bag-shell 边距重复

## 修改边界

1. game/css/expedition-inventory.css
   - 背包满屏壳使用全局布局宽高变量，只经过一次统一缩放
   - 清除 v2 继承的旧内边距，由 bag-shell 独占边距
   - 保留五列卡牌与内部滚动，提升本页说明、筛选、容量和分区的视觉层级
   - 全部原说明保留，改为左对齐；当前 1188 宽窗口中正文与筛选为约 13.6 显示像素
   - 背包打开时的独立详情采用 640px 资料栏、可滚动全文和 60px 设计尺寸的操作/关闭目标；选择器限定到打开的 bag-v2，不改变基地详情
2. game/src/hub/game.bag.js
   - 随身背包、安全格与消耗区详情调用已有装饰器
   - 可操作详情在本轮动作注册后装饰，捕获当前动作；原返回、销毁与动作守卫保留
3. game/src/hub/game.bag.view2.js
   - 左栏图标补可见的背包、安全格、消耗区名称，保留原 data-act 与拖放目标
4. tests/backpack-layout.test.js 与 tests/bag-page-lifecycle-review.test.js
   - 保护布局坐标、五列、滚动、局部字级/命中大小、全部说明与三分区标签
   - 验证完整长文、页脚与关闭键归位、动作捕获、详情阅读不写存档、安全格和消耗区限制

未改战斗、基地、入城补给、共用卡牌字级、存档、装备/安全格/排序/拖拽/消费规则。未启动服务、未操作浏览器、未构建、未提交。

## 验证

- 第一组定向验证：7 文件 / 96 项通过，包含新布局、背包生命周期、共用卡牌阅读、背包架构、全局缩放及 contracts / architecture-boundaries 哨兵
- 第二组规则回归：7 文件 / 32 项通过，包含道具基线、锦囊容量、返回钩子、结构化规则迁移/使用、卡牌背包边界与新手文案
- 自有 JavaScript/测试定向 ESLint 通过；自有 diff whitespace 检查通过
- CSS 由新布局测试中的 PostCSS 解析成功
- 第二组运行出现 jsdom 的既有无音频 codec / 缺少剑士资源映射提示，测试结果仍为 32/32 通过
- 实页由父任务在 tab7 / 5300 手动刷新后验收；本记录不把 CSS 契约或合成输入当作真实窗口几何与真实输入证据

待父任务确认：满屏尺寸、详情资料栏、长文阅读滚动、安全格往返、消耗区只读、关闭后返回来源卡格。最终实页证据由父任务补入。
