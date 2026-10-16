# 独立R2全量集成失败修复

R2的5项失败已由5个测试文件的夹具/行为断言修复；未改生产代码，没有 skip、todo 或降低全库硬失败断言。6文件32项定向与23文件199项完整相关闭包均通过；精确SHA见 r2-integration-verification.json，原始输出见 r2-integration-test.log。

## 生产接口与测试桩

- game.run.js 正式导出 resumeEventCardChoice，boot装配依赖它。game-canvas-resize 与 global-boot-pointer-lifecycle 的严格 mock 缺此导出，现补齐；Canvas套件额外断言运行时转发的是该正式端口
- 真实 session.bag 绑定 game.bagCap/usedSlots，Base.bagCap也是已有正式接口。four-player-event-regressions 与 full-review-regressions-world 只提供空 Base 和不完整 game 桩，现补容量接口并在每例重置 nodeRewards，不给生产选择器增加吞错兼容
- 指针套件随后暴露性能预热接口 warmBatched 缺桩，JSDOM原本仅报stderr但未失败。现按真实Art接口补桩，复跑无该 Uncaught 错误
- WORLD-003原断言“付款即消费节点”与本轮已授权的未领保留契约冲突。现断言付款后候选已固定、taken=null且未消费，实际收卡后taken=1/visited=1，候选不变且只扣一次币

## 不变应万变审计前置条件

旧全卡审计给该卡单卡开局，原卡按正式统一unplayableReason正确拒绝，却被当成“无条件零效果”。新夹具给它一张正式初始攻击作为前置，仍通过真实 BattleSession 命令执行：

1. 原卡短因与预览一致；尝试原卡后能量、手牌、弃牌和敌方生命不变
2. 真实手打初始攻击，验证本牌变为1费复制并解除禁用
3. 真实打出复制，确认扣1费、造成实际伤害、离开手牌且背包原卡仍是原ID

全卡审计仍遍历268张并保持 expect(hard).toEqual([])。结果硬失败0；铸甲、剑荡妖邪、快意恩仇仍属于原审计规则的3条条件卡人工警告，没有把新失败移入软警告。

## 验证边界

5个修改测试文件ESLint和diff空白检查通过。相关23文件199测试包含真实main/boot链、原卡普通/BOSS禁用专测、事件候选与节点绑定、献祭位置、撤离/读档和架构回归。没有新增Uncaught或mock接口错误；真实boot仍输出既有JSDOM音频codec/素材映射告警，坏档测试保留故障注入日志。

本次不代表整仓全量或build通过，父任务负责下一轮独立全量；未使用浏览器、服务、玩家存档或Git提交。
