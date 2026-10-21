# 2026-10-21 独立无预置存档便携 EXE

已交付 `desktop-app/dist/代号柒-v0.60.0-便携无存档-20261021.exe`，304,385,279 字节（290.28 MiB），Windows x64 单文件免安装。SHA256：`fa74c44bed810e4e6e5adf70a31179424049417aef58e0ca6fcfd5f0c854e895`，复制校验见 [delivery.json](delivery.json)。本轮未提交、推送或发布。

包内不携带玩家存档、留言或浏览器资料。现有外壳通过本包独立配置使用 `%APPDATA%/codename7-clean-20261021-c5f24112b3cd410f`，交付检查后该目录仍不存在，首次启动从空档开始，正常游玩后可保存。旧版资料和旧包保留。便携指免安装单文件；运行后的存档写入上述系统用户目录。

## 构建与预算

从2026-10-21 18:22当前工作树复制3,033项运行输入到根 `.tmp/portable-clean-1021/project/`，包含当时未提交内容，不在共享源码树构建。初始输入见 [snapshot.json](snapshot.json)；老板随后明确要求体积预算提高50%，将预算文件同步进副本后重建，最终输入清单为根 `.tmp/portable-clean-1021/final-inputs.json`。其他游戏逻辑保持复制时点。复用已有Electron 44.1.0、electron-builder 26.15.3及本机缓存，无下载或安装。

所有七项构建字节上限在前值基础上提高50%：入口360→540 KiB、首屏JS 410→615 KiB、战斗104→156 KiB、叙事50→75 KiB、CSS 230→345 KiB、包体220→330 MiB、重复资源904→1356 KiB。启动数量及运行时图片保留上限保持原值。代码唯一来源为 `game/src/core/performance-budgets.js`，现行说明同步至 `docs/performance.md`，对应基线测试已更新。

最终 `npm run build` 含剧情编译、数据校验、Vite生产构建及预算检查通过；包体218.03 MiB，入口gzip 365.1 KiB、首屏JS gzip 413.6 KiB、战斗64.2 KiB、叙事31.0 KiB、CSS 227.4 KiB。原预算首轮失败记录保留于根 `.tmp/portable-clean-1021/vite-build.log`，最终日志为 `vite-build-final.log`。两份预算定向测试13项通过，日志为同目录 `budget-tests.log`。未跑全量测试或远端CI。

## 包完整性验证

- [生产资源检查](production-summary.json)：1,692个产物、525处静态引用与18项别名均无缺失；全部文件GET/HEAD字节核对及12项范围读取检查通过，无玩家数据文件。
- [封装检查](asar.json)：外壳与独立配置字节一致，实际封装1,690项游戏资源与生产清单一致；两个空占位文件由打包器省略，无资料目录混入。
- [便携启动器双启动检查](portable-verification.json)：实际交付EXE在Node模式两次独立解包，后启动退出后前一份1,690项资源仍完整，两个启动器均正常退出；没有启动本包游戏资料目录。

本轮未做内置浏览器实玩、原生Electron游戏窗口或耳听音频验收；上述检查不代表整局游戏通过。没有创建预览服务或修改其他会话服务。

原始副本、构建日志、详细生产清单及中间包留在根 `.tmp/portable-clean-1021/`，不进Git。EXE按上方交付路径获取并用SHA256复核；重新核验可运行 `node desktop-app/verify-portable.cjs <交付EXE绝对路径> <报告路径>`。
