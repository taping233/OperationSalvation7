# Agent 实验复现约定

本页补充最小复现元数据和判定口径；不替代 [Agent 接口协议](../../agent-protocol.md)与[策略迭代手册](../../agent-iteration-playbook.md)。工具事实以 `game/tools/agent-batch.mjs`、`agent-compare.mjs`、`agent-ledger.mjs` 为准。

## 单次实验记录

每个 challenger 与 champion 跑次都保留以下信息；缺项标记 `unknown`，不得默认为相同条件。

| 类别 | 必记字段 |
|---|---|
| 身份 | experiment id、假设（一变量及预期机制）、负责人、时间、T/V split、结论状态。 |
| 代码 | 仓库、分支、HEAD commit、远端差异；dirty/clean；dirty 时记录 `git diff --binary` 与未跟踪文件清单/内容校验值，或保存可恢复快照。只记 HEAD 不足以复现未提交代码。 |
| 执行 | 完整命令行、Node/npm 与依赖锁定信息、操作系统/运行方式、`--runs`、`--seed-base`、`--mode`、`--policy`、`--driver`、步数/超时参数、退出码。 |
| 策略 | 策略实现版本；`--weights` 文件的内容/hash（含默认权重版本）；用到的训练产物、目标函数及训练 seed/参数。不能只记路径，因为文件可被覆盖。 |
| 探针与环境 | `--probe-ui`、`--selfcheck` 等 flags；是否注入 fixture；LLM 的 provider/base URL、确切 model/deployment id、采样参数/提示词版本、重试/超时配置。密钥只记“已配置”或安全引用，禁止写密钥。非 LLM 策略注明 model 不适用。 |
| 产物 | challenger/champion 的 `runs.jsonl`、`summary.json`、probe/log、compare 完整输出及文件 hash；运行失败也保存错误和部分产物。标明输出目录与保留位置。 |

最小命令范式（示例使用既有工具；具体参数按假设声明）：

```sh
npx vite-node game/tools/agent-batch.mjs --runs 100 --policy strategic --seed-base 77001 --out output/agent-exp-rN-candidate
npx vite-node game/tools/agent-batch.mjs --runs 100 --policy strategic --seed-base 77001 --out output/agent-exp-rN-champion
node game/tools/agent-compare.mjs output/agent-exp-rN-candidate/runs.jsonl output/agent-exp-rN-champion/runs.jsonl
```

保留 selfcheck 和 compare 原始输出。若实验使用 weights、mode、probe、额外 flags 或 LLM，记录中完整展开，不能省略成“同上”。

## 配对与结果判定

- 先按完全相同的 seed 集合配对；比较工具依据 seed join。runs 数、seed base 不同或存在 seed null 时，不把未匹配局补成独立样本。先核查工具报告的配对率；配对不完整则该轮结果不作 promote 依据，重新用同一条件补齐或重跑。
- 对照与候选固定游戏模式、seed、驱动、步数/超时、代码运行环境及实验 flags；每轮只改预先声明的一个策略操作点/变量。若修复正确性缺陷，作为根因修复记录，和策略收益实验分开解释。
- 保留逐 seed 原始结果，以 `agent-compare.mjs` 的配对符号检验和业务指标作为判定证据；同时报告撤离/通关、均层、带出价值、死亡/弃局及子群指标。不能仅凭裸均值或总分判定。
- 按现行 playbook 与比较工具，弃局率超过 5% 或超时率超过 5% 分别构成硬否决；超时是卡死/慢死螺旋故障，须与策略性弃局分开统计。T 集 p<0.05 且方向有利才进入 V 集。V 必须换验收 seed 底并同样配对；只有通过 V 才 promote。早停/判毙、hold、baseline 都写清依据。多指标冲突、pairing 不足或统计检验无法计算时结论记 hold/不可判，不挑有利指标。
- 台账现有字段与 verdict 枚举见 `agent-ledger.mjs`：`promote`、`discard`、`hold`、`baseline`。每条 ledger 记录应能回链到本页要求的代码状态、命令、两侧跑次产物和 compare 输出；台账摘要不能替代原始数据。

## 尚未由现有工具自动保证

当前 batch/compare/ledger 提供跑局数据、seed 配对、统计比较和人工台账入口；本页要求的 dirty tree 快照、权重内容 hash、环境完整清单及产物校验值需要实验者记录，不能声称工具会自动采集。配对检验适用于同 seed 的逐局比较，不自动解决反复检验/多指标选择、样本分布变化或 LLM 服务漂移；这些需通过 T/V 隔离、预先声明判据、固定模型版本并保留原始产物控制。
