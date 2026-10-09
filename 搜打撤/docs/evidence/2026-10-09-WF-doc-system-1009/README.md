# 文档系统整理：2026-10-09

本轮整理规则、导航、现行说明与历史身份，保留已有文件路径。老板授权实施，文案待老板审阅；完成未提交。

## 范围与结果

- 对 `docs/` 的 855 个文档文件做路径、标题、大小与 SHA256 盘点，另核对 5 个规则或入口文件。分类用于定位复核，未逐篇重审历史结论。
- 调整根规则、工作区/项目/源码入口和现行资料：明确规则、方案、状态、生成物与历史的职责；复杂登记条件放到流程指南，权限仍由根规则维护。
- 修正经源码确认的漂移：仓库上限 100 与符文升级成本、场景配乐入口、已删除的 Pixi 粒子入口、空闲调度配置、角色数据路径、已移除的随身资源汇总条。
- 制作章程、GDD 与迭代办法引用对应现行来源；验收矩阵改为每次记录的模板。Agent 手册分离现行实验方法和 09-26/27 历史跑次，晋级命令指向带产物校验的入口。
- 根层旧审计、计划、提案与职业名单补充时点身份；未移动或删除文件。793 份既有历史/证据文件保留原字节。

## 验证

| 检查 | 结果与范围 |
| --- | --- |
| 项目文档守卫 | `npm run docs:check -- --json` 通过；链接、档案契约、规则预算与源码域表 |
| 既有文档契约测试 | `workflow verify --tests tests/docs-consistency.test.js`：1 文件、5 测试通过；报告在本目录 |
| 扩展引用与事实核对 | [review-checks.json](review-checks.json)：修改文档的本地链接与标题锚点、规则预算、选定源码事实、五项任务路由 |
| 原文与保护范围 | 803 个既有文件 SHA256 未变，包括 793 份历史/证据、卡牌迁移矩阵、术语、图鉴、制作美术及五份角色正文 |
| 差异格式 | 定向 `git diff --check` 通过 |

根规则 4995B；流程四页合计 26868B，均在预算内。测试仅检查文档契约；本轮没有游戏行为变化，未运行构建或游戏实页。

## 源码核对入口

| 文档事实 | 对照来源 |
| --- | --- |
| 仓库容量、升级与符文消费 | `game/src/core/rule-config.js`、`game/src/hub/base.js` |
| 场景曲目、淡入淡出、按需加载 | `game/src/audio/sound.music.catalog.js`、`sound.music.player.js`、`sound.js` |
| 战斗序列帧与受击火花 | `game/src/battle/view/battle.frames.js`、`battle.vfx.js` |
| 空闲事件驱动绘制 | `game/src/core/render-scheduler.js` |
| 角色与章节提示 | `game/src/core/characters.js`、`game/src/experience/pocket-strip.js` |
| CI 与命令 | 根 `.github/workflows/ci.yml`、`vite-quality.yml`，项目 `package.json` |
| Agent 晋级与复现 | `game/tools/agent-ledger.mjs`、`agent-batch.mjs`、`agent-compare.mjs` |
| 存档快照与恢复 | `game/src/run/map-snapshot.js`、`game/src/hub/game.storage.js` |

## 未完成与保留项

- 卡牌迁移矩阵、术语、生成图鉴及制作美术存在其他会话在途内容，本轮正文只读。角色外观与背景正文保留；未重新作视觉认可或剧情裁决。
- REGISTRY/PENDING 的他人记录未压缩、迁移或销账；仅维护本会话登记。相关历史继续从既有入口按需读取。
- `docs/evidence/2026-10-05-WF-card-ally-redesign/task.json` 是旧格式记录，缺少 `schemaVersion` 与 `date`。`workflow task start/summary` 通过 `summarizeTasks` 读取该文件时返回“任务文件身份不匹配”。本轮未修改该任务或流程源码，执行与检查记录保存在本目录；标准任务的新建/汇总仍受此项阻塞。修复需核对原任务字段与归属，作为独立工具修复处理。
- 没有对全部玩法数值、效果或历史验收重新执行游戏验证；保留未核实范围，不把文档守卫通过解释为游戏全部通过。

## 复核方式

`before.json` 和 `after.json` 保存盘点快照；[audit.mjs](audit.mjs)用于重建新快照，拒绝覆盖既有报告；[verify.mjs](verify.mjs)重新检查本轮引用、指定事实与保护范围，并更新 `review-checks.json`。验证报告是本轮证据，后续代码或文档变化需重新核对适用范围。
