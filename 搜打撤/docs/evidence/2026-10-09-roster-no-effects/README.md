# 选人界面移除特效

按老板要求移除五名角色的粒子、辉光、法阵与周期技能演出，停止创建Canvas与requestAnimationFrame绘制循环；保留原有CSS缓慢水平待机和切换过渡。

验证：46/46定向测试通过（character-idle、architecture-boundaries、contracts）；定向eslint、node语法检查与diff空白检查通过。

Codex内置浏览器复用http://127.0.0.1:5200/当前窗口，重载后真实点击进入城市→档位01→整备→确认出发打开选人页；逐一点击五个角色，每名角色的canvas/.idle-vfx数量均为0，CSS待机标记正常。浏览器捕获error日志为空，未点击最终出发；截图见after.png。

未build、未提交；未创建或停止服务。
