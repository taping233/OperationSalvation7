# 共用界面动画的后台暂停归属

`home-linked-interactions.js` 原先将 `pending` 一律视作应暂停的播放任务。但原生 WAAPI 的 pending 也包含尚未完成的暂停任务，其 playState 已是 paused；因此调用方刚暂停的动画会被后台管理认领，并在返回前台后错误播放。重复后台通知也会重复pause。另一个边界是后台期间换页移除目标，原先仍恢复该旧节点动画。

规范依据：[W3C Web Animations：播放状态与pending](https://www.w3.org/TR/web-animations-1/#the-play-state-of-an-animation)。pending pause的playState为paused；pending play在正常播放区间为running。

## 当前行为

- 共用入口仅认领running动画；原有手动暂停（包括pending pause）不认领、不恢复。
- 隐藏期间新建的running动画仍暂停；返回后从原currentTime继续，不重设时长/进度。
- 后台/前台边界遇到已脱离DOM的自有运行/暂停动画，取消并从跟踪集合释放，避免旧页重新播放；调用方自己暂停的动画保持其所有权。
- 正常完成/取消仍通过原finished Promise释放；调用页面的业务提交和导航计时不变。未改CSS动画、减动效设置、时间曲线或新增框架。

## 验证

- 修复前9项新增测试中6项失败、3项通过，覆盖错误认领pending pause、重复pause与离页恢复；日志留恢复区 linked-motion-lifecycle/before-test.log。
- 修复后再补“调用方暂停且已离页仍保持所有权”测试，共10项新增测试通过。
- 集中回归10文件122项通过：linked-motion-lifecycle、photo-studio-presentation、character-view-motion、page-perf-expedition、map-decoration-budget、class-choice-lazy-entry、menu-pages-lazy-entry、base-motion-v4、architecture-boundaries、contracts。故障注入用例的offline日志为预期路径，断言通过。
- 相关ESLint、501文件语法、8配置类型检查通过。workflow review为snapshot，未命中资源guard指纹。
- 受控Animation对象按规范模拟pending/playState；不是浏览器原生绘制验证。游戏实页受现有验证码授权边界限制，本轮不等待且未绕过，真实切后台与视觉验收仍未做。
- 未构建、提交、推送；由统一发布流程冻结交付。原始日志及修改前源码位于恢复区 linked-motion-lifecycle。
