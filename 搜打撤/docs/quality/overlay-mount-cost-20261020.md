# 公共弹层挂载成本收口（2026-10-20）

## 范围

只修改公共 `game/src/ui/overlay.js`，不修改设置模板、导航、图标解析、内容安全、资源文件或 CSS。基线取任务开始时的实际工作树，不是合成 HEAD。

## 可验证的成本

1. 原开层顺序是：挂载/模式类 → 取消按钮可见性 `getComputedStyle` → 背景 inert 和 body 的 page-covered/page-opaque 写入 → 背景探针 `getComputedStyle`。现在先完成背景隔离和页面类，再查取消按钮。没有推迟交互，也没有删去可见性判定。
2. 设置等页面的首个 data-asset-key 常为 Icons.img 产生的 `img.ic[data-asset-key^="icon-"]`。它的图像由 src 加载，无需 CSS 背景探针。仅此位图类型跳过；普通 IMG（可能有 CSS backgroundImage）和场景容器仍走原检测、忙碌提示、取消和超时链。照相馆已有例外不变。
3. 首焦点只需一个目标，原实现却总计算所有顺序焦点的可见性，即使显式目标已有效。现在有效显式目标立即返回；否则先找语义安全候选并验证可见性，再找第一个有效候选。可见性缓存仍只在本次调用中；Tab 圈定仍完整读取当前 DOM。100 输入 + 返回按钮夹具中，不再调用这些无关输入的 getComputedStyle，总样式读取少于 10 次。

## 验证

在独立小副本中运行：

- overlay-dialog、overlay-disclosure-focus、global-ui-completion 既有 27 测试通过（包括 axe、fieldset/legend、details、隐藏/inert、负 tabindex、快速换页/关闭、Esc 与 Tab）。
- 新增 overlay-mount-cost 5 测试通过，包括最终背景状态先于样式读取、无关输入零样式读取、显式负 tabindex、实时失效回退、非图标 IMG 背景仍受检测。
- 同一新测试对原文件重跑：4 失败 / 1 通过，证明成本断言确实覆盖本次变更。
- ESLint 与 node --check 通过。

以上为调用顺序与调用量证明，不是真机 FPS 或耗时提升。同步 showOverlay 与首次焦点阶段应由父任务在相同真实设置界面重测；首焦点优化位于 rAF，不能将其收益宣称为同步 showOverlay 收益。

## 保持边界

不缓存权限、开关、焦点、可见性或导航状态；不减少反馈、不延后安全操作、不改变内部滚动。不改资源、资源路径、别名映射、资源守卫或其基线。最终完整资源守卫由集成者对本次 delta 审核。
