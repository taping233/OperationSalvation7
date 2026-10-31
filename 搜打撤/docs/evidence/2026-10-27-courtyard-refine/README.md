# 庭院工具栏精简与环境偏好

2026-10-27，Friday；完成未提交。

## 现行行为

池塘占满页面宽度，操作收拢为下沿工具栏。环境设置向上展开，不改变水面尺寸；保留键盘投喂按钮、水面点击投喂、发现与吃食反馈。删除空景观导航、隐藏的重复庭院标题、旧 rain/koi 视图状态与导航参数、相应动画选择器，以及已由庭院正本维护的雨层历史 CSS。池塘本身使用独立叠放边界，工具栏和展开设置在其上方，真实点击不穿透水面。

雨开关、雨势、配色、声音意愿通过已有 storage.js 保存到本机 sdt-courtyard；所有档位共用界面偏好，不修改基地存档。暂停及发现计数仍为本次页面状态。关闭雨会保存声音关闭；离开释放声音但保留开声意愿，下次进庭院尝试恢复，实际出声受浏览器播放权限影响。错误JSON/无效字段回到安全默认值；存储失败仍可操作并显示未保存。

## 验证

- 4文件36项定向测试通过，无跳过：hub-courtyard-v3、courtyard-lifecycle-deep-audit、navigation-motion、surface-motion。含偏好跨挂载、损坏JSON、配额失败、声音释放与恢复。
- 本轮JavaScript ESLint、庭院CSS Stylelint通过；git diff --check通过。
- 当前Codex内置浏览器 http://localhost:5200/，当前窗口1280×720（未设置尺寸覆盖），真实点击进入城市→档位01→基地→庭院。
- 真实点击设置大雨/苔绿/声音开/暂停，返回基地再进入：大雨、苔绿、声音开启状态恢复，暂停重置。关闭雨后刷新并重新进入：停雨、大雨与苔绿恢复，声音关闭。声音检查覆盖控件状态与单测音源生命周期，不作听感结论。
- 真实点击投喂反馈成功，吃食计数增长。设置展开/收起、水面高度稳定，展开面板点击生效。验收末恢复细雨/冷灰/声音关/雨开。
- 首帧起100帧采样水面clientHeight始终752、画布height始终503，详见entrance-trace.json。控制台error/warn为空；临时采样变量已清除。
- 截图toolbar.png、settings.png来自当次内置浏览器。未运行build、全量或多尺寸；复用5200服务，未启停，未提交推送。

## 范围与建议

本轮仅改工具栏与偏好，没有改池塘底图、鱼绘制或雨模拟。美术建议按雨圈强度与分布、鱼的水下融合、少量岸边层次推进，属于后续候选。

自有范围：game/css/base-courtyard-v3.css、base-framework-v7.css的两处旧庭院选择器、feedback-oct12.css的旧雨层规则；game/src/hub/hub.courtyard-v3.js、hub.courtyard-runtime.js、hub.navigation-v7.js、courtyard-vendor/SOURCE.md；game.hub.runtime.js仅庭院viewKey/变量/调用/分支；game/src/ui/navigation-motion.js、page-motion-profiles.js庭院选择器；tests/hub-courtyard-v3.test.js。保留game.hub.runtime.js他会话已有人员生命周期与复原反馈改动。前轮庭院高度修复继续保留。