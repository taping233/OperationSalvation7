# 照片原图探针离场清理（已实施，待父实页与消费者审定）

P3：照片大图进入140ms（照相馆atelier为420ms）后会另建Image升级原图。原实现把探针仅存在启动timer的局部变量，关闭只取消尚未启动的timer；已开始的原图加载/解码没有清理入口。连续浏览不同慢图时，会保留无用在途探针及其完成回调。原有closed守卫阻止串图，这不是已证明的永久泄漏，也没有测得实际浏览器堆或网络字节。

## 原始证据

- 路径 `game/src/ui/ui.js` 原450–467行
- 真实showCardZoom隔离2例：连续12张各开140ms并立即关闭，DOM/定时器已清，但12个不同原图probe仍有原src且解码待结算；旧decode迟到不能改新图
- `photo-probe.log` 为修前输出；`photo-probe.before.js` 存档原现状断言，不作为修后通过契约
- Image与待解码是可控替身。没有把这些对象数当成实测下载并发量、永久内存泄漏或底层解码取消率

## 实施与边界

仅改ui/ui.js，增28行、删6行：以可清空记录持有probe、dialog和显示图；close先清记录内DOM引用、解绑probe的load/error并对probe置空src作最佳努力取消，不修改已显示缩略图。完成回调只绑定可清空记录，旧close和迟到decode不能访问新probe。成功提交后释放记录而不清原图src；失败维持低清回退。

Image.decode没有标准abort API。此补修释放本层引用与事件并尝试中止无用资源，不能承诺浏览器底层已开始的解码立即停止。

正规专测 `tests/photo-probe-lifecycle-deep-audit.test.js` 8项，覆盖12次开关、入场timer前关闭、成功升级、失败保低清、旧close不取消新probe、迟到decode不串图、无decode环境的load/error解绑及成功升级。自有证据配置导入同一正规专测。

## 验证与指纹

- 新专测8项全过，`photo-probe-after.log`
- 新专测、原照片弹层、照相馆生命周期、演出生命周期、无障碍静态契约、contracts/architecture：7文件89项全过，`photo-regression.log`
- Node语法、精确ESLint、自有diff whitespace通过；`photo-lint.log` 空输出且exit0
- ui.js修前SHA256：e40a8eac1adb5e3a834a417c174a5d2513eadab5d55bf0b07804bd1e87b3d6a1
- ui.js修后SHA256：8a1eb7d22e5fea5bb874aec022f240c090e550da8192093f5d42ab64c7fb642d
- `scripts/runtime-asset-redundancy-review.mjs:269` 固定了旧ui.js消费者指纹。未盲更新；交由父任务审查此增量后决定刷新
- 未操作浏览器、实际存档、服务、build或提交；照片显示/真实快速浏览实页由父任务验收

本批与 `COURTYARD.md` 的庭院P2分开实施及记录；全部最终源码/新专测SHA见 `source-fingerprints.json`。
