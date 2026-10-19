# 背包—领奖样板：开发提效

已交付 `tools/workflow-slice.mjs`：显式文件 → 现有 review → 可选现有 verify → 报告复核 → 现有 summary，一次调用保留候选页面、源码哈希、真实退出码与未验范围。默认只规划；已有结果用 `--input`，当前平台浏览器 JSON 用重复 `--report`。不启动浏览器、不 build、不改台账、不提交。

改动路径：`tools/workflow-slice.mjs`、`tests/workflow-slice.test.js`、`docs/workflow-recipes.md`；复用模块未修改。

## 实测

- 工具定向契约：3 文件 27 项通过。最终原生报告：`../2026-10-19T11-05-45.753Z-7734ca53.json`；日志在同目录。覆盖默认不执行、已有报告复用/过期、full不降级、失败保留exit7、skip不算通过、截图仅observed、输出不覆盖、编排exit0不充作测试通过。该报告原生manifest未含tools路径；`tool-inputs.json`另列本线3文件SHA与mtime，采集晚于测试，只作清单，不能独立证明未来复用新鲜度。
- 当前文档检查：`docs-check.json`，退出0，574条相对链接，0项发现。Node语法与证据配方PowerShell语法通过。
- 本批9个实际生产/测试/夹具文件，复用 interaction 的同一140项通过报告，未重复测试。对照记录在 `compare-v1/comparison.json`，原始 review、两个摘要与单入口输出同目录保留。

| 同口径报告汇总 | Node命令 | 显式摘要输入文件 | 本次墙钟 |
| --- | --- | --- | --- |
| 既有 review → summary | 2 | 1 | 5.215秒 |
| workflow-slice --input | 1 | 0 | 4.940秒 |

对照前后9文件SHA256未变，两个摘要的报告结果一致。省下一条调用与一份输入JSON；单次顺序样本的0.275秒差值不能作为稳定加速承诺。对照不含已经完成的测试和浏览器操作。

## 覆盖边界

本批现有门计划为 `full`，140项显式定向报告在汇总中仍为 `partial`。复用对照时原生新鲜度为 `stale`：报告之后REGISTRY及`game/src/generated/art-manifest.js`改变；9个本批输入与环境未变，两个摘要均保留过期状态。此项已交主会话核对生成文件归属及影响，未自行忽略或重跑140项。

这不授予全量通过、冻结index或远端CI结论。原始截图也只能证明它声明的观察和输入范围。当前工具线不操作浏览器；实页由主会话统一验证，后态取证到齐再用 `--input ... --report ...` 汇总，不重复测试。

首次受限运行因esbuild/git子进程EPERM未执行测试；获允许后沿现有命令完成。工具初版测试夹具缺game/data，修正后27项通过；旧日志和报告保留，不以先前失败作为当前通过。
