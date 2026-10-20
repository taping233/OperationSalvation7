# 便携包素材发布复核

结论：195 项旧路径均仍可排除，当前生产扫描 `excludedAssets.size=195`、`warnings=[]`。没有发现本次候选恢复引用或替代图缺失；没有修改映射、卡库、运行时源码或资产，没有删除文件、构建、发布或提交。

本轮只在 `scripts/runtime-asset-redundancy-review.mjs` 中更新两处 art-mapping 完整文件指纹并加入本报告链接。此前未提交的消费者审定改动保留；排除算法、候选名单、消费者白名单与测试保护规则没有降低。两份原测试已覆盖静态/动态恢复引用、选择器/映射改变保留整类、新动态消费者保留全部、目录/缩略图与批准删除收据，故复用这些测试而不新增重复断言。

## 四项失败的判断

修复前生产扫描只报两个类别的 mapping 指纹过期：shadowed-card-art（30项）及 retired-scenes（19项），排除数为146；其他所有现役选择器及不透明路径消费者完整指纹一致。四项测试失败均由这一个 JSON 的两处过期锁引发，不是运行时缺图或恢复引用。

当前 mapping 与原15对被覆盖卡图审计所记录的 mapping（SHA256 `7d58a3687c73d138279b086d7697e4c59047c89b735dad77acd06b003acb0f99`，与 HEAD 内容一致）逐叶比较，只增加14张 tt13 卡的 `cardArtOverrides` 和对应 `cardArtRevisions`，共28处；eventCardArt和15张旧图替代路径完全不变。14对新增原图/缩略图均存在、非空且均不属于195候选。

原review锁定的是另一份完整摘要 `70d6636e800c1dd2763b8f4101cd99fff78d29b59420b0ac4dd510d831e77127`，此次没有恢复该摘要对应的历史全文。因此“仅28处变动”准确指向上述可核实的历史审计全文对照，不凭摘要推断未知历史文件的全部差异。本次重新扫描和逐项复核独立证明当前195项仍可排除，而非仅替换hash令测试变绿。

## 当前实证

- 遍历649份源码：game/src（排除generated和.d.ts）、game/data、game/css及game根HTML，范围与生产审查工具一致。195项完整路径及生产判定needle均零命中；完整源码指纹留在review.json。
- 195项分为90旧宝箱帧、39旧角色帧、12旧地图、5旧转场、19退役场景、30被覆盖卡图。全部匹配2026-10-19批准删除清单和203项删除收据的对应记录，现物理文件均不存在；清单完整SHA与收据planSha256相等。
- 所有现役selector与opaque consumer/dependency沿现行工具核对。旧opaque表里base-chibi-v2.skin.js现已不存在且不在运行扫描中；没有新增/改写该历史授权条目，当前活动源码没有未审动态路径警告。
- 15个被覆盖卡图ID的真实替代映射逐项保持历史审计值；30个替代原图/缩略图全部存在并记录字节与SHA256。Art.cardIcon先查DATA.art.cardArtOverrides再进旧家族构造，data-loader深冻结映射；这两份执行选择器完整指纹未变。
- 角色animations.json继续由生产工具现读；静态/配置恢复引用、未知角色目录和动态消费者变更仍走原保守保留规则。
- 最终 mapping 完整LF归一化 SHA256：`a7d5b045fdcc015c8998462fc3f41f4cf2215531826e616d753e7ae68978c530`。最终扫描后复核摘要未变。

## 验证

`node node_modules/vitest/vitest.mjs run tests/runtime-asset-redundancy.test.js tests/retired-scenes-publication.test.js --reporter=dot`：2 files、27 tests passed，退出0。

review脚本及上述两测试定向ESLint、review脚本git diff --check：退出0。未运行构建或发布命令。

机器证据：[review.json](review.json)、[final-plan.json](final-plan.json)。本属地源码稳定，可以交主会话制作隔离快照。
