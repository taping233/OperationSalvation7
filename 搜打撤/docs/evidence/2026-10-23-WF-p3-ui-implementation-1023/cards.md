# 卡片状态与阅读反馈实施记录

本批完成发现、奖励、背包的状态样式整理；牌库既有网格几何保留，焦点由主代理统一修复公共清框规则。未修改卡面身份、抽牌/领取/容量、存档或战斗拾牌控制器。

## 实际改动

| 计划 | 处理与责任入口 |
| --- | --- |
| C01 | `discovery-selection.css` 将选中宿主outline、外光、frame内外光、卡面shadow合并为一个2px金色frame及明确“✓ 已选中”。标记移入卡面右上8px，避免首排滚动将标记裁去。键盘focus-visible保留独立浅蓝outline，不改变已选数据。 |
| C02 | 保留原两步选择与各页面语义。新增回归：选中乙后Tab式聚焦甲，甲仍未选、乙仍已选；确认入口与回调不变化。现行背包没有`.bag-tile.sel`业务消费者，本批不新增“选中栈”状态。 |
| C05 | 在`card-state-motion.css`实际奖励按钮增加键盘focus出口。其他待领卡原对比、已领/丢弃暗化、查看按钮、原轻抬控制器均保留。回归确认已领/丢弃卡退出轻抬，后续阅读焦点不重新抬起；无新增卡名托条。 |
| C07 | `bag-design-system.css`移除自身!important清焦点与对子卡面的重复brightness，宿主独立浅蓝focus。原责任入口`expedition-inventory.css`将CSS hover位移限定为非真实卡面；真实卡面及数量角标继续由同一宿主接受card-state-motion的唯一transform。拖动开始后原CSS hover不再复活。 |
| C08 | `battle-pile-view.css`原有14px顶部/16px横向/24px底部padding可容纳3px焦点线+5px偏移，保留原几何与滚动预算。本批曾尝试扩4px后撤回，未证明需要增加尺寸。实际焦点出口由主代理在`card-layout-selected.css`统一处理；标题语义图标另批接入。 |
| F05 | `battle-discover.css`在原系统/游戏减少动态规则中同时取消hover位移；系统媒体规则显式包含:hover，避免被原hover的选择器权重覆盖。原frame、已选文字、focus均为静态结果，不依赖动画完成。非战斗卡控制器已有两条偏好通道，本批不重写。 |

## 验证

- `node node_modules/vitest/vitest.mjs run tests/card-state-motion.test.js tests/discovery-selection.test.js --reporter=dot`：2文件、25测试通过。
- 六个涉及样式的文件经PostCSS解析通过；自有路径`git diff --check`通过。
- `game/src/ui/card-state-motion.js`保持原文，既有快速反向、焦点保持、拖动退出、移除/关闭清理、系统减少动态测试通过。
- 本子任务未使用浏览器或启动服务；实页效果、屏幕边缘裁切、已领卡查看、拖动取消、详情返回由主代理整合验收。本记录不把静态核对写成已实页通过。

## 现场保留

首次编辑前原文快照与SHA256保存在系统临时目录`p3-ui-card-states-1023/`的`baseline.json`；获批扩展的`battle-discover.css`另记`battle-discover-baseline.json`。`bag-design-system.css`与`expedition-inventory.css`原有未提交整理全部保留，仅修改上述卡片职责。未build、提交或修改公共台账。

## 主代理接管的级联修复与复审

语义子代理发现受控背包选择器没有`#overlay`，无法覆盖`expedition-inventory.css`的`transition:transform .2s,border-color .2s`。主代理已在`game/css/card-state-motion.css`将其提升为`body #overlay .card.bag-page .bag-v2 .bag-tile.card-face[data-card-state-motion="true"]`；我没有重复修改该修复。

该选择器权重为(1,6,1)，高于基础格子的(1,4,1)，受控状态的transition-property不再包含transform，JS仍为姿态所有者。主代理新增`tests/ui-motion-cascade.test.js`原4项契约，以真实样式、DOM匹配及selector-specificity核对两种加载序、分类底板与两条减少动态通道。原87项组合验证由主代理报告；本记录不将该组合写成本子任务重跑结果。

本次只读复审了发现选中frame/mark、公共卡面清框与focus出口、奖励待领/已领/丢弃及背包受控规则。独立选中frame不被公共宿主清框命中；focus由实际宿主保留；奖励领取后的opacity/filter仍由业务状态独占，受控样式只改transition-property。此范围未发现另一处确定的同属性覆盖冲突。拖动释放等真实输入仍由既有动作回归与主代理实页核验，静态级联契约不冒充逐帧动画采样。

## 卡面状态光的游戏内减少动态补齐

语义子代理随后发现`.hsc-state-aura`只在系统媒体规则停止呼吸，游戏的`body.reduce-motion`列表遗漏它。定向核对确认：临时卡、变化卡及两者同时存在时，游戏内减少动态仍选中`card-state-breathe`。

本子任务获准接管`game/css/card-layout-selected.css`及已冻结的`tests/ui-motion-cascade.test.js`后，只在现行`body.reduce-motion .hs-card[data-card-layout="split"] :is(...)`列表追加`.hsc-state-aura`；没有改变稀有度、背景、透明度、filter或身份颜色。

同一契约文件新增3种状态的双通道检查，保留原4项。为避免jsdom对无关`:has`选择器的解析限制，契约解析器先筛选待测属性声明，再匹配真实选择器；原重要性、specificity和源码顺序规则不变。新增3项在修CSS前均明确失败：预期`none`，实际仍为`card-state-breathe 3s ease-in-out infinite alternate`；补齐单选择器后，全文件7项通过。测试还确认正常偏好仍呼吸、两条减少动态通道均停止、静态背景/opacity/filter不变。该测试文件ESLint通过。

本次原文/SHA在系统临时目录`p3-ui-card-states-1023/aura-reduced-motion-20261024/baseline.json`。CSS前SHA256为`8876ccad52ae4644df24318571946b4c7c2a899dac9188700d3ae9cdb6b1c5ba`，后为`f9f17fed0682e97572d495bb20d8b7f262053da83ef95c3994dd652b48409fde`；程序核对与原文相比仅多这一个选择器。

需同步运行快照：`game/css/card-layout-selected.css`；若尚未包含主代理的受控背包修复，同时同步`game/css/card-state-motion.css`。验证/交付同步：`tests/ui-motion-cascade.test.js`及本记录。相对先前图标消费者清单，本子任务追加触及1份CSS与1份测试路径；21份源码107处图标token统计不变。未使用浏览器、未build/全量、未提交。
