# 按子系统检查复制代码

`npm run quality:clones` 用锁定的 jscpd 5.4.1 检查 battle、ui、hub、run，逐个子系统执行，单 worker。可用 `npm run quality:clones -- hub` 缩小范围。JSON 报告和汇总写入 `node_modules/.cache/redundancy-audit/`，不改源码。

## 如何使用结果

只把结果作为人工审查候选：先看两处业务目的，再决定共用函数还是保留隔离。不要自动删除相同片段。快照/事务前后校验、兼容旧存档的冻结代码与不同生命周期的对称清理，可能应该保持独立。

当前配置只看 JavaScript，至少70个token及6行；忽略注释、生成目录与第三方vendor，避免把许可证文本和外部源码当自有冗余。跨子系统之间的重复不在这四次独立扫描内；小于阈值、改名、语义相同但结构不同也可能漏报。报告中的 newClones 未配置基线，不作为“本轮新增”证据。重复率不是代码质量分数，0也不是无冗余。

`npm run quality:clones:test` 使用临时样例验证复制代码能检出、vendor/generated/许可证不会误算。配置及执行器在 `tests/tools/redundancy-*`。旧 `jscpd:baseline` 命令保留，现在有明确本地依赖，但默认建议用上述定向入口。

## 成本与安全边界

jscpd 5.4.1 为 MIT；该版使用官方 npm 平台二进制，当前 Linux x64 安装2个包，约45MB。只是开发工具，不入游戏bundle。不要使用 --semantic、--semantic-download、--semantic-url：当前流程纯本地词法扫描，没有模型下载或源码上传。未添加CI阈值，克隆候选不影响现有测试门禁。

本轮还隔离评估了 dependency-cruiser 18.6.0（MIT），但未加入项目依赖：现有 contracts 的 assertAcyclic 和 architecture-boundaries 已检查真实模块图。试用只得到4条需人工解释的目录边界提示，没有新增有效缺陷；未来需要跨包图或架构图交付时再评估。

官方源：[jscpd](https://github.com/kucherenko/jscpd)、[dependency-cruiser](https://github.com/sverweij/dependency-cruiser)。实际发现见 [本次报告](../evidence/2026-10-18-redundancy-tools/README.md)。
