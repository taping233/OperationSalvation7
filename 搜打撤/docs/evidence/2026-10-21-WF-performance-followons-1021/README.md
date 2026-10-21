# 后续性能补丁集中验证

基线为已发布候选 `d682c4cb0217f15da04aae02ec20a2a3da29b114`。本轮接入原七文件资源工具补丁和两文件战斗快照补丁，标准构建另再生 `art-manifest.js`，移除77条不再发布的预取名称。另补全卡审计的有限真实截止测试夹具，十三个源码/生成/测试路径及原补丁 SHA 见 [清单](source-manifest.json)。

## 改动与收益

- 91张旧宝箱 rig 与天气替代源图全部保留，合计64,799,326字节；来源大小/SHA或消费者审查不符时保守保留，alias/额外省略集合在构建阶段改变时明确失败。
- 非选牌阶段不再为快照遍历选牌池或捕获五项无投影输入；实时选择仍留在运行态，开战效果、检查点和重开恢复保留。
- direct-cast 仅修正测试随机来源与合法卡夹具，不改玩法。
- 标准构建1607个文件、172,525,257字节，相比d682的227,043,281字节减少54,518,024字节（51.99 MiB）。这是包体差值，不是FPS或内存测量。

## 已完成检查

- 九文件源码的正式冻结 full 门：755测试文件/7853项通过；1文件/7项原门跳过，0失败。剧情、语法、数据、类型、ESLint、index不变和依赖字节检查通过。原始日志见 [full-source-gate.log.txt](full-source-gate.log.txt)，覆盖边界与大回执SHA见 [摘要](full-source-gate-summary.json)。该记录不冒充后补生成清单及文档的最终index收据。
- 原 `npm run build`（含prebuild/postbuild）退出0。固定预算全部通过：entry368107/368640 B，initial417809/419840 B，CSS228775/235520 B，package172525257/230686720 B。[日志](build.log.txt)、[精确字节](build-budget-exact.json)、[产物SHA清单](build-output-manifest.json)。
- 静态引用闭包检查1367个唯一目标，缺失0；286个排除项无残留引用/警告，21个现用宝箱图全部在产物中。[闭包结果](runtime-asset-closure.json)。不代表任意动态JS路径或浏览器网络覆盖。
- [独立复核](independent-review.md)未发现阻断；当前架构和性能说明同步更新。发布前仍使用正式冻结门和正常pre-commit回执核验最终index，不放宽预算或关闭门禁。

## 失败记录与未核验范围

首次指定项目外 `/tmp` 输出被原构建目录保护拒绝，失败和部分产物闭包错误保留于 [失败构建](first-build-failed.log.txt)、[失败闭包](first-closure-failed.json)。未修改保护；等待部署负责人独立接收旧产物、释放磁盘后，在原 `desktop-app/game` 跑标准构建通过。CLI不支持保留快照参数的预检错误及原导出函数的保留选项见 [过程记录](validation-attempts.json)。

最终index初验曾出现Vitest子进程exit null，原因未确定；清理本任务已授权临时快照后复验，出现一项法力奔涌busy/队列断言失败。两次失败原日志与大回执SHA均保留于[诊断摘要](audit-timing-summary.json)，不以定向通过覆盖全量失败。

旧d682和新引擎的确定性四次元素爆裂对照均证明：原200次定时器轮询会早于真实RAF结算返回。仅把审计等待改为有限5秒真实期限，保留busy/队列断言并补RNG/队列超时诊断；四次真实施法和永不结束队列明确超时两项回归均通过。含快照测试共[17项定向通过](audit-fixture-targeted-final.log.txt)；旧helper的同场景[负对照按预期失败](audit-fixture-negative-control-final.log.txt)，只观察到2/4次施法。未改生产玩法、动画等待或预算。最终冻结full与正常pre-commit结果由随后生成的精确index收据独立记录。

本轮尚无当前内置浏览器实页验证、远端CI或后续部署结果；不得将静态闭包、测试或构建算作这些检查通过。原d682线上版本的发布与浏览器证据不覆盖本轮新增快照代码。

后续完整门另暴露生命周期随机子奖励和精神药水抽牌观测两项旧夹具假阴性。两版引擎的确定性对照、最小测试修复与负控见[补充摘要](supplemental-fixture-summary.json)。保留原失败；只修测试，不改生产规则或门禁。
