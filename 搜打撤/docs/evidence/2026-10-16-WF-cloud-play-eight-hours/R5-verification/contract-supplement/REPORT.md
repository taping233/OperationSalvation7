# R5 契约修复独立补充验收

结论：审定四文件补丁后的普通全量通过，478 个测试文件、4523 passed、2 个既有条件skip，exit0，无unhandled error。受影响零依赖selftest、正常全lint与selftest专属lint均exit0。原R5的14败/1unhandled与build四项预算失败全部原样保留；此补充不把原失败覆盖成成功。

## 范围与输入

- 审阅修复README与补丁，`repair.patch` SHA256 `57ccd1b2031da1799fe937afcd16bd3c3434aa978cff123ea041f1f103e04c70`，与父指定值一致
- 仅将三份旧测试mock补齐openFixedRewardsOnCell，以及game/selftest.js由注释正则改为领奖保存/await settle的AST契约；独立应用补丁后逐字节核对生产修复after SHA
- 仅R5独立副本四文件变化，不修改共享生产；原始四文件留在shared补充目录的original-four-files
- 修复前2875个game/scripts生产文件与13个配置/锁文件相对R5未变；flow/settle两个指定生产入口均逐SHA核对
- `game.run.flow.js` SHA256 `32bf9c15ab789137aa11c2647fdf9fd38b346fbb0329f2a2927db3a9f27113da`
- `game.bag.settle.js` SHA256 `c091a8fa1ba5ba680b3aae2979429df8fa011dc5b1b1a0e4d0204efe288280b2`

四文件验收后的SHA：
- `搜打撤/game/selftest.js`：`03cc5c082cec12914771b8ef172422b339ec2c48e9cdac9aba564236594080ef`
- `搜打撤/tests/map-travel-motion.test.js`：`962a05cb4bc5dd87cb73d0a860b8f8144871c6a4e0bd8c2e98a26cbaa041a2d2`
- `搜打撤/tests/node-flow-confirmation.test.js`：`09740e1685ed6cc84ec3a600d37f457b60ee99ba32e787a16c7a3f83604df7f0`
- `搜打撤/tests/r6-story-flow.repro.test.js`：`605720f4b3ba6f8a6a7cd2d7cae996a4ed88c7adfc3969f836824493fad28aa2`

## 本次实跑

| 命令 | exit | 耗时 |
| --- | ---: | ---: |
| node game/selftest.js | 0 | 0.215s |
| npm run lint | 0 | 16.312s |
| node_modules/.bin/eslint game/selftest.js | 0 | 0.224s |
| npm test | 0 | 143.836s |

普通npm test保留正常pretest剧情编译/数据校验，没有skip/no-verify/绕过变量或修改断言后掩盖原失败。本次4525项总数与原R5相同；原14失败恢复为通过，2个条件skip仍如实保留。修复worker的6个selftest变异案例及定向结果只作前置审阅材料，本次完整测试结论依据本补充logs/test.log。

## 完整性与构建边界

- 补充前后快照精确只变四文件，其余输入与依赖无意外漂移；共享可写inode0
- 原R5全部证据文件与原test/build红日志SHA未变，Git index的13377条path/mode/object ID/stage语义未变
- 原R5产物manifest逐文件复核未变；因只修测试/自检契约、生产及构建输入未变，按授权不重复build
- 引用原R5产物：119.58MiB，entry gzip 288.1KiB，initial JS gzip333.5KiB，全部CSS gzip196.1KiB，仍超112MiB/270KiB/310KiB/136KiB四项原阈值
- 本次没有重新执行syntax/8套types/docs/build/资产专项，也没有浏览器、服务或远端CI；相关未变生产输入的原R5证据可继续引用，不能称所有质量门通过
- 复合补充输入manifest SHA256 `8c3d16e082d519a6622d3090b3b9cb4209244f9792475d6119cd13cd53e42deb`；原R5输入SHA见summary.json
- 原R5 test日志SHA256 `57821ee7ec2dc4cc1d66ea5ce3182076dd00b1f90322c753fe3fdff120525b67`；原build日志SHA256 `9348efb9e6065a73022d9fbaad3757ae20e1c83420dd27e6837935ebef314e0f`

末次观察发现准备后生产既有路径变化1项、新增生产路径0项，明细见post-validation-integrity.json；如非零，只覆盖本次冻结输入，不套用于后续来源变化。

完整大manifest及独立副本留在`/workspace/shared/cloud-iteration-verification-r5-20261016/contract-supplement`。主evidence补充目录只复制精简结果与原始日志，未提交/推送。
