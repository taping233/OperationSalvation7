# 恢复批次 CI 契约对齐

基线提交：e55ae96e8c109613d951b682653bb96891bcb828。
其完整 CI https://github.com/taping233/OperationSalvation7/actions/runs/39204846930 为 6305 通过、17 失败、2 跳过。原失败日志保持历史，不改写原结果。

## 逐项归因与处理

- battle-runtime-completion-1014 的 6 项、e8-card-migration 的 6 项、m3-contract 和 mystery-potion-observation 各 1 项：旧 fixture 通过命令直接使用 BOSS 永久背包道具。现行规则在 battle.view.js 和 FB044 证据中均明确限制永久道具，仅开放战斗生成临时道具。测试改用真实 addTempCard 入口，保留回血/禁疗、结晶 LIFO 与牌区唯一性、冰冻符文、延迟触发及禁逃断言。e8 增补永久道具直达命令无效、原副本不变检查；未修改卡库迁移、存档版本或用户自定义数据逻辑。
- battle-pile-readability 的 1 项：fixture 缺 snapshot.mode，补齐真实 BOSS 快照字段；保留完整规则、分组、焦点及返回动作断言。
- reward-frame-review 的 1 项：lostCount 来自已放弃集合，统一状态模块正确称为“已放弃”；旧文案断言改为明确放弃，仍保留剩余待处理数量检查。
- scavenge-mode-feedback 的 1 项：旧测试将道具当手牌，按真实道具栏验证；额外覆盖普通非道具入手及 BOSS 非道具入库。发现共享技能提示遗漏道具分流，已在 battle.slam-skill.js 统一说明。

## 新验证

54 个相关测试文件、887 项全部通过；syntax、8 组 types、lint 通过。真实新日志和测试清单附本目录。工作区是按固定基线 SHA 校验恢复的源码子集，非完整 checkout；未在实页操作，未本地 build，完整远端 CI 以新提交运行结果为准。

## 性能门基线

恢复提交 Vite 构建成功，但 5 项预算失败。直接基线 cd98745f 只比父提交 3721e42 修改两份文档；父提交同 workflow 已有相同 5 项超限。预算、Vite 配置未放宽，详见 performance-baseline-comparison.json。包体 221.83→221.85 MiB，重复资源 9.94→9.94 MiB，入口 gzip 332.0→335.0 KiB，初始 JS 377.6→380.7 KiB，CSS 216.9→217.5 KiB；旧超限不代表本轮零增量。本轮不调整预算或资源排除表。
