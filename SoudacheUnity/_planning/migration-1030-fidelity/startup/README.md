# 桌面启动片头恢复（2026-10-30）

状态：本片已冻结，完成未提交；仅源码/私有 C# 编译已核验，实际 Unity / Standalone 画面及真实输入交由主会话集中验收。本代理未运行 Unity、CUA、前台或网络。

## 当前接线

GameBoot 在 App.Launch、BattleBridge 和 RunLoopBridge 安装后调用 StartupTransition.Install，再安装 NativeDisplayReview。标题已同步构造并被共享 CurrentRunFilm 的 departure 幕布覆盖；返回标题不会重播。未改分辨率、CanvasScaler 或 ConfigureBeforeLaunch。

| 现行源 | Unity 对应 |
| --- | --- |
| main.js 导入 startup-transition；desktop-app/preload.js 的 preparing / playing，startup-window.cjs 在页面就绪、幕布准备后展示主窗口 | GameBoot.Awake 在初始化/标题构造完成后装启动幕布；同步 Resources.Load 在首次绘制前取得图 |
| createCityCut(scene: departure) → createSilentNodeCut；profile 2400ms reflection；revealTransition max(680,420)ms iris + 外层淡出 | 复用 CurrentRunFilm.Play("departure", skippable:false)，正常 2400+680ms；共用 shader / source motion；不调用会建局的 DepartureCinematic |
| 最终 silent-node-film.css：cover/center；sfReflection 左到右显影、.96→1.025；没有可见标题/城市档案字幕 | 共用已接入的 departure 图与 motion，不新增图、字幕、skip 图标 |
| startup 的 keydown capture preventDefault，cover 截获指针；没有 skip handler | skippable:false 令键盘/指针调用 Skip 均无效，仍阻止底层全局键与导航；由共享 Canvas raycast 截获点击 |
| reduce-motion 存档或 prefers-reduced-motion → 无幕布 | CurrentUiPreferences.ReducedMotion 或 Windows SystemParametersInfoW(SPI_GETCLIENTAREAANIMATION) → reduced，标题立即可用 |
| pagehide / cancelled / 旧实例 cleanup abort；装饰准备失败不阻塞主页；图片失败不等完整 film | StartupTransition.Cancel / owner 失效 / OnApplicationQuit / OnDestroy 仅取消自有 film；异常移除已构造幕布，缺图使用背景色并免2400ms dwell |

Unity 没有 Electron 隐藏主窗口/独立 splash renderer；这里只对应页面准备完成后的城市片头。未迁入 splash 加载进度、失败重试界面；本轮修复目标为独立审查第4项的缺失片头，原生启动加载阶段仍由主会话确认。

## 验证与证据

- check.py 将生产 C# 与 asmdef 复制到自有 snapshot，再用现有 Unity DLL 和本机 .NET 工具私有编译 Sdt.Boot 依赖链（UNITY_STANDALONE_WIN，覆盖 Windows P/Invoke 分支）。最终退出0、0 errors、10 warnings，警告位于已有资源 DTO/其他 UI 文件，本片无警告。没有复用旧 passed；日志见 typecheck/latest.log，输入见 snapshot-sha256.json。
- source-receipt.json 记录实际读取的源、CSS、素材、共用film与本片文件 SHA256；原 WebP 和已导入 PNG 都为1659×948，解码 RGBA 逐像素相等。
- NativeDisplayReview.Run 起始现等待片头进度达到50%，抓实际 player-startup，再等待自身 complete/reduced/fallback/cancelled，记录开始/完成时刻、耗时、profile时长、shader状态与真实显示元数据，之后才执行既有 title/card/photo/settings。没有强制分辨率或替换画面。该脚本能记录能力已编译，尚未实际执行。

待主会话验收：实际播放器的反射显影、iris/淡出、持续时间、背景窗口捕获及 shader，正常与 reduced/cancel 分支和真实键鼠穿透。源码中的 no subtitle/no skip 是合同记录，不充当真实输入或截图验收结论。Windows 系统动画开关桥接已编译，尚未做系统设置切换实验。

冻结属地：Assets/Scripts/Sdt.Boot/StartupTransition.cs(.meta)、GameBoot.cs 单行 hook；NativeDisplayReview.cs 本轮新增启动捕获/等待段已交回主会话续接其他场景。共享 CurrentRunFilm 的 skippable/WhenFinished API 由过场代理实现，本片未改写。
