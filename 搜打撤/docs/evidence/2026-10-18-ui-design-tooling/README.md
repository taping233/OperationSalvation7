# 二级 UI 规范工具试用（2026-10-18 UTC）

结论：保留 Stylelint 17.16.0（官方 npm，MIT，仅 devDependency），实际定位了二级界面残留的硬编码字号；将容器列头说明的 18px 等值替换为已有 `--ui-text-label`。未修改其余主题或布局。该工具约束可检查的一致性，不评价审美。

## 发现与处置

初次 5 文件审计共 6 个 warning、0 error；局部替换后 5 个 warning、0 error。原始报告分别为 before.json / after.json，后者在并行玻璃样式代理释放后重新生成。

- 已整改：container-store.css 的 `.container-column-head span` 原始 18px，改为 var(--ui-text-label)，token 仍为 18px，静态值不变。
- 待视觉判断：container-store.css 两处 small 仍为 14px，与现行次级标注 18px 规范不同。此处需在真实画面确认密度与层级，不在工具接入任务里擅自放大。
- 保留职责例外：卡面 30px 控制卡面比例；容量总数 38px 是突出数字；card-browser 的 25px 字号是翻页箭头。三者继续显示人工复核 warning，不自动归类为缺陷，也不为了分数新增 suppression。
- 不强套禁止 px、颜色或圆角；主题材质与卡牌几何由既有组件负责。

## 接入与成本

新增 stylelint.config.mjs、quality:styles / quality:styles:test 命令、6项独立 Node 测试、现行说明 docs/modules/ui-style-tooling.md。只扫描显式列出的5份 CSS，原始字号建议只作用4份消费者。错误可阻断命令，warning不阻断。未把实验接入全量检查或CI。

官方安装命令使用 --save-dev --save-exact --ignore-scripts --no-audit --no-fund，新增89个依赖包；没有运行安装生命周期、上传源码、引入运行时包或收费API。没有安装 Style Dictionary：它适合多平台 token 转换，当前 CSS 已有唯一来源，额外生成链收益不足。保留 npm 包内 LICENSE 与锁文件许可证记录。

## 本轮验证

在项目 Node v22.23.3：

- 6项工具规则/真实CSS等值契约通过（contract-tests.txt）。
- pearl-storage-interface、contracts、architecture-boundaries：3文件50项通过（target-tests.txt）。
- Stylelint 最终审计：5文件、0 error、5人工复核 warning。
- ESLint 定向配置与新增测试通过；相关修改 diff --check 通过；package/lock root 的Stylelint版本一致。
- 初步试跑也在默认Node24成功，最终结论以上述Node22结果为准。

不运行共享混树 build；不提交推送。真实屏幕未验证，静态检查不证明视觉或变量在所有动态根下的计算结果，仍沿用父任务实页限制。

官方出处：https://github.com/stylelint/stylelint 、https://stylelint.io/user-guide/rules/declaration-property-value-disallowed-list/ 、https://styledictionary.com/getting-started/installation/ 。
