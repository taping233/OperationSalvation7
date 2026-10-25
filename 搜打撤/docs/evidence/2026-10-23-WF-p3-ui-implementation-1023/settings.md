# 设置行与分类选择实施

状态：原分片源码与定向验证完成；主代理追加最终CSS级联接管后，当前窗口实页与最终验证结论仍由主代理统一补充。任务 `WF-p3-ui-implementation-1023`，范围 A01、A02、A04。

## 改动

- A01：设置行在 hover / focus-within 时使用同一浅亮阅读反馈；移除 checkbox 开启时额外着色的行边线，开启只由 switch 本体表达。键盘焦点保留控件 outline 和行边线。行本体不再响应旧 `.chk:active` 的位移，滑块拖动和开关圆点原有位移不变。
- A02：分类移动底板只在选中项几何可测、首次姿态已提交后接管静态填充。零尺寸、隐藏、控制器未挂载或销毁时，由 `.on` / `aria-selected` 保留完整选中结果。减少动态时隐藏移动底板，显示同一业务状态的静态填充。文字、字重和选中标记保留；未选项 hover / focus 只给较弱反馈。保留原有目标续接与单底板逻辑。
- A04：设置页动作按钮的 hover / pressed / disabled / busy 通过颜色、边线和内阴影反馈，清除旧上浮、缩放和按下位移；禁用与忙碌保留可读文字。音频重试按钮预留宽度，沿用邻近现有状态说明。音量数字保留固定宽度及等宽数字；移除多余 `%` 伪元素，因为当前 HTML / 音量刷新已输出百分号。

仅修改下列源文件与一个测试文件；未修改设置业务状态、音频加载机制、键盘导航或其他页面布局。

- [game/css/settings-navigation.css](../../../game/css/settings-navigation.css)
- [game/css/selection-state-motion.css](../../../game/css/selection-state-motion.css)
- [game/src/ui/selection-state-motion.js](../../../game/src/ui/selection-state-motion.js)
- [tests/selection-state-motion.test.js](../../../tests/selection-state-motion.test.js)

现行文件原文和 SHA256 在首次编辑前保存到本机临时目录 `C:\Users\太平\AppData\Local\Temp\p3-settings-selection-1023\before.json`。原有工作树改动保留，未按 HEAD 重建文件。

## 验证

- `npx vitest run tests/selection-state-motion.test.js tests/settings-page.test.js tests/settings-audio.test.js --reporter=dot`：3 文件、20 测试通过，退出码 0。新增用例覆盖：零尺寸不接管、可测后接管、隐藏退回静态状态、重新显示直接定位当前选择、销毁释放接管标记。既有快速切换、单底板、焦点与背包局部更新用例通过。
- `npx eslint game/src/ui/selection-state-motion.js tests/selection-state-motion.test.js`：通过，退出码 0。
- PostCSS 解析两个修改 CSS：通过，退出码 0。
- 定向 `git diff --check`：通过，退出码 0；Git 提示既有 CRLF 在后续 Git 写入时规范化为 LF。

## 主代理追加的最终级联接管

只读审查确认，旧 `expedition-inventory.css` 的 `.card.bag-page .bag-v2` 宿主选择器能压过本分片最初的通用分类规则；旧 `.bag-rz:hover` 位移和transition会继续命中，包括系统／游戏减少动态。前述20项测试证明的是原分片的控制器和设置逻辑，不能单独证明该级联冲突已消除。

主代理已在现有 [selection-state-motion.css](../../../game/css/selection-state-motion.css) 接管规则中补入 `body #overlay .card.bag-page .bag-v2 :is(.bag-rail,.bag-tools)[data-selection-motion] > :is(.bag-rz,.bag-pill)`。普通模式保持按钮`transform:none`，仅过渡颜色／边线／底色／阴影；系统与游戏减少动态分支均为`transition:none;transform:none`，选中底板继续隐藏并由静态业务选择绘制。

近邻 [card-state-motion.css](../../../game/css/card-state-motion.css) 由主代理同步使用完整背包宿主，避免旧卡面CSS将transform过渡重新带回。新增 [tests/ui-motion-cascade.test.js](../../../tests/ui-motion-cascade.test.js) 的4个契约按真实宿主、CSS优先级和两种样式顺序核对卡面transform过渡、分类hover位移、系统／游戏减少动态。该测试使用定向级联解析，不冒充浏览器hover或实际屏幕几何；运行结果与实页由主代理最终记录。本代理没有重复编辑这些源码或测试。

## 实页待验

以下为待验场景，不把 DOM 测试当作视觉验收：

1. 设置通用／画面与反馈／音频／输入快速连续切换、重选、键盘左右键切换，选中底板不双显、无闪回。
2. 鼠标移出已开启设置行、Tab 进入开关、音量拖动 0→100，区分阅读反馈／键盘焦点／开启状态；行、控件和数值位置稳定，百分号仅出现一次。
3. 减少动态开关开启前后、设置关闭重开，分类静态选中完整。
4. 背包仓区与类型筛选切换、空类型返回、当前自然窗口下重新布局，仍只有一个选中填充；系统／游戏减少动态下没有旧按钮上移或transform过渡重新接入。
5. 音频不可播放和重试状态的实际禁用反馈；不通过触发清空数据验收危险按钮。

本代理按分工未启动服务、未使用浏览器、未 build、未提交；以上实页结果由主代理补充。
