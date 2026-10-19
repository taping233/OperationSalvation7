# 共享弹层重复关闭：真实工具应用与结果

## 修复

hideOverlay 原来在隐藏/淡出短路之前就递增返回令牌、取消背景/提示并广播关闭，导致重复关闭仍有副作用。现在先判定关闭状态；淡出中的立即关闭复用原 finish，同一轮不重复初始化、事件、声音或令牌。没有改变淡出时长、房间瞬隐、减少动态效果、焦点返回及背景隔离机制。

## 实际使用的工具

- fast-check：真实 overlayMethods，固定 seed 20261019，200组最多35动作的 open/close/immediate/tick 状态序列；加5个确定性例子，共6项测试通过。模型跟踪可见性、关闭事件次数、返回令牌及旧收尾取消。未修源码的初始3测试全失败，首个反例可缩为隐藏态close。
- Stryker：仅变异 overlay.js 235—252行关闭入口，28变异最终全部 killed，0 timeout/no-coverage/error。首轮19 killed/8 survived/1 no-coverage揭示清理/可选处理器/令牌断言缺口；补验后27/1；最后将多轮令牌单调性加入随机模型，28/0。没有忽略变异或放宽断言。范围有限，100%不等于整模块或产品无错。
- axe-core：新测试对真实UI生成的弹层开→重复关→重开 DOM 运行5项命名/ARIA规则，零violations、重开零incomplete。现有静态index九项审查零violations，保留制作名单popup关系1项人工复核；不包含布局、对比度、Canvas、实页。
- jscpd：真实UI目录74源码，8214行，1处7行/75token相似（page-visual-ready.js两个已有清理分支），没有overlay新增重复候选；未仅为降数字强行抽象。
- Knip：实际report-only退出1，23处报告记录内有4未声明引用与44 unresolved；恢复副本历史证据/资源缺口混在内，overlay模块没有报告项。全游戏源保守列入口保护动态注册，不能据此证明没有死代码，未自动fix/delete。
- Stylelint：overlays.css 与 motion-transitions.css 定向零问题；既有五个UI样式族仍0错误/5个原始字号token人工审查警告。没有为警告清零改视觉。
- Spec Kit：重新读取官方规格模板并实际按其结构写 SPEC.md；原试用产物已丢失，未声称恢复旧CLI运行。
- Vercel Web Interface Guidelines / Impeccable：重新读取官方文件并记录blob SHA，实际检查中断动效、焦点、共享组件与操作型界面的一致性，结果见 SPEC.md；没有安装执行类skill或浏览器hook。

GamingAgent与dependency-cruiser此前移除，不属于本次实际执行项目；未为“都用”盲目重装或调用付费/模型/浏览器通道，原dependency-cruiser试用已核对：523模块1349边未找到新有效缺陷，当前同模块幂等修复未新增跨包需求，使用现有架构测试补验；GamingAgent未找到完整可复现试用产物，不宣称已重新使用。

## 验证与限制

相关六文件50项（含axe）通过，现有架构/循环依赖两文件41项通过；独立属性配置6项/200序列通过；syntax、8组types、全量lint及最终定向lint通过。UI源码未本地build、未真实页面验收；原画不全，不将JSDOM换称浏览器。远端全量CI以本提交结果为准。

Stryker最初复用纯模块配置排除了CSS，导致motion.js真实依赖加载失败、0测试退出。沙箱直接诊断确认缺 combat-feedback.css 后保留CSS，related选择恢复默认，最终6项实际执行。失败记录保留，未用跳过测试解决。初期随机测试fixture漏填真实UI的_roomActive=false导致错误采用房间瞬隐，已修复fixture而未改游戏语义。

上一批宝箱去重402d840远端构建已证实包体221.85→212.04MiB、重复资源9.94→0.13MiB，重复门转通过，其余4项预算仍超限，预算未放宽；主CI641文件6326通过/2跳。相关回执与原始日志在独立宝箱证据中，不宣称性能全过。
