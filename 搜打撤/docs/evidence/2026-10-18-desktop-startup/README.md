# 桌面启动加载动画

老板要求 EXE 启动时提前显示加载动画。已实现桌面外壳独立加载窗口：轻量页面显示后才开始加载游戏，游戏标题控件已绑定且 DOM 游戏状态离开 boot 后，再等两帧通知主进程准备通用切幕。切幕画面准备、绘制后才切入游戏窗口，沿共用动画揭开首页。加载窗口与游戏使用不同的渲染窗口，游戏初始化期间仍可显示动画和退出入口。

按老板后续要求，文案改为“正在准备进入城市”，增加模拟进度：从 8% 缓慢前进至最多 94%，收到游戏真实就绪通知后设为 100% 并切入游戏。该百分比为呈现动画，不代表资源加载测量值；失败时停表，重试时重置。

12 秒未就绪时显示等待说明；主页面加载失败或游戏渲染进程退出时显示重试。主进程核对通知来源；切入游戏或关闭窗口时释放监听。重复点击 EXE 优先唤起当前可见窗口，避免绕过启动等待直接显示尚未就绪的游戏。

## 本轮验证

- 四个桌面 JS/CJS 文件语法检查通过。
- 自有改动 `git diff --check` 通过；`docs:check` 未通过，报告为 audio-system、performance、production 艺术文档中的既有失效证据链接，本轮登记链接未报错；未修范围外文档。
- `npx vitest run tests/desktop-startup.test.js tests/startup-guard.test.js tests/contracts.test.js --reporter=dot`：3 文件 47 项通过。覆盖显示顺序、就绪通知、错误重试、崩溃、退出、监听释放、缺失加载页面回退、DOM 就绪桥、打包清单、加载页等待/失败文案及按钮。
- Codex 当前窗口内置浏览器打开 `http://127.0.0.1:5200/@fs/D:/素材/代号柒/搜打撤/desktop-app/startup.html`，检查加载页布局、动画呈现及超过 12 秒的等待文案；这是加载 HTML 的视觉预览，未模拟 Electron IPC，不作为 EXE 实测证据。
- 城市文案/模拟进度增量：`tests/desktop-startup.test.js` 8 项通过，验证进度前进、94% 封顶、失败停表、重试重置、真实就绪 100% 与计时释放。当前窗口实页截图 [loading-progress.png](loading-progress.png)，1280×720，66% 时截取；未变更窗口尺寸，未构造游戏就绪。
- Vite 原服务已由创建会话停止，本会话按老板此前拉起网页版的授权恢复：目录 `搜打撤`，端口 5200，PID 48716，元数据 `node_modules/.cache/web-up-5200.json`；保留供老板使用。

## 未核项与交付边界

未运行 Electron 原生窗口实测；项目规则限定游戏实页使用当前平台内置浏览器。未 build、未替换现有 EXE：共享工作树存在其他会话完成未提交的游戏改动，遵守不构建他人未提交改动的边界。现有 EXE 仍需在可构建基线上重新打包才能包含本轮代码。单文件 EXE 在 Electron 启动前的自解压阶段不在本轮网页动画覆盖范围内。

改动为 `desktop-app/{main.js,preload.js,package.json,startup-window.cjs,startup-preload.cjs,startup.html}` 和 `tests/desktop-startup.test.js`；保留 main.js/package.json 原有 release-profile 与图标改动，未提交、推送。

## 通用过场增量

老板追加要求过场动画并指定通用模板。复用 `camp-entry.js` 的 `createCityCut`、`prepareCityCut`、`cityCutDuration` 与其 CSS，直接使用现有 `transition-camp-v2.webp` 雪夜城门插画，文案“城市档案 / 进入城市”。未生成或更换共用图片，未复制切幕模板。

新增 `game/src/ui/startup-transition.js` 及仅承载窗口边界/等待姿态的 `game/css/startup-transition.css`，入口在 `game/index.html` 独立模块脚本。桌面 preload 通过 DOM 状态与游戏模块交接；主进程验证 game WebContents 来源，在切幕已覆盖后切换窗口并播放980ms共用过场。普通网页不会自动触发，减少动效时直接进入；握手4500ms超时取消过场并进入已就绪首页。失败/关闭取消待定时器与切幕，迟到回调不切窗；播放期间拦截首页键盘与指针误操作，结束释放。

验证：`desktop-startup`、`startup-transition`、`page-loading`、`startup-guard`、`contracts`、`architecture-boundaries` 六文件86项通过；新增游戏模块/测试定向 ESLint、桌面语法、自有 diff 空白检查通过。当前窗口内置浏览器通过开发预览真实点击“播放启动过场”，观察过场挂载及自动移除后恢复首页；再点击“定格查看”，复用工厂将动画定格320ms截图 [city-cut-preview.png](city-cut-preview.png)。预览背景是实际首页 iframe；预览构造 DOM 握手，仅验证游戏侧动画与生命周期，未将其表述为原生 EXE 窗口交接实测。截图不涉及调整窗口尺寸。

开发预览：`http://127.0.0.1:5200/dev/startup-transition-preview.html`，Esc退出定格，可再次播放。未build、未更换EXE，延续上节边界。
