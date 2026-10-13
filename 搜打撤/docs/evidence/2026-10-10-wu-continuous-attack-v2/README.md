# 无攻击动画接班 · 2026-10-10

本轮承接Codex对话“瘦一点右侧大腿”（01a1222f-7859-72f1-81d8-7452a3a92f9b）的攻击制作。老板最新反馈为身体动幅太小、观感不好，可以参考其他游戏攻击并加速、模糊关键帧。旧对话已中断，原连续攻击候选保留只读，新版在`game/art-source/characters/wu-slim-sprites-20261010/continuous-attack-v2/`独立制作。

## 改动依据

旧版躯干最大前倾约1.7度，重心前移5像素；新版蓄力与命中间重心移动44像素、躯干转动约22度，加入膝部屈伸、头发与空手跟随。举剑→前挥→收回顺序、小臂先转、大臂随后跟进、刚性同型长剑及两倍待机保持。

参考[Skullgirls动画师GDC讲解](https://www.gdcvault.com/play/1020017/Animation-Bootcamp-Fluid-and-Powerful)对关键姿势、预备动作和时序的讨论，以及[Dead Cells美术作者Thomas Vasseur的制作说明](https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-)先确认关键姿势和节奏、再加过渡与效果的做法。本版据此将主挥击集中到3帧，命中姿势停留后再缓慢收回；只在高速剑刃加少量拖影。这是制作取舍，不是对其他游戏具体动作的逐帧复制。

## 验收范围

- Codex内置浏览器`cua`，当前窗口；地址为`http://127.0.0.1:5200/art-source/characters/wu-slim-sprites-20261010/continuous-attack-v2/index.html`，复用已有5200服务，未创建新进程。
- 使用真实按钮/滑杆输入逐帧查看蓄力、挥剑、命中、收势、首尾；正常速度循环，攻击后回到两倍待机。没有改窗口尺寸或使用外部浏览器。
- `windup.png`、`swing.png`、`impact.png`记录对应动作。最终完整页面截图为`preview-page.png`。截图仅证明所示姿势，连续性还以逐帧检查、正常速度播放观察及导出像素检查为依据。
- `geometry-validation.json`记录241点几何检查；`validation.json`记录36攻击帧、72配套待机帧、脚底与端点像素一致、命中姿势停顿、手部银白发束颜色检查。颜色检查不是通用分层正确性证明，仍配合手腕与袖口目检。
- 仅新增独立动作预览；没有修改正式战斗加载器、运行帧、玩法数值。未验证正式战斗、受击和死亡，也未获得老板对新版观感的确认。无build、无提交。

导出来源、逐文件SHA256及超过1MB本地二进制路径见资产目录`receipt.json`；源ZIP由当前内置浏览器页面的“导出攻击帧”按钮生成。
