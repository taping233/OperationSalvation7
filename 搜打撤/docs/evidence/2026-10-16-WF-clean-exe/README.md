# 独立空存档 Windows EXE

2026-10-16，Friday，聊天 01a144bf。老板明确要求在免注能修复后打包一个独立运行、清空存档的 EXE，并要求不再测试。

成品：`desktop-app/dist/clean-20261016/搜打撤-代号7-空白存档.exe`。Windows x64 便携版，内置 Electron 44.1.0 与游戏生产资源，双击即可运行，无需 Node 或开发服务。二进制不进 Git，大小与 SHA256 见本目录 `artifact.json`。

## 存档方式

本次发行内置 `release-profile.json`，目录名为 `codename7-clean-20261016-221742`。桌面外壳在 Electron ready 前将 userData 和 sessionData 指向该独立目录；首次运行没有旧存档，随后正常保留新版进度。原桌面版与网页版存档未读取、删除或迁移。

## 打包方式及范围

从当时工作区复制至 `.tmp/clean-exe-1016/project/`，覆盖本会话完成的免注能公共判定、全场材料查询、直接结算与预览保护。本快照为当前工作区生产输入，不代表已提交版本。

Vite 仅在隔离副本生成清单和游戏产物；Electron 打包使用副本中的桌面依赖与 `desktop-app/game`，输出至本次独立目录。未使用会清理旧发行包的发布脚本，旧包、共享构建产物、现有服务与存档均保留。

构建命令：隔离项目中 `node ../../../node_modules/vite/bin/vite.js build --config vite.config.js`，随后隔离 desktop-app 中 `node node_modules/electron-builder/out/cli/cli.js --win portable --x64 --publish never`。两个打包阶段最终退出码均为 0。原始日志留在 `.tmp/clean-exe-1016/vite-build.log` 和 `.tmp/clean-exe-1016/project/portable-build.log`。

依老板要求未再运行测试、lint、浏览器战斗验收或 EXE 启动验收；不宣称最终修复已测试通过。产物按 Electron portable 目标生成，独立运行行为尚未实际启动复核。未暂存、提交、推送或发布。
