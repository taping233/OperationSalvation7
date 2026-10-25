# 公共界面覆盖补齐

老板在源码覆盖核对后授权修复。实施范围是右键留言层、信箱列表、庭院持续效果、页内局部隐藏媒体与循环的遗漏；照片特写和战斗保留专用节奏。按老板要求未运行测试、lint、构建或浏览器验收，交付为已实现、待老板实页验收，不宣称全站验收完成或性能测量通过。

## 已实施

1. 新增 `game/src/ui/dialog-surface.js`，确认框与右键留言共用焦点循环、背景隔离、Esc所有权和焦点恢复。右键留言通过公共屏幕开合，使用公共玻璃材质、控件反馈和忙碌状态；来源变化不恢复旧页状态。原生制作名单打开时临时在其内部显示留言，隐藏完成后复位。模态语义与写入失败提示保留在表单中，留言仅按原功能保存，不产生外部发送。
2. `menu-feedback.js` 的信箱读取、错误/重试、完成标记和删除刷新统一调用 `transitionRegion`，最新请求替换旧请求；保留滚动与有效焦点，记录移除后提供同条/邻近记录的可用焦点。`data-region-managed` 排除旧的逐行入场，避免公共切换后再重播；动作文字层在导出/失败状态更新后仍保留。
3. 信箱空态插图增加关键资源声明；局部切换经 `waitPageVisual` 准备后显示，沿用截止时间、失败占位和取消边界。
4. `surface-activity.js` 增加内部隐藏/隔离/折叠状态和动态媒体的观察，暂停隐藏子面板的新播放请求；对已登记循环随局部状态暂停/恢复。媒体以稳定来源或流对象判断归属。只在实际暂停/减少动态边界发现已有原生循环，CSS循环在启动事件登记；不为普通选卡类变化枚举整页动画。
5. `hub.courtyard-runtime.js` 订阅公共活动状态，Canvas帧请求与WebAudio雨声一起暂停/恢复；手动暂停优先保留，离场释放。移除庭院重复的祖先观察与浏览器可见性监听。
6. `surface-motion.js` 避免右键留言通过公共 `showScreen` 进入后，hidden观察器又重启一次入场。`overlay-return-state.js` 的身份匹配忽略临时视觉阶段，避免局部更新的阶段变化使滚动/焦点恢复失配。

## 精确源码范围

- 新增：`game/src/ui/dialog-surface.js`。
- 修改：`game/src/ui/confirm-dialog.js`、`menu-feedback.js`、`surface-activity.js`、`surface-motion.js`、`overlay-return-state.js`；`game/src/hub/hub.courtyard-runtime.js`；`game/css/interface-components.css`；`game/index.html` 的右键留言块。
- 现行说明：`docs/ui/shared-interface-components.md`。

保留已有完成未提交增量及Kimi远征活跃属地；没有删除文件、创建服务、提交或推送。编辑释放。本文只记录本批实现范围，不能用于宣称其他独立页面已逐一完成迁移或实页验收。
