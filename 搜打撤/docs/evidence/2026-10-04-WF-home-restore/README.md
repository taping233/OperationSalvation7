# 主页恢复到 WF-home-layout

2026-10-04，老板明确要求回到本聊天上一轮交付版本。源码恢复完成未提交，HEAD 425d03920e；未刷新远端、未核全量/CI覆盖。原返修聊天已核为 idle，最后轮 interrupted，本轮按老板回退指令接管并释放旧占用。

- `game/css/title-p0.css` 恢复原样式，`game/index.html` 恢复主按钮文案及相应注释；两文件 SHA256 与原交付验证报告完全一致，见 [指纹与备份](restore-manifest.json)。
- 恢复前版本保留为本目录 `before-title-p0.css`、`before-index.html`。后续生成的 `game/assets/ui/home-v2/` 原位保留，本轮未删除资产。
- Codex 内置浏览器当前窗口实页恢复原构图，远征档案/设置入口往返正常；设置返回工具报 deadline 后 AX 已确认标题页，未重复点击。最终截图为 1183×764、DPR 1.5；过程中窗口由宿主变化，未用视口覆盖，不作跨尺寸对比结论。
- [当前截图](restored.jpg)、[浏览器证据](browser-f4846194-0e24-4b34-bc1d-adba241a1fca-snapshot.json)、[控制台](console.json)；error/warn 为 0。
- 启动定向回归 15/15 通过，输入指纹稳定：[验证报告](2026-10-03T16-28-24.332Z-d5d3f501.json)。jsdom 战斗渲染器桩提示与上轮相同，浏览器没有相应报错；`git diff --check` 通过。
- 复用既有 5200 服务，无新后台进程；无全量测试、build、提交、推送。未重新验收全部子页面、hover和长期性能。
