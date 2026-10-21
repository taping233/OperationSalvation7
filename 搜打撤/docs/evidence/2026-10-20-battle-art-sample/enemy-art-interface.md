> 状态：本轮方案已撤回，以下仅为历史记录。素材、模块与测试已移出运行目录，两处既有源码已恢复；本文不代表当前实现或已完成验收。

# 战斗敌人独立素材接口

- `battle.enemy-art.js` 只登记 `bandit`（反抗组织拾荒者）。主资源：`assets/portraits/battle-enemies/bandit-painted-1020.webp`；首次加载错误后切到 `assets/portraits/enemies/bandit.webp`，再失败则隐藏图片并以现有 `.battle-figure-fallback` 和敌人名称显示可读身份。URL 均经 `assetUrl()` 加构建版本。
- 锚点契约为 `bottom-center`，复用 `.sts-figure img` 已有的底部中心定位；父 `.sts-foe` 槽位、敌人 ID、生命/数值与点选命中区保持原路径。专用资源仅由战斗 `updateFoes` 选用，图鉴仍走 `SDT.Art.monsterArt`。未知 ID 继续走原 `SDT.Art.has/monsterArt` 或原图标兜底。
- 同一图片重复渲染只绑定一次错误监听；换图时解绑旧节点。回调核对当前 binding 与当前图片，旧图片迟到错误不能改变新立绘。第二次错误后停止换源，无重试循环。
- 验证：`npm run test:target -- tests/battle-enemy-art.test.js tests/battle-entry-readiness.test.js tests/battle-architecture.test.js tests/contracts.test.js tests/architecture-boundaries.test.js`，5 文件 81 例通过；`npm run check:syntax`，511 文件通过；`git diff --check` 通过。
- 新主资源由素材会话交付，接口测试不证明该位图内容或实页观感。当前会话未启动浏览器或服务；主会话负责在素材落盘后核对真实战斗画面及加载结果。
