# 搜打撤 · 代号7

飞行棋式掷骰探索与卡牌战斗结合的单机搜打撤游戏。当前版本为 v0.51.0，提供网页开发版和 Electron 桌面版。

## 快速开始

桌面版直接双击 `启动搜打撤.bat`。开发调试在本目录运行：

```powershell
npm install
npm run dev
```

`index.html` 使用 ESM，不能通过 `file://` 直接双击运行。`npm run dev` 由 Vite 读取 `game`；桌面启动会先构建，再读取 `desktop-app/game`，确保第三方 ESM 依赖已经打包。

## 常用检查

```powershell
npm test
node game/selftest.js
node scripts/check-version.cjs
npm run build
npm run perf
```

## 当前能力

- 三个同心环、60 个事件格、单向深入、免费与紧急撤离；
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
