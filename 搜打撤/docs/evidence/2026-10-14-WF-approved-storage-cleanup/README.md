# 获批优先清理约4.8GiB

老板明确授权仅清理上一轮建议优先处理的8项，要求先保存旧工作树四份独有验收报告及记录、不影响网页版、其他不动。已完成；删除原文件合计约4.814GiB，另存48件共13.42MiB。项目清理后文件逻辑大小约10.46GiB；执行时其他会话仍可写入，其变化不归因于本次清理。

## 保存与恢复

四份独有验收报告和44份忽略记录已复制至本目录 `preserved/`，保留原相对路径；复制前后及删除后逐件SHA256一致。来源、保存位置、大小、哈希和获取方式见 [保存清单](preservation-manifest.json)。保存目录为本地档案，由本目录 `.gitignore` 排除；未上传或提交，超过1MB的报告不进Git。

旧工作树原HEAD为 `2d1e7d9af7fe03a513a4e6c076a10ae278806c4a`，已核对为GitHub主线 `3d02437e4c3cf6fb4a55f8a05b409932ec35daae` 的祖先；删除前源码、暂存区无改动，非忽略未跟踪文件恰为已保存的四份报告。旧分支保留，使用Git工作树删除命令移除指定工作树及其自身登记，没有清理其他工作树或Git历史。

## 固定删除范围

以下路径均相对于 `D:/素材/代号柒`，已核对最终绝对路径留在该工作区内；目录使用原生PowerShell按LiteralPath删除，工作树由Git管理删除。全部目标清理后均不存在。

- `.tmp/package-exe-1005`
- `.tmp/friday-cloud-review-integration-20261014`
- `搜打撤/desktop-app/dist/experience-20261014`
- `搜打撤/desktop-app/node_modules`
- `搜打撤/desktop-app/game`
- `搜打撤/node_modules/.cache/exe-fix-1014`
- `搜打撤/node_modules/.cache/electron-v44.1.0-win32-x64.zip`
- `SoudacheGodot/.godot`

## 验证边界

执行前检查目标无进程使用，Godot未运行；网页版5200始终保留原PID23856，无重启。清理前后入口、main.js、成就模块、照相馆入口模块、PNG图标及WebP立绘六项HTTP请求均返回200。11件保护文件（运行入口、关键模块、包清单/锁、Vite配置、网页版依赖清单、旧音乐版EXE）SHA256前后一致。该检查验证服务、资源响应及所选文件；未重新进行完整玩法验收或构建。

旧音乐版EXE、运行交付ZIP、卡牌总录渲染资料、观察快照、音乐分轨/母带、素材原稿、主项目依赖及其他Git历史均不在删除范围。完整前后数值、逐项目标与检查结果见 [删除收据](deletion-receipt.json)。无提交或推送。
