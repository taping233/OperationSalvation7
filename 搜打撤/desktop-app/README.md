# Windows 便携启动

便携入口先绘制全屏壁纸，再读取和解包内嵌资源；随后衔接独立 Electron 全屏加载窗，主页就绪后进入游戏。解包器与游戏均为每次启动的独立临时目录，游戏退出后清理本次目录。

- `portable-launcher.cs`：原生首屏、六张壁纸轮播、资源读取及解包进度、启动游戏和临时目录生命周期。
- `startup.html` / `startup-window.cjs`：游戏初始化阶段的全屏加载画面；游戏 preload 发送实际阶段，进度不按时间虚增；失败提供重试与退出。
- `build-native-portable.cjs`：复用现有 7-Zip、Windows .NET Framework C# 编译器与 Python/Pillow，把生产目录、解包器和壁纸封入单个 EXE。壁纸从现行 WebP 转为 JPEG，生产游戏目录中的 `startup-wallpapers/` 同时供加载窗使用。

在已有本地构建依赖的 Windows x64 环境，从本目录运行 `npm run dist`。流程为游戏构建 → Electron 目录封装 → 原生便携封装 → 实际 EXE 双启动资源检查 → 本地交付。`npm start` 的游戏构建步骤也准备加载壁纸。该入口不执行远端发布。

无预置存档版本需在隔离构建副本中提供新的 `release-profile.json`，其 directory 符合 `codename7-clean-*`，并确认对应 APPDATA 目录从未存在；正常使用后仍保留本包新建的存档。不要删除旧版本用户资料来制造空档。

2026-10-27 的包与验证边界见[交付记录](../docs/evidence/2026-10-27-startup-portable/README.md)。原生弹出耗时及全屏交接需实机核验，内置浏览器画面预览不代替原生首帧验收。
