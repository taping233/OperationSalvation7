# 主页选项取消流光

按老板要求，仅修改 `game/css/home-polish.css` 与 `game/css/home-layers.css`：隐藏选项轮廓环绕流光、主按钮表面扫光与悬停扫光，停止轮廓和表面扫光动画；保留原有其他未提交增量。

Codex内置浏览器访问 `http://127.0.0.1:5200/`，当前默认窗口读取实际计算样式，10个 `.home-orbit` / `.home-sheen` / `.home-sweep` 元素全部为 `display:none`。该证据验证流光层隐藏，未测试其他页面与交互；纯样式小改未新增测试、未build、未提交、未推送、未启停服务。
