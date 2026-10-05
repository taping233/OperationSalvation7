# 搜打撤 · 代号7

四层相邻节点探索与卡牌战斗结合的单机搜打撤游戏。当前包版本为 v0.60.0「冬日远征体验改造」，主线为 Vite 网页版；开发范围与冻结边界见根 AGENTS.md。

开发从[快速入口](docs/QUICKSTART.md)进入；[文档导航](docs/README.md)按改动定位资料，[项目状态](docs/STATUS.md)提供交付指针。带日期的[历史记录](docs/archive/README.md)只代表当时时点。

## 快速开始

Vite 网页版开发调试在本目录运行：

```powershell
npm run web
```

主线 5200 使用 `npm run web` 幂等复用；它由 Vite 读取 `game`。优先现有 Node 22 与锁定依赖，缺失项按任务授权处理。`index.html` 不能通过 `file://` 双击运行；构建环境边界见[开发指南](docs/development.md)。

网页版浏览器要求：Chromium 105+ / Edge 常青版 / Firefox 121+（样式层使用 `:has()` 与容器查询 `cqw`，旧内核 WebView 下部分界面样式会退化）。桌面版内置 Electron 44，无此限制。

## 常用检查

日常反馈、提交门与 CI 覆盖边界统一见[质量门](docs/quality-gates.md)。这些命令按需选择，不是固定顺序：

```powershell
npm run test:target -- tests/<相关测试>.test.js
npm run docs:check
npm run check:staged:plan
npm run typecheck
node game/selftest.js
node scripts/check-version.cjs
npm run build
```

## 当前能力

- 四层相邻节点地图、单向深入、免费与紧急撤离；
- 五个独立存档、基地、仓库、背包、安全格、职业熟练度、成就和卡背；
- 普通战斗、BOSS 牌库战、词条时点、祝福诅咒、注能、墓地与指向施法；
- 卡牌数据与同步迁移、事件、商店、宝箱和本地持久化；制作坊写入口保持关闭；
- Canvas 地图、位图角色/场景、采样与程序化音效；
- `SDT.Agent` 结构化观察与动作接口、自动游玩、跑局统计及批量策略实验工具。

## 文档导航

- [制作资料总入口（章程、GDD、视觉、工程、迭代与验收）](docs/production/README.md)
- [项目状态入口](docs/STATUS.md)
- [文档导航（含按改动找文档路由表）](docs/README.md)
- [项目记忆快照（2026-09-28 上午，已归档）](docs/archive/status/PROJECT-MEMORY-2026-09-28.md)
- [历史项目状态快照（2026-09-27，已归档）](docs/archive/status/PROJECT-STATUS-2026-09-27.md)
- [历史交接记录（09-20 至 09-27）](docs/archive/handoffs/2026-09-20-to-27-vite-log.md)
- [Agent 接口协议](docs/agent-protocol.md)
- [Agent 策略迭代手册](docs/agent-iteration-playbook.md)
- [现行游戏规则](docs/rules.md)
- [架构与模块接口](docs/architecture.md)
- [开发指南](docs/development.md)
- [流程工具与归档办法](docs/WORKFLOW-TOOLS.md)（接手提示、复用检索、台账预览写入、验收证据）
- [存档兼容契约](docs/save-format.md)
- [性能基准](docs/performance.md)
- [设计入口](docs/design.md)
- [后续路线图](docs/roadmap.md)
- [已完成版本记录](docs/changelog.md)

美术方向与资产清单保存在 `docs/` 对应独立文档中；阶段性历史文档在 `docs/archive/`。
