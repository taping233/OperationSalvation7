# 地图与通行接班

2026-10-13，Friday / Codex，聊天 01a133b8。状态：定向实现与构造页复核完成，待主协调真实对局复核。老板直接确认旧聊天已结束，授权开始；已用聊天状态核对旧聊天 idle，最后答复为“全部现有改动与现场保留，后续工作停止”。计划中的 map-handoff-to-new-chat.md 未生成，本轮以现行源码、map-replica.md、map-contrast.md 和真实参考图接班，不覆盖已有成果。

## 属地与参考

源码只改既定地图展示、镜头、纯路径 helper、moveTo 事务和地图点击确认；resolveCell 以下及其他启动逻辑归主协调的其他代理。根 REGISTRY/PENDING 仍由主协调维护。不开停服务、不构建、安装、删除、提交或推送。

已实际通过 view_image 查看 reference-images/arknights-is3-map.png、arknights-is6-node-detail.png 和旧版27/14实页。沿用旧六类手绘 WebP；现行源码已去普通节点实心承托、缩窄标签、画白/青/灰分级曲线并恢复原头像。老板否决的旧27图仅作为返工前对照，不能作为本轮通过证据。

## 本轮实现与验证

已修：抵达阶段预览改为“已抵达”与当前位置状态；动画收尾主动刷新预览，避免继续显示“前往中”；地图几何失效时释放本事务的移动状态，不提交过时终点。保持每格回合/探索写入、逐格稳定保存、原 visited 消耗规则和终点独立节点页。

初次7文件定向测试因沙箱 realpath EPERM 未运行任何测试；按原命令在沙箱外运行，90/93通过，3项失败为旧移动 fixture 缺失 UI.beginRoom 等新节点页接口。本轮更新对应 mock 为生产的终点 modal 页行为，并补几何失效、后台看门狗、稳定落点保存与抵达预览检查。后台测试第一次未正确暂停假时钟的rAF，修正fixture后，13:39最终7文件95项全部通过；无跳过失败项。

内置浏览器仅本聊天自建的 map-replica.html 构造页，1920×1080；复用5372的/@fs/读取现行源码与真实样式，不导入 Game、不读写存档或音频。主协调5372/5373 tabs未操作。构造演示只证明共用曲线、路线点亮和头像的呈现；真实开局、点击移动、读档由主协调同步冻结副本后复核。

测试命令：`npm run test:target -- tests/map-travel-path.test.js tests/map-travel-motion.test.js tests/expedition-view.test.js tests/map-node-state.test.js tests/camera-interaction.test.js tests/contracts.test.js tests/architecture-boundaries.test.js`。覆盖确定性路径、未知/未处理内容/门/跨层中间点阻断、pending入城补给覆盖与不改逻辑类型、共享曲线插值、每格探索与稳定保存、双击移动锁、旧回调中断、后台看门狗、减动效与终点独立节点页。两份本轮源码node --check与目标diff --check通过，仅原有CRLF提示。

构造页实际输入：选择商店、不可达节点、空白路线终点、通行演示、通行中段截帧；未处理物资挡住终点、消耗后允许形成路线；演示抵达变“已抵达”、进入动作变“查看本地内容”、工具恢复可用。中段截帧是明确构造状态，不是生产移动事务。商店详情530×340，x1354/y152.8；地图/详情均加载原shop手绘图，视口与页面scroll尺寸均1920×1080，控制台error/warn为空。

对照板：[map-final-contrast.html](map-final-contrast.html)，原图本体未加工。截图取自本聊天Codex内置浏览器tab.screenshot原图，无图像加工；上方测试按钮与底栏替代图标只在fixture中。map-moving-fixture-1920.png捕获的是演示起始旧帧，不作为移动证据；正式证据使用map-midpoint-fixture-1920.png稳定构造帧。所有本轮截图小于1MB。

主协调同步既有地图7份源码和map-travel-path.js、game.boot.js地图点击、game.run.flow.js的moveTo增量；本轮新改源码仅expedition.view.js与moveTo内部，未改resolveCell及其后续。现有renderer/map-node-art的去底板与头像实现是旧聊天保留成果，本聊天复核与补齐状态收尾。完整game.run.flow.js仍可能有其他代理的下半部增量，不能覆盖式同步或整文件回滚。

未覆盖：真实对局的入城补给领取、全四层/祭坛/首脑、完整刷新读档链、实际音频、长期帧率与性能对比；未提交和未推送版本无远端CI覆盖。完成未提交，根登记销账由主协调维护。

交付指纹：[map-continuation-fingerprints.json](map-continuation-fingerprints.json)，记录本轮交付时源码/测试/截图的SHA256与mtime。docs:check通过（只覆盖现行导航与根说明）；本对照HTML的8项本地图片/链接已另行核对可达。图源超过1MB时沿已有原图来源与指纹记录，不入git；本轮截图均不超过1MB。
