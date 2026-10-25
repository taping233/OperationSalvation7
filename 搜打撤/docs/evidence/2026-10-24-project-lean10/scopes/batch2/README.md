# 第二批公共选择器作用域归一

本批沿用首批转换器与运行编译器，保留功能、实验皮肤、声明、注释和层叠次序。父会话先核对并登记 [72 份精确路径](manifest.json)，随后实施；实际净减 **25,885 规范化字节**，扣除空白差后的结构收益为 **25,839 字节**。

首、二批 CSS 合计实际净减 **199,353 字节**，纯结构净减 **199,209 字节**；兼容工程模块及测试的新增成本由父会话单列扣除，不能以该片数字代替全项目最终净减量。

## 范围与保留

- 首批 52 文件及其证据未被本批覆盖。
- 保留首批明确排除的 11 份暂停 CSS；另排除暂停分片中的 `base-logistics-trade-v12.css`、`feedback-oct12.css`、`home-linked-interactions.css`。其余 6 份交叉路径已属首批，未在本批再写。
- 现有原生嵌套规则保持原样，独立设计和试听页面保留原入口与外观规则。
- 原字节保存在本地忽略缓存 `node_modules/.cache/project-lean10-scopes-before-batch2/`。

## 验证

1,730 个选择器分支 specificity 相同。处理后重新解析、展开新增作用域，对照选择器 AST、完整声明和注释字节、at-rule 结构与顺序相同；实际 `expandComponentScopes` 编译器对照 [72/72 通过](compat-roundtrip.json)。前后 SHA 与清单一致，内存 esbuild 展开无错误或警告，见 [静态验证](validation.json)。自有 diff 检查通过；没有运行构建或启动服务。

按新路径找到 22 份相关原测试，首跑 244 项，233 通过、11 失败。仅将 8 份失败的 CSS 读取接入现有 `readCssSource`；[精确路径和指纹](css-test-adaptation.json)与[断言守卫](css-test-assertions-proof.json)证明 462 个 matcher 预期参数、99 处测试注册/跳过调用不变，相关 ESLint 通过。

复跑同一 22 文件为 **243 通过、1 失败**。剩余 `premium-ui-pages.test.js` 的 JS 源码断言未修改；冻结游戏文本的内存读取对照中，该文件 8 通过、同名同诊断 1 失败，见 [基线对照](css-test-baseline-comparison.json)。实际运行 JS 导入仍为当前工作树，该结果不是完整旧版本回归。首跑 M05 动画帧计数失败在同一复跑中未再出现，未作为本轮修复成果。

未修改测试预期、skip、玩法、资源、其他运行 JS 分片或父会话测试，未提交或推送。当前窗口实页及开发/发布入口集成验收由父会话集中完成。
