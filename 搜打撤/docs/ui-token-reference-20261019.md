# 商店与战斗二级界面的语义 token 接入

2026-10-19。状态：表现层修改和静态检查完成，等待当前平台内置浏览器实页验收。

## 采用的范围

沿用 `game/css/secondary-ui-tokens.css`，让商店文字、边线和返回操作接入已有颜色角色；战斗二级弹层的常规文字、动作和分组间距使用已有尺寸阶梯。新增 30px 对话标题角色，保留原有标题大小。

商人插画、金币暖金、战斗卡牌尺寸、奖励页成功大标题继续承担各自场景的表现任务。商店购买动作保留金色，并将其背景、悬停背景和前景成对命名。战斗外壳继续独占玻璃模糊，内部内容不新增实心面板。未引入第三方运行时组件。

## GitHub 一手参考

1. Material Web，[颜色角色](https://github.com/material-components/material-web/blob/main/docs/theming/color.md)与[按钮规范](https://github.com/material-components/material-web/blob/main/docs/components/button.md)，[Apache-2.0](https://github.com/material-components/material-web/blob/main/LICENSE)。借鉴背景与前景成对、主要完成动作与次要动作分层。本轮修复商店返回按钮悬停时只变深背景、仍保留深色文字的问题。其 [README](https://github.com/material-components/material-web/blob/main/README.md)注明维护模式，因此仅参考规范，不安装该组件库。
2. Carbon，[主题 token 文档](https://github.com/carbon-design-system/carbon/blob/main/packages/themes/docs/sass.md)与[局部主题示例](https://github.com/carbon-design-system/carbon/blob/main/examples/custom-theme/src/index.scss)，[Apache-2.0](https://github.com/carbon-design-system/carbon/blob/main/LICENSE)。借鉴文字、边线、表面和状态的语义分工，让不同场景共享基础规则，同时保留场景专用颜色。本轮不搬用后台布局或引入 Carbon。
3. Open Props，[尺寸源码](https://github.com/argyleink/open-props/blob/main/src/props.sizes.js)，[MIT](https://github.com/argyleink/open-props/blob/main/LICENSE)。借鉴少量离散尺寸与内容宽度分工；当前项目已有 4/8/12/16/24/32px 设计画布间距，因此使用现有 token，不导入另一套尺寸变量，也不将 viewport clamp 叠加到游戏画布缩放。

以上均为规范思想参考与项目原生 CSS 调整，没有复制第三方实现。若将来复制实现，须保留对应许可及所需声明。

## 修改与检查

- `game/css/secondary-ui-tokens.css`：显式增加商店消费者和对话标题角色。
- `game/css/expedition-shop.css`：共享文字与边线；暖金购买按钮成对命名；返回按钮独立设置 hover 前景和背景。
- `game/css/battle-secondary-overlay.css`：常规文字、动作及部分分组间距使用语义 token；卡面字号与尺寸不变。
- `tests/tools/ui-secondary-token-adoption.test.mjs`：验证商店 token 接入、插画与暖金保留、返回按钮两态静态对比度、战斗标题和卡宽契约。

验证：两份样式契约合计 9 项通过；上述三份 CSS 的 Stylelint 通过。返回按钮的 CSS 声明配色对比度：正常态约 9.54:1，hover 约 10.80:1；此前 hover 声明配色约 1.37:1。此计算只覆盖声明的前景/背景组合，不等同浏览器最终样式或视觉验收。

未核验：商店正常/hover/focus 实际输入、购买详情关闭与返回、战斗发现/选牌/规则弹层滚动及关闭后的焦点回归；需由当前平台内置浏览器在最终集成版本验证。没有运行外部浏览器或 headless 替代，也没有进行构建或宣称全量通过。

本恢复副本不含 Git 元数据，限定路径的 handoff 命令因 git rev-parse 失败；文件属地和冻结结果已交由发布协调者统一登记。

集成检查：1004f21 全量 CI 暴露旧 secondary-glass-style 契约仍断言局部 feedback-blue 名称。改为校验公共 ui-blue 引用、原蓝色值 #b6cbd7 及 battle-secondary-panel 作用域，透明面板和 hover 反馈断言保留。
