# Agent 实验溯源链路烟测

时间：2026-09-28 约 22:36–23:00 +08:00。执行位置为隔离工作树 `acceptance-speed`，其 HEAD 为 `2cef754`，运行时有本轮未提交代码；`summary.json` 自带该时点的代码指纹与 Node/锁文件信息。复制到本目录的是原始产物字节，源目录保留在隔离工作树的 `搜打撤/output/agent-provenance-smoke-*`。这组数据只验证工具接线，不是策略收益、完整对局或实页性能证据。

两侧均使用 `--runs 1 --policy greedy --seed-base 99001 --max-steps 2 --timeout 5`，输出分别见 [candidate](candidate/summary.json) 与 [champion](champion/summary.json)，各自的 `runs.jsonl` 位于同目录。`max-steps 2` 故意提前截断，两侧都得到 `abandon`。

[compare 原始输出](compare.txt)显示 provenance 已验证、seed 配对率 100%，但弃局率 100% 触发硬否决，机器结果为 `promotionAllowed=false`。随后用 `--split verify --verify <candidate> --compare <compare.txt> --verdict discard` 写入[隔离台账](ledger.jsonl)；同一输入改成 `--verdict promote` 时脚本退出码 1，台账仍只有一行。复制后的 candidate runs/summary SHA-256 与 compare 机器行一致。

脚本会按实际 `--split` 选取汇总；旧记录缺少 provenance 时仍可读但不具晋级资格。正式实验仍须使用足量配对局、独立 T/V seed 集和预先声明的策略变量，按[实验复现约定](../../production/engineering/AGENT-EXPERIMENTS.md)记录。
