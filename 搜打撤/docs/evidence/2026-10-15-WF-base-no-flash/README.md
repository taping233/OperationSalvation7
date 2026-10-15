# 基地切页黑闪修复

2026-10-15，Friday。基地内部跨房间导航被通用视觉准备流程覆盖：每次创建背景为 #10171b 的全屏 page-visual-handoff，再等待图片与帧完成后淡出，缓存命中也会闪黑。

修改 interface-motion.js：refreshHub 路径直接执行区域动效，不再调用 stagePageVisual。首次进入基地仍由专用入场流程负责；离开基地的其他整页继续使用视觉准备。

验证：surface-motion、navigation-motion、contracts、architecture-boundaries 四文件共51项通过。回归断言基地内主/子页切换同步与等待后均无遮罩，区域入场正常，离开基地仍有准备遮罩。

Codex 内置浏览器 http://localhost:5200/，当前窗口，真实点击档位01：基地→后勤→交易所→配置→收藏室→基地。各目标页 DOM 检查 page-visual-handoff 不存在、overlay opacity=1；控制台 error 列表为空。[返回基地截图](base.png)。截图仅证明最终外观；未取得逐帧录像，切换瞬间不创建遮罩由同步回归断言验证。未build、未提交。
