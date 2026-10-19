# fast-check 奖励序列深化

结果：4条属性、1040组生成用例通过，单文件定向运行2.54秒，测试体1.73秒；ESLint定向通过。本次未发现新缺陷，没有生产代码修复。没有改package/lock，没有运行全量或其他质量工具。

这轮从手牌规则扩展到真实奖励模块，避免只验证自己编写的模型。生产函数是真实导入；库存变更、UI展示和接收结果通过受控端口隔离，不等于完整游戏存档、浏览器或视觉验收。

## 真实接口与生成范围

1. reward-state.rewardProgress / rewardCardState：400组，seed 20261019。
   - 随机0–20张卡、1–60步领取/放弃/序列化重建索引集合。
   - 包含重复索引、越界索引、taken/lost重叠。
   - 每步校验已领+放弃+待领等于卡数，已领与待领互斥，重叠按生产规则已领优先；输入集合不被展示函数写入。
   - 这是展示状态容错测试，不主张真实事务会制造重叠记录。
2. node-reward-state.resourceRewardAt / claimResourceReward：400组，seed 20261020。
   - 随机1–60步有效/无效/非整数索引、接收失败或成功、JSON存档重载。
   - 每步验证拒绝后的可重试性、成功后重复确认不再调用receive、总成功发放≤1；候选只抽一次，重载不重抽或清除taken。
3. createRewardOrganizer → openRewardCapacityOrganizer → claimResourceReward：120组，seed 20261022。
   - 真实生产库存适配器负责聚堆、筛选、容量与战斗状态检查；受控库存端口执行UID删除/安全格移动。
   - 生成1–4种卡堆、每堆2–4张、选中堆位置、重复次数2–8。
   - 固定关键序列保证每组真正经历：丢弃确认重复点击只删1张 → 原按钮重复安全格移动只执行1次 → 腾位不自动领取 → 战斗期间不能领 → 解除战斗后重复领取只发1张。
   - 检查实际ownedCards数量、UID唯一性以及真实奖励record.taken，非仅mock调用次数。
4. openRewardCapacityOrganizer实际生成DOM：120组，seed 20261021。
   - 生成1–4堆、每堆1–3张、1–35步整理动作与容量/安全格/会话有效性变化、库存重排、历史按钮重放。
   - 校验非明确claim不得发卡、非confirm不得丢弃、旧渲染/失效会话不得重复提交；单页面终结回调≤1；剩余+安全格移动+丢弃始终守恒、UID不重复。
   - 使用实际DOM节点click与生产监听器，但属于JSDOM构造事件，不是真实浏览器输入。

生成测试文件：tests/tools/reward-sequences.property.test.js。
独立配置：tests/tools/reward-sequences.vitest.config.mjs。
命令：node node_modules/vitest/vitest.mjs run --config tests/tools/reward-sequences.vitest.config.mjs
（使用项目Node22；未改现有quality:property脚本，避免与包文件编辑线冲突。）

若未来失败，fast-check会输出seed、path与缩减counterexample；保留这些参数即可精确重放。本次未失败，所以没有虚构的缩减缺陷案例。没有触碰041发现core、卡牌规则、业务实现或现有测试断言。

## 证据与边界

- run.log：4测试最终输出；本次用fast-check4.10.2、Vitest3.2.7、Node22.23.3。
- source-sha256.txt：本次受测生产模块指纹，作为采样身份，不作为其他并行修改的归属判断。
- 本轮不是穷举或形式证明；不包含浏览器可达性、动画、审美、趣味、完整所有权/落盘事务、异常中断或异步并发重入。
- 本轮没有调整规格来配合测试，也没有改变断言以追求工具分数。继续遵守按批次集中验收。
