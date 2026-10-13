# A线首页、导航与空间展示

状态：授权实现已完成，待主会话当前窗口视觉与真实输入复核。未提交。

首页保留冬日基地原背景与玻璃材质。真实事务仍仅取可扩建、可孵化、待领取；事务区由316px/94px行收紧为276px/74px行，留出中央场景。整备为右侧唯一主动作，使用暖金边与图标；模式选项沿现有蓝/红表达，无奖励和存档变化。

七个底栏目的地沿原顺序等分，底栏从128px降到104px；入口不随事务增减移位。当前入口使用顶部短青条、低亮阅读底及“当前房间”，悬停使用白色轻底，二者区别可见。保留原data-act/data-tab及奖励集合。

庭院由顶沿两种景观、大场景、右侧240px工具组成；工具不再压在水面中央。投喂/雨势、声音、暂停、配色与原动画生命周期不变，声音默认关闭，减少动效和离开清理保留。根类courtyard-zzz取代旧courtyard-v12，旧跨房间庭院规则不再匹配，由C线清除其源文件中的旧分支。

照相馆的胶片装饰退到右边缘并降低透明度，放大时房间装饰隐去。作品、装裱、画幅、网格、详情布局均保持。分类选中同步aria-selected和键盘Tab顺序；现有方向键、Home/End继续工作。

## 精确改动

- game/src/hub/hub.navigation-v7.js
- game/src/hub/hub.courtyard-v3.js
- game/src/hub/photo-studio-tabs.js
- game/css/base-home-v7.css
- game/css/base-framework-v7.css
- game/css/base-courtyard-v3.css
- game/css/photo-studio-room-effects.css

未改hub.home-v3.js与photo-studio-navigation.js，原HTML真实事务条件和浏览恢复机制沿用。未改保护入口、玩法数据、卡框或人设；未安装、build、起服务、操作浏览器、提交或删除文件。

## 实际检查

2026-10-12，独立调用项目现有Vitest（避开npm test的pretest写入），庭院生命周期、照片分类标记、照片呈现三个文件12项通过，退出码0。7项对象为3个JS文件的node --check及4个CSS文件PostCSS解析，退出码0。该结果仅证明定向逻辑/语法，不证明美术通过。

扩展运行hub-flow-regression与上述三文件时退出码1，23项中5项失败：源码断言要求price>=5/最后一张确认字符串；收藏进度旧选择器；首页旧断言要求无shop/upgrade入口；后勤pocket旧入口；物资rawItem/wood旧入口。A没有修改这些命令、收藏和后勤来源；七入口失败与本轮明确七入口要求冲突，其余交主会话核对，未擅自改保护入口或他线。单独隔离复跑A三个相关文件后12项通过。

## 共享合同

REQ-A1：C唯一编辑base-archive-facilities-v12.css并收敛旧courtyard-v12专属/:is分支；A唯一维护base-courtyard-v3源规则。根类courtyard-v3 courtyard-zzz，workspace为courtyard-zzz-workspace，内部courtyard-v3生命周期选择器不变。没有新导出或CSS接入点。

REQ-A2：公共返回的含义由主会话在hub.presentation.js呈现层完善，根入口game.hub.js/pages.js保留他会话保护。页内层关闭仍沿现状，A未变更其实际路由。导航on小标记可随presentHub既有innerHTML同步自然更新，无额外钩子。

## 未核项与回归边界

主会话需在Codex内置当前窗口核验：首页常规/精英/有草稿/事务空态与3行，主动作及工具不溢出；七入口位置与当前选中；庭院两景观、settings展开/收起、声音/暂停/投喂；照相馆分类、作品放大关闭与原筛选/选中/滚动/焦点恢复。A未测真实输入与最终计算样式，未采性能基线，无性能改善结论。

修改前字节仅保存在.gitignored .tmp/a-zzz-baseline，自有a-baseline.json记SHA；a-changes.json包含本线当前SHA与基线增量，供主会话排除既有未提交归属。
