# 牌堆专属 CSS 与首页工具边线

新增 `game/css/battle-pile-view.css`，编辑前 scoped handoff 退出 0，新文件不存在、相关变更/占用均为 0。组件与接线由 potion_use 负责，约定根标记为 `[data-battle-pile-view]`，本子代理未修改 overlays、decision-content、view 或公共 CSS。

专属样式覆盖旧 secondary pile 的 220 px 卡宽和侧栏级联：1700×900 游戏布局坐标内使用 280 px 整卡居中网格，网格独立纵向滚动，同卡数量位于卡片右上。常驻头部仅标题与 `.battle-pile-total`，返回居中；卡牌原主题/规则保留，点击阅读使用现有 zoom。牌堆标记存在时，真实战场按 7 px / opacity .72 / 约 .4 暗罩轻退焦，直属 frames/front 隐藏以免前景盖卡。

实际检查：PostCSS 解析 21 条规则退出 0；逐行实际字节尾空白检查退出 0。新文件未跟踪，`git diff --check -- <新路径>` 不作为该文件的有效检查。JS 集成和对应回归由组件代理交付，当前窗口视觉由父会话统一验证。

牌堆 CSS SHA256：`6115f23e16a914473dcab8ea62cd3766467c118c9c0bce5ee33e78efa95fcc00`。

首页补修扩展到音效、信箱、壁纸、只看壁纸的 `.home-tool`：同一 home-polish 来源把伪元素背景改透明、内层 inset 改 0，并去掉工具内层白色 3 px 侧线。主菜单/工具键盘 focus 使用冷蓝光色反馈，未修改页面装饰边框、尺寸或点击逻辑。只改 `game/css/home-polish.css`。

现有 css-asset-minification / home-menu-motion / title-resource-review 三文件 15 例通过，diff-check 退出 0；未新增镜像测试，未构建或操作浏览器。

首页最新 SHA256：`523b9207ff0f274ee0642c852610c4a5f382f8f0e36afdf74a808a37cf8734d7`。此指纹取代此前主菜单单独去边版本，早期 `home-border-source/` 保留为历史快照，不代表本次工具补修后的字节。
