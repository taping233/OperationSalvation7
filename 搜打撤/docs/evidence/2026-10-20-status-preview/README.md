# 纯状态卡预览语义

孢子城墙的结构化 onPlay 只有 curse 与 armor，旧预览把零个 damage 与多个 damage 合并为“无法精算”。本批只修预览：通用白名单读取字面量 curse / armor / draw，显示「卡牌效果」与「基础效果」声明值；仅已知整牌重复额外提示，不输出开发能力免责声明。不改卡数据、结算或伤害算法。unknown / damage=null 保留；未知字段与操作、随机目标、爆发、变形卡仍降级。免疫、修正、重复结算、后续触发不模拟，不承诺状态增量或零伤害。

基线为父工作树的实际源码字节，独立 /tmp/status-preview 小副本；依赖及数据/CSS/资源只读链接复用。未修改父工作树、原 raw/card-source 守卫、已发布冻结记录；未提交/推送/发布。

## 定向验收

- vitest：battle-status-preview、battle-hover-play-availability、r3-a-preview，3 文件 65 测试通过；含真实卡数据孢子城墙、DOM文案、转义、不可出牌优先级、未知字段/爆发/随机/伤害回退、普通战抽牌替代、延长状态语义、不变输入和冻结结果。
- tsc --noEmit -p jsconfig.battle-snapshot.json：通过。
- ESLint：两生产文件及三测试文件通过；git diff --check 通过。
- 未启动浏览器/服务，未全量/build；玩家实页效果交父级同轮集中复验。原始守卫需父审后更新，不将这里的定向通过等同全量门。

## 外部日志

日志保留在本云环境 /tmp，不进入 git。测试日志内 runner 显示17:17:18，采集工具时钟为2026-10-20 08:17 UTC；不将runner时间作为用户时区时间。

- /tmp/status-tests-final.log SHA256 f74946b2f70899f06b51fc00c3181a4ce304bb05bbf862950479cf5e375950bc
- /tmp/status-types-final.log、/tmp/status-lint-final.log 均为空成功日志，SHA256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

失败的全库 clone 因磁盘空间耗尽中止；父级明确批准后删除仅本会话创建的 work-status-preview-20261020 残留，释放约351MB。后续使用上述小副本，无主目录/主树未清理。

集成审阅后将目标标签提到模块常量，以自有键检查后直接读取CURSE_META，避免每个诅咒创建Map与entries数组；新增5项继承/未知/对象键拒绝用例。3文件70项通过，类型与相关ESLint通过。原始65项记录作为前一版证据保留。
