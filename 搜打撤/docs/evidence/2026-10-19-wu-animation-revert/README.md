# 无战斗动画回退

后续完成：2026-10-19执行权限环境变更后，沿用老板已批准的两目录和220文件清单重新核对全部SHA，使用原生PowerShell删除并复核目录不存在，见[完成回执](deletion-completed.json)。下文删除受阻描述为先前时点，现已解除；运行回退与目录删除均完成，未重新通知已归档会话。

老板要求恢复上一版并删除失败试做，随后明确批准两个目录清单。原制作会话“查找 Codex 骨骼动画项目”（01a1503e-cc98-78e1-be24-0f2648a5b75d）最后一轮已明确停止；老板要求不通知并归档，归档接口已确认archived=true。

已恢复`game/assets/portraits/battle/wu.webp`、`game/assets/portraits/frames/wu/sprite-v1/neutral.webp`与`animations.json`。安装前备份与HEAD核对：两张图逐字节相同，动画JSON语义相同、换行不同；恢复采用HEAD原始字节。恢复后SHA256再次与目标核对一致。上一版为待机72帧、普通攻击10帧、受击8帧、死亡21帧、施法1帧；51个不同帧引用存在。清单移除62条rig-v1与本版新增battle条目，恢复旧neutral/动画元数据，其余1614条逐项保持。

`tests/battle-wu-sprite.test.js`3项通过。当前Codex内置浏览器5200仍可显示标题页；没有进入真实战斗，不宣称完整战斗实页通过。网页版服务保持。未build、提交或推送。

未完成：批准删除的`game/assets/portraits/frames/wu/rig-v1/`（62文件）和`game/art-source/characters/wu-battle-rig-20261019/`（158文件）仍存在。初次脚本调用未清除目录，已复核实际存在；后续显式递归删除被自动审批拒绝，原因`blocked by policy`，停止删除且没有绕过。`receipt.json`的ok=false表示整项删除未完成，runtimeRestored=true表示游戏引用已经回退。删除清单与原始哈希见`plan.json`、`execution-plan.json`；原制作证据作为历史保留。
