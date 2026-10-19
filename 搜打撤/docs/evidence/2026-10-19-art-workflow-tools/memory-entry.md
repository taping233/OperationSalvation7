# Task Group: 代号柒 单张皮肤接入与内置浏览器取证效率

scope: 可复用的美术接入经验；现行命令和状态查项目docs，不把本节当占用台账。
applies_to: cwd=D:\素材\代号柒\搜打撤; verified_at=2026-10-19; thread_id=01a14f3d-d115-7002-98d2-5af998ea575a

## 经验与入口

- 单张皮肤接入先定向核对`game/src/core/art.js`的`SKIN_FULL_ART`、素材清单及对应人物页；人物外观当前从皮肤目录提供可选项，不因新增静态皮肤先展开存档迁移。使用前核对源码。项目内可复用工具与边界统一见`搜打撤/docs/art-workflow-tools.md`。
- 资产审计的`paths`不是全局过滤器：它会把所选历史债重新判为错误，全局新增债仍会阻断。`--scope selected`是独立目标报告，须同时说明`global`结果；不能拿目标通过宣称全局门通过。
- 本次Codex浏览器AX把带`aria-pressed`的button呈现为checkbox；角色定位失败时读取一次DOM确认，沿DOM角色继续，不改游戏HTML迎合工具映射。取证在目标页一次保存当前窗口截图、图片加载信息与error日志，明确真实输入/静态检查覆盖。
- 原生子命令必须逐项保留退出码，依赖步骤失败即停；PowerShell后续命令成功不代表前一步成功。`tools/art-check.mjs`提供限于素材审计和显式Vitest文件的无shell执行链，不运行build或git。
- 接入工具用`tools/skin-import.py`，同请求可续跑，遇到不同内容或共享文件变化停止。完成后一次回填验证与占用；平台记忆只存这些入口和陷阱，不复制当前状态。

## 依据

- `搜打撤/docs/evidence/2026-10-19-art-workflow-tools/README.md`：工具实现、定向验证与本次复盘。
- `搜打撤/docs/evidence/2026-10-19-changwuyu-drum-skin/README.md`：实际皮肤接入；源图转换约2秒，原有外观18项测试运行4.36秒；无完整逐步计时，不推算各环节百分比。
