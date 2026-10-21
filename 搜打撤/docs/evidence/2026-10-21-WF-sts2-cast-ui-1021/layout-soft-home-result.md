# 轻退焦与首页白边

按老板最新要求，注能和发现从完全虚化调整为隐约可辨的背景：blur 7 px、背景 opacity .72、暗罩 `#050d1766`。注能恢复舞台内静态单位，单位与场景同在被退焦的 arena 中；overlay 直属 frames/front 仍暂停，避免再次盖住主卡。冗余文字不恢复，三个选择态 JS 沿用上一轮最终字节。

两张模式 CSS 的逐字节副本在 `layout-soft-source/`，其 manifest 为：

- `game/css/battle-infusion.css`：`f8bcfb20db8494a0400c55d4b79549f8ba7bbd914f0c228a3e97114ac3975ca3`
- `game/css/battle-discover.css`：`94e61845f0cbfbd192a848124b0d8ac254c03164417c41e24ceaa52b2bfcac81`

首页白边仅修改 `game/css/home-polish.css`。编辑前 scoped handoff 覆盖该文件和 title-p0/home-scene 基底，退出 0，相关变更和编辑占用均为 0，跳过元数据提示未据此推断其他占用不存在。未编辑性能会话持有的入口或启动文件。

白边来自现行后加载规则的外层浅白伪元素、内层 inset 1 px 露边，以及指南/收藏边线。修复在这些现行规则内移除白色边线和闪线，保留按钮尺寸、位置、卡片底色及点击逻辑；键盘 focus 使用冷蓝柔光和已有底光反馈。首页完整字节在 `home-border-source/`，SHA256 为 `8d48ee70d80d4076507f361c2fbeacc0182ec75138070d26339992e32e70094a`。

实际验证：轻退焦 CSS 定向契约 1 例通过、41 例未选取，退出 0；现有 css-asset-minification、home-menu-motion、title-resource-review 三文件 15 例通过，退出 0；相应自有 diff-check 退出 0。未新写低影响 CSS 镜像测试，未构建、启服务或操作浏览器。

父会话保持当前战斗选择态，仅同步模式 CSS 复验轻退焦；首页由父会话稍后在当前内置窗口截图。上述测试不代替实际视觉验收。共享登记由父会话统一处理。
