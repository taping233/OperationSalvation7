# 公共前端交互组件实施

老板在官网代码拆解与首页整改后授权执行公共组件整改，并沿用不测试、直接实施的要求。本轮交付实现，实页效果待老板验收；没有运行测试、lint、构建或浏览器验收，不宣称性能或视觉验收通过。

## 已接入

- 将现有确认框样式从 `review-ui.css` 收入 `interface-components.css`，与玻璃确认浮层共用中性玻璃底、边缘、阴影和正文层级。确认框继续使用原来的模态所有权、焦点陷阱、失败提示、忙碌锁定和即时业务完成；退出动画复用公共完成器与统一时长。
- 普通浮层的常用动作、分类和返回键共用悬停/按下/焦点节奏，点击区固定；通过显式文字层接入细微位移。已接确认按钮、设置分类、指南章节/翻页和带字公共返回件。首页保留600/800ms慢悬停，快档战斗控件不套用新反馈。
- 新增 `region-transition.js`，复用目标动效与页面生命周期。设置与指南改用同一套退出、更新、准备和进入；重复请求取最新，离场取消，完成有超时兜底。设置保留分类滚动，指南保留正文和正文阅读区的每章滚动；异步恢复焦点有版本与用户焦点守卫。
- 新增 `surface-activity.js`，公共浮层每次挂载接入，关闭/替换释放。浏览器后台、遮挡、隔离或加载时，暂停本容器的媒体和无限循环；恢复只接续自己暂停的对象，已换源媒体不被旧状态启动。有限转场仍由原组件负责。首页已复用观察能力，动态偏好变化接同一入口。
- 图片准备保留既有共享任务、截止时间、页面身份与取消机制，增加显式关键图片和实际失败状态。指南位图插图声明为关键资源；长列表保留延迟加载。失败保留图框与替代文字，取消不标成失败。
- 移除旧确认样式副本、设置逐行入场与无用阶段属性；公共浮层动效样式随模块加载，避免安装后再插入样式链接。

## 源码范围

新增 `game/css/interface-components.css`、`game/src/ui/region-transition.js`、`game/src/ui/surface-activity.js`。

修改 `game/css/review-ui.css`、`game/css/settings-navigation.css`；`game/src/ui/confirm-dialog.js`、`motion-presets.js`、`home-linked-interactions.js`、`interface-motion.js`、`settings-navigation.js`、`menu-settings.js`、`beginner-guide.js`、`menu-guide.js`、`page-visual-readiness-sharing.js`、`home-fx.js`。

现行接口与接入边界统一写在 [公共界面组件](../../ui/shared-interface-components.md)，视觉规范只链接此来源。保留此前改动；避开Kimi远征四区活跃属地，未改玩法、存档或卡面，没有删除文件。完成未提交，无新服务或提交推送。
