# 桌面启闭与资源读取修复

<!-- cleanup-status-20261019 -->
> 2026-10-19清理后提示：本报告及本目录附件记录当时状态，其中提及的旧资源、旧音频实现或旧交付路径可能已按批准清单删除。“保留原文件/保留旧包”不代表今天仍可访问。当前保留包、替代入口与执行回执见[清理后状态](../../CLEANUP-STATUS.md)；下文历史验收结论与原始内容保持。


关闭异常已有可复现的原因与修复：原 `closed` 回调读取销毁后的 `BrowserWindow.webContents`。测试模拟原生 getter 销毁后抛错，旧实现抛出 `Object has been destroyed`，修复后清理通过。事件对象在窗口存活时保存，失败、重试和延迟回调增加销毁边界守卫。

截图中的“资源加载失败”由启动看护捕获 SCRIPT/LINK 错误后显示。旧包无持久请求日志，未捕获截图中具体失败的 URL；不能把某个字体类型或请求中转推定为已证实的唯一原因。本轮替换 Electron 封装层的资源读取路径，不修改游戏前端：原 `net.fetch(file:)` 中转改为直接打开包内文件并返回流，明确 CSS/JS/字体 MIME、HEAD、音频 Range、错误状态与本地缓存策略；保持 `app://sdt` 和原存档来源。真实失败提示保留。

## 交付

- EXE：`.tmp/exe-errors-1018/delivery-fixed/搜打撤-代号7-修复版-20261018.exe`，287814417 字节，Windows x64 免安装版，版本 0.60.0。
- SHA256：`58439159bfd8abd4ae1648c803c9598ceceeb10598b861da86ac425664bc5325`。
- 获取方式：在保留的 `.tmp/startup-fix-1018` 冻结游戏产物基础上，仅替换本轮桌面主进程、协议和窗口生命周期代码，用现有 Electron 44.1.0 / electron-builder 26.15.3 及本机 NSIS 缓存离线封装。未安装依赖，旧 EXE 保留，不包含他人在途素材/事件修改。命令及冻结来源见 `.tmp/exe-errors-1018/{prepare.cjs,build.ps1,release-inputs.json}`。
- 二进制只在本地保留，不纳入 Git；清单见 [包验证](package-verification.json)。

## 验证

- `npm run test:target -- tests/desktop-startup.test.js tests/desktop-file-protocol.test.js tests/startup-guard.test.js`：3 文件、52 项通过。新增覆盖销毁后关闭、延迟加载拒绝、字体类型、中文路径、查询参数、音频单段/后缀 Range、非法请求及缺失文件。
- Node 语法检查、相关测试 ESLint、自有 diff 检查通过；docs:check 552 链接通过（收官新记录后复核）。
- 无窗口 Electron 主进程执行新包 `app.asar` 的实际资源处理器：1526 个文件全部经真实 `app://sdt` 协议读取，状态与原始字节无差异；带版本查询 CSS 返回 200，音频 Range 返回 206/32 字节，TTF/WOFF2 类型明确。关闭回调销毁模拟通过，见 [后台回归](after.json)。
- 静态资源 URL 审计：465 个引用、4 个已验证别名，缺失 0，见 [引用报告](asset-references.json)。
- 新包 9 个应用文件核验，游戏 1526 文件/212699680 字节与旧冻结产物逐字节相同，13 个运行时资源核验；builder 退出 0。

## 覆盖边界

老板明确要求后台处理；未运行游戏前端、原生打开关闭或实玩验收，截图所示失败的原生复现与修复后的画面尚未核验，不能据后台通过宣称该截图场景已经实测消失。最初 Computer Use 启动尝试被老板 Escape 中止，此后未继续桌面操作。

本轮未重构建游戏，无改变已有五项性能预算失败的门槛或结论。首次沙箱内打包 EPERM 失败后，获准在沙箱外重打到全新目录并成功；失败目录保留。源码与证据完成未提交，无推送，无本轮遗留服务/端口/后台进程。
