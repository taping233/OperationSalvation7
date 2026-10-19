# 二级 UI 静态规范审计

使用 `npm run quality:styles` 检查二级 UI 的 CSS 错误与字号一致性。Stylelint 17.16.0 是仅开发期依赖，许可证 MIT；不引入 React，不进入游戏运行时，不访问外部服务。

## 规则与边界

`stylelint.config.mjs` 将非法颜色、未知属性/单位、漏写 var()、重复属性作为错误。仅对 bag-design-system、container-store、card-browser、ui-design-system 四份现有二级样式提示原始像素字号，包括 font 简写。共享 token 声明不受这条限制，布局尺寸、卡牌几何和主题颜色不禁止。

字号提示为 warning，退出码 0 不代表没有提示。卡面比例、翻页箭头和容量大数字有各自职责，需人工判断；不得为了清空报告把它们强制统一为正文。没有开启全仓自动修复，也没有把此实验加入 check:quality 或 CI 门禁。它不能判断审美、最终层叠、可读性或真实屏幕可访问性。

语义取值继续只维护在 [二级界面规范](secondary-ui-style.md) 指定的 CSS 变量入口。Style Dictionary 面向 token 转换与多平台生成；当前只有既有 CSS 入口，尚无同一 token 输出 Pixi/其他平台的具体需求，因此未添加第二套 JSON 来源和生成链。

## 验证与复查

- `npm run quality:styles:test` 验证规则能报错、允许语义 token 和布局常量、不越界检查其他主题，并确认容器次级标注的等值替换。
- `npm run quality:styles -- --formatter json --output-file <文件>` 保存机器可读报告。
- 试用前后发现、保留例外和验证见 [本次证据](../evidence/2026-10-18-ui-design-tooling/README.md)。

## 官方来源

- [Stylelint 源码与 MIT 许可](https://github.com/stylelint/stylelint)
- [属性值限制规则](https://stylelint.io/user-guide/rules/declaration-property-value-disallowed-list/)
- [Style Dictionary 的多平台生成定位](https://styledictionary.com/getting-started/installation/)
