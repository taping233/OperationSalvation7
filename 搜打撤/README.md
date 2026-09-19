# 搜打撤 · 代号7

四层相邻节点探索与卡牌战斗结合的单机搜打撤游戏。当前 Vite 版本为 v0.54.0「冬日远征体验改造」，提供网页开发版和 Electron 桌面版。

## 快速开始

Vite 网页版开发调试在本目录运行：

```powershell
npm install
npm run dev
```

`index.html` 使用 ESM，不能通过 `file://` 直接双击运行。`npm run dev` 由 Vite 读取 `game`；`npm run build` 构建生产版。桌面启动会先构建，再读取 `desktop-app/game`。

网页版浏览器要求：Chromium 105+ / Edge 常青版 / Firefox 121+（样式层使用 `:has()` 与容器查询 `cqw`，旧内核 WebView 下部分界面样式会退化）。桌面版内置 Electron 44，无此限制。

## 常用检查

```powershell
npm test
node game/selftest.js
node scripts/check-version.cjs
npm run build
npm run perf
```

## 当前能力

- 四层相邻节点地图、单向深入、免费与紧急撤离；
- 五个独立存档、基地、仓库、背包、安全格、职业熟练度、成就和卡背；
- 普通战斗、BOSS 牌库战、词条时点、祝福诅咒、注能、墓地与指向施法；
- 227 张基础卡牌数据、事件、商店、宝箱、制作坊和本地持久化；
- Canvas 地图、位图角色/场景、程序化音效与桌面打包。

## 文档导航

- [现行游戏规则](docs/rules.md)
- [架构与模块接口](docs/architecture.md)
- [开发指南](docs/development.md)
- [存档兼容契约](docs/save-format.md)
- [性能基准](docs/performance.md)
- [设计入口](docs/design.md)
- [后续路线图](docs/roadmap.md)
- [已完成版本记录](docs/changelog.md)

美术方向与资产清单保存在 `docs/` 对应独立文档中；阶段性历史文档在 `docs/archive/`。
