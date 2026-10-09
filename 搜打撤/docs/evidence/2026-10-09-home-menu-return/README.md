# 主页返回菜单恢复

进入基地/选人时清除入口route，旧overlay观察器因此跳过关闭后的恢复，主页按钮停在out并透明、不可点击。修复为overlay隐藏时清理入口并按主页可见状态恢复；制作名单打开时不触发恢复。

新增回归测试在修复前稳定失败（out而非rest）。修复后41/41定向测试通过（home-menu-motion、menu-recovery-entry、architecture-boundaries、contracts），定向eslint与diff空白检查通过。

Codex内置浏览器复用http://127.0.0.1:5200/当前窗口，重载后真实点击：主页→档位01→基地→整备→选人→返回整备→返回基地→存档页→主页。恢复后homePhase=rest，进入城市按钮opacity=1，主菜单pointer-events=auto；再次真实点击进入城市打开存档页并返回主页成功，捕获error日志为空。截图after.png。

未进入对局、未build、未提交、未启动或停止服务。
