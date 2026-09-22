# R2-a 第一轮根审阅：返工

根任务阅读真实实现，不能按23项绿灯通过。范围仍为既定恢复边界，不接游戏经济。

1. `validJournal`只验证baseRaw/runRaw是字符串或null；未解析after里的JSON/版本/身份/收据。合法日志外壳中填after.baseRaw=`bad`或version99，会在recover时覆盖正常基地。增加领域日志校验端口，生产recover必须严格检查before/after可解析形状、允许的版本、after基地不可null、runId/revision和嵌入收据一致；无效保留原始日志及两键，不能覆盖。
2. `pair.commit`第一次setItem日志就抛错，也统一返回PENDING_RECOVERY。需区分日志尚未落盘（SAVE_FAILED，旧键不变）与已有pending日志（PENDING_RECOVERY）；补真实setItem/removeItem故障适配器，覆盖phase更新失败和清理失败，不仅事后failpoint。
3. getItem、lock.request和部分序列化异常会直接抛出，未满足Result接口。为操作入口建立错误边界，保留能区分的错误语义；锁异常不得假称已提交。
4. QA页“同request重试”只是手写检查base.receipt后显示文本，没调用`commitBaseAndRun`。替换为真实生产门面的工厂，注入专属命名空间storage/base/run适配器和实际navigator.locks；故障/恢复/重试都必须走同一实现，不能造成功结果。显示未接游戏结算及旧同步入口跨标签边界。
5. `RunStorage.remove`catch后仍return true，删除失败不能报告成功；pending reset应在改slot/data前拒绝；迁移旧键不得绕过pending守卫。只做这些必要窄适配。

验收：独立新增after非法JSON/未来版本/null基地/身份与收据错配、日志首写失败、phase写失败、remove失败、读锁异常；旧同步保护测试。根IAB将初始化隔离样本，基地写后中断，真正刷新页面，recover，再调用同request提交并比对base/run/revision/receipt不重复变化。
