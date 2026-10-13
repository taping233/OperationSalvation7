# 选人、皮肤与整备展示整改

状态：实现与定向验证完成，待主会话当前窗口实页验收；未提交。

## 本轮明确要求与来源

老板明确反馈选人立绘/皮肤缺乏统一容器、大小位置不一致，以及整备玻璃模糊不足。本轮实际查看已保留的星铁队伍选择、绝区零角色信息/装备页、VR 训练编排截图；以星铁固定展示与头像容器、ZZZ 候选/操作分区作为结构依据。可复核来源和观察另列 [roster-preparation-sources.json](roster-preparation-sources.json)，供主参考板合并。

本作五张标准人物图与三套皮肤原图均保留。已查看三套皮肤：春日机车、新春旗袍和盛夏水枪都是横幅场景画，因此不将它们拉伸为标准站立全身像。

## 实现

- `roster-departure-v2.css` 是当前四重 ID 选择器的真实生效源。本轮在该规则内部重整，未继续增加 ID 或 `!important`。
- 主人物展示增加固定画框、统一内缘和居中画布。五张标准图继续使用已有绘制边界校准；三套场景皮肤在相同框内 `contain` 完整展示，保持原比例。
- 原纯文本皮肤按钮改为四个等大预览容器，统一图文位置；选中边缘、勾选与 `aria-pressed` 同步。更换皮肤同时更新画框 `data-skin`，不改变皮肤选择或存储语义。
- 整备根增加 `.departure-glass`，仅在 `feedback-oct12.css` 的旧整备根选择器排除该类，避免不透明旧底板重新盖住玻璃。
- `departure-selected.css` 收拢为当前完整有效布局：复用 `base-operations-v5.webp` 房间图，仓库/携带、人物确认条、页头和页脚分别透景；模糊在背景层，面板使用独立边缘反光与投影，卡牌/文字不施加模糊。
- 仓库与携带继续独立滚动，卡牌容器和数量行统一；原有重复摘要/拖拽说明维持收敛，容量、筛选、宠物、出发操作保留。
- `preparation.css` 对应另一预设模块，并非实际出征 `#depMain`，本轮核对后未修改；`expedition-roster.css`、`departure-cover.css` 的低优先级旧规则未盲目追加覆盖。

## 文件与并行边界

CSS：`roster-departure-v2.css`、`roster-reference.css`、`departure-selected.css`；`feedback-oct12.css` 只改旧 `#depMain.departure-cover` 根选择器的排除。

JS：`game.run.altar.js` 只改选人立绘包装、皮肤预览和切换时展示状态；`game.hub.depart.js` 只增加整备根类和人物展示标记。出发生命周期、先露地图问题、入口事件规则由主会话处理，未在本阶段修改。

## 验证与缺口

- 8 文件 / 79 项定向检查通过：departure-class-confirmation、departure-browse-state、departure-drag、character-idle、characters、e4-async-entry、contracts、architecture-boundaries。
- 4 个相关 CSS 通过 PostCSS 解析；修改 JS 语法、定向 ESLint、`git diff --check` 通过。
- 一并运行的 `hub-flow-regression` 有 5 项当前异域失败，分别涉及旧危险二次确认源码断言、收藏进度、后勤标签、口袋入口、木材入口。这些对应源码未在本阶段修改，已报告主会话，未扩范围修复。
- 选人原图/皮肤尺寸、真实玻璃透明度、面板与文字对比度由主会话内置浏览器当前窗口复核。尚无性能基线，不声称渲染成本不变。
- 没有开关浏览器、服务、build、提交或删除操作。
