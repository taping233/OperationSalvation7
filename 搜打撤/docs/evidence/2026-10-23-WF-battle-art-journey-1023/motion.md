# 节点持幕与目的页交接

2026-10-23，范围为 `game/src/ui/transition-handoff.js`、`game/css/transition-handoff.css` 与 `tests/held-scene-handoff.test.js`。已在 `.tmp/battle-art-journey-1023/motion-before/` 保留两份修改前源码，未覆盖其他工作。

节点的 `resume-hold` 先等待资源和既有业务停留，原有插画与标题却因 `page-cut-waiting` 停在透明的动画首帧。目的页继承切幕后，公共交接会解除暂停并再次运行插画、标题与斜切退场，产生先等空幕、再演完整插画的分段感。此为源码确认的呈现共因；未把它称为已复现的两次业务进场。

本次让这类持幕的插画与标题保持可读的稳定状态，目的页就绪后仅使用既有公共 180ms 淡出。资源等待、450ms 节点业务停留、跳过、输入归属、失效页面检查和新页面保护不改。基地、照片和专用读档沿原编排；透明地图返回盾、跨层演出、音乐音效及战斗业务均未改。

新增用例检查原始及继承持幕样式、慢资源期间不揭幕、就绪后一次淡出、旧战斗就绪不关闭新页、基地/照片保留富过场、减少动态仍等待资源。首轮集中运行新增文件和 `surface-motion`、`page-surface-lifetime`：24通过、1失败，原日志见 `motion-tests.txt`。失败来自新增测试的动态 `new URL` 在Vite转换中读到了测试自身，并非生产CSS；改为Node绝对路径读取原CSS后，仅重跑受影响新增文件，5项通过，见 `motion-tests-rerun.txt`。本片共25个不同用例最终通过；源码自首轮后未再变更。两份生产文件 `git diff --check` 通过。

接手续验：21:41:27 一次运行同一组3个测试文件，25项全部通过，原始输出为 `motion-tests-combined.txt`；首轮失败与单文件修正后结果继续保留。自接手后未修改生产源码或测试，定向 `git diff --check` 通过。Vitest提示 `environmentMatchGlobs` 已弃用，不影响本轮退出码0；配置不在本片范围。

修改前备份SHA256：`transition-handoff.js` 为 `682ced044dd90ea5eee0d5fd7a9be865c77f64b206859d8984062e458d34f786`，`transition-handoff.css` 为 `e720c5c1ca96bfa9c9a3862db49b41dd9c4fcdbe387a2d31c94323bce131edd2`。

实现完成、编辑释放，未提交。未运行全量、build或创建服务。本片真实画面与输入由父会话使用当前窗口内置浏览器集中复核，自动检查不代表实页通过。
