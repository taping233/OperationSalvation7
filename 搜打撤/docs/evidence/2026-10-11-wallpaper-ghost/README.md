# 只看壁纸隐藏底部滚动装饰

2026-10-11，Friday / Codex。老板要求只看壁纸时取消主页下方动画。

在 `game/css/title-p0.css` 的 `wallpaper-only` 规则中隐藏 `.home-ghost`，底部 CODE NAME 7 滚动字层随纯壁纸模式移出渲染；恢复界面后重新显示。保留工作树既有首页修改。

验证：壁纸定向测试 5/5 通过。Codex 内置浏览器 `http://127.0.0.1:5200/` 当前窗口 1280×720，按钮真实输入进入只看壁纸并恢复：纯壁纸时 display=none、字层及轨道宽高为0、轨道transform=none；恢复后 display=block、字层1280×720、轨道重新出现位移。浏览器error日志0。原始结果见 [checks.json](checks.json)，纯壁纸截图见 [wallpaper-only.jpg](wallpaper-only.jpg)，DOM快照已通过 workflow browser import 导入。

复用现有5200服务，无新服务、build或提交；仅验当前窗口与第一张壁纸，未做多尺寸或全量验证。
