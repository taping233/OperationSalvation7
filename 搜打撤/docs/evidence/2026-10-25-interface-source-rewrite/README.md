# 公共界面来源整理

2026-10-25，Friday，WF-interface-source-rewrite-1025。状态：完成未提交、编辑释放。按老板要求将既有官网拆解用于普通前端界面，直接替换原定义并移除被替代的声明；不增加一层末尾主题覆盖。现行接口见[公共界面组件](../../ui/shared-interface-components.md)。

## 实施

- 普通 `.ov-btn` / `.mini-btn` 的基础外观与状态、`.ui-control` 反馈和显式文字层运动统一由 `public-controls.css` 负责。从 `base.css`、`overlays.css`、`winter.css`、`ak-skin.css`、`interface-components.css` 移除相应重复定义；工具栏、事件选项、回合及奖励按钮的外层轻移从 `run-experience.css` 原定义撤去，同时移除公共层原来的高优先级纠正。按钮行才均分宽度，普通按钮保持内容宽度。
- `interface-components.css` 负责中性玻璃确认框和留言表单；移除 overlays 的旧留言面板及 winter 的旧玻璃材质/入场，旧纸面壳及通用卡片皮肤明确排除组件自己的玻璃面板。`motion-transitions.css` 移除冗余设置选择器，专用玻璃动画排除公共面板，避免再次叠加入场。保留原有确认、取消、焦点、输入隔离及业务守卫。
- `page-settings.css` 重写为设置/信箱页壳、正文层级与操作控件；`settings-navigation.css` 负责分类、设置行和开关。删除旧双列分组、旧勾选框、装饰呼吸和私有整页/逐行入场。设置行改为安静的分隔线，信箱操作保持紧凑，沿公共区域切换。
- 设置与指南的选中填充使用公共底板提供的变量；移动底板完成测量后才让出静态填充，减少动态时保留原静态状态。移除这两个入口的高优先级选中覆盖及重复时序；背包与成就的既有专用选择样式没有在本轮重写。
- 实页发现设置的三个 `details` 原本没有可区分身份，公共返回恢复器因此跳过。`settingsLayoutHTML` 为每个分组增加 `settings-extra-*` 稳定ID；重建后分别恢复展开、滚动和来源按钮焦点，新增行为回归。

运行代码范围以 [source-manifest.json](source-manifest.json) 为准；其中 before 指本会话修改前保存的工作树内容，不是HEAD或全项目基线。保留其他会话的未提交内容，未删除任何文件、未提交/推送、未构建。

## 验证

- 14份目标CSS的Stylelint通过；设置导航与新增返回测试的定向ESLint通过；文档守卫通过。运行CSS净减659行，计入新增返回测试后代码净减626行，计数按本会话修改前工作树快照比较。
- 首轮8文件119项：112通过、7失败，见 [targeted-tests.txt](targeted-tests.txt)。独立副本换回修改前CSS，三个失败文件仍为相同7项失败、36通过，见 [baseline-tests.txt](baseline-tests.txt)。失败涉及设置同步时序断言、旧字段断言、缺少返回导航导出的测试替身及战斗菜单可见性；不将这些既有失败记作通过。
- 最终设置返回、指南与选中底板3文件9项通过，见 [final-focused-tests.txt](final-focused-tests.txt)。新增回归同时检查：只恢复原折叠区、其他分组保持关闭、阅读位置与来源焦点恢复。
- 当前Codex内置浏览器、`http://127.0.0.1:5200/`、标签1、当前窗口，无额外尺寸。实页已检查设置分类点击与End键导航、音频页布局、信箱两页和末页禁用、返回设置的展开/滚动/焦点、确认框取消回焦、右键留言Esc关闭、指南首章和末章及末章下一页禁用。动作通过内置浏览器真实点击/按键执行；页面求值仅用于读取布局及状态。
- 最终预览1618×956，页面无横向溢出、当前标签错误日志为空，见 [browser-summary.json](browser-summary.json)。
- 确认操作只打开并取消，留言未保存，未改变游戏进度或业务数据。复用共享5200/PID46172，无自建服务。

## 实页证据与边界

- [设置修改前](settings-before.png)、[设置修改后](settings-after.png)、[设置返回](settings-return-after.png)。
- [信箱](inbox-after.png)、[确认框](confirmation-after.png)、[留言表单](feedback-dialog-after.png)、[指南末章](guide-after.png)。
- 共享工作树的其他会话更新曾使页面重载；已基于最新可见状态重新进入目标入口。截图和操作仅证明上述路径，不宣称全站、全部输入方式或性能验收完成。
- 未实页覆盖：战斗专用快档按钮、奖励/地图各状态、所有收藏筛选、动态偏好运行中切换，以及图片异常恢复（本轮未改资源恢复实现）。未运行全量测试或构建。

临时原文与独立对照副本保留在项目ignored `.tmp/interface-source-rewrite-baseline/` 和 `.tmp/interface-baseline-compare/`，供后续归属核对；无后台服务，不自动清理。
