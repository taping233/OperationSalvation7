# 前端演出与资源闭环

2026-10-25，Friday，WF-frontend-gap-close-1025。状态：已实现、未提交，待老板实页验收。老板沿用“不需要测试，直接做”；本轮仅进行源码读取与修改，未运行测试、lint、类型检查、构建或游戏实页，无新增服务。

## 本轮修改

- 研究所通关演出：留言与确认框提高到演出上方，留言按普通body/原生dialog选择挂载位置；演出按当前输入所有者处理Enter/空格，表单输入不翻页。被覆盖或进入后台暂停打字，减少动态直接完整显示。涉及 `game/src/run/lab.ending.js`、`game/css/lab-ending.css`、`game/css/interface-components.css`、`game/src/ui/menu-feedback.js`。
- 输入与焦点：新增 `game/src/ui/input-isolation.js`，多个所有者共同隔离的元素只在最后释放时恢复；`dialog-surface.js` 与 `card-zoom-controller.js` 接入。特写的晚退场回调核对来源页版本、当前输入所有者与当前焦点；旧回调不清除新特写的body状态。`screen-owner.js` 保留被覆盖所有者，解除覆盖后恢复参与仲裁。
- 照相馆缩略图：`game/src/hub/game.cardslib.art-warm.js` 增加2500毫秒截止、失败/超时标记、延迟350毫秒的一次重试，最多4个活动任务。旧会话取消清空任务、重试与队列，不能修改新页；超时解码记录释放旧DOM引用。截止后释放任务位不代表浏览器已中止不可取消的解码。
- 公共浮层：`game/src/ui/interface-motion.js` 按同一正文容器复用媒体/循环活动观察，避免每次showOverlay重新枚举与登记。
- 留言信箱：`game/src/ui/menu-feedback.js` 每页最多挂载20条；全部导出保留全量记录，分页不改变原记录索引。换页归零滚动并补失效焦点；完成/删除仍走公共区域更新。

当前公共API说明同步至 `docs/ui/shared-interface-components.md`。官网经验对照见[接入盘点](./arknights-adoption.md)。保留其他会话活跃属地及既有未提交改动；未删除文件、提交或推送。

## 证据边界

本记录描述已写入代码的行为和参数，不提供运行通过或卡顿改善幅度的结论。尚未实页确认：通关演出叠留言/确认框、特写退场期间切页/新弹层、坏图/慢图队列释放及重试、超过20条留言的翻页与导出。
