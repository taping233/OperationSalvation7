# 庭院局部美术升级

2026-10-27，Friday；完成未提交。

## 改动

- 庭院雨层改用池塘水域的分区随机落点，解除旧小雨台中央菱形落区；细雨18滴、大雨36滴，初始自动圈6个。自动雨圈单圈、低透明度，点击反馈双圈；旧透视雨台模式保持原投影与粒子数量。
- 降低雨层整面深色覆盖，保留底图石纹与岸边颜色。锦鲤采用三档固定深度，按深度调整整体透明度、青灰水色覆盖与投影距离；沿用当帧轮廓复用，不消耗新随机数，不改变鱼身尺寸、游动、投喂与发现逻辑。
- 底图画布在四处近岸位置增加少量苔色、落叶和接触阴影；仅随底图加载或尺寸变化重绘，复用原画布，无新帧循环或素材请求。底图文件保持原样。
- 保留前轮底部工具栏、环境偏好与入场高度修复。

## 验证

4文件42项定向测试通过，无跳过：courtyard-koi、courtyard-rain-tableau、hub-courtyard-v3、courtyard-lifecycle-deep-audit。新增覆盖检查细雨数量、落点横纵分布、低亮度、缩放点击位置和大雨数量差异。第一次分布检查发现纯随机18滴纵向覆盖不足，改用分区内抖动后通过。

本轮JavaScript与测试ESLint通过，git diff --check通过。未执行build、全量或多尺寸。

当前Codex内置浏览器 http://localhost:5200/，当前窗口1280×720，真实输入进入城市→档位01→基地→庭院；核对细雨、大雨、投喂、发现、吃食计数及关闭/开启雨，实际发现1条、吃食1次；控制台error/warn为空。截图after.png、heavy-rain.png、dry-pond.png来自该窗口，分别覆盖细雨最终效果、大雨投喂和停雨。验收末细雨/冷灰/声音关/雨开。未进行听感或性能提升结论。

自有范围：game/src/hub/courtyard.rain-tableau.js、courtyard-vendor/KoiPond.js、courtyard-vendor/SOURCE.md、hub.courtyard-runtime.js的drawBackdrop岸边绘制、tests/courtyard-rain-tableau.test.js；runtime其余修改属于前轮环境偏好。复用5200服务未启停，未提交推送。