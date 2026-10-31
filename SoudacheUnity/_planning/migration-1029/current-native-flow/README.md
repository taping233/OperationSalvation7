# 当前原生流程验收

状态：三份 Editor 脚本已在 Root 结束截图冻结后安装到 `Assets/Editor/`；先前私有同源类型检查已通过，新增支付分支随现行 Core 依赖齐备后定向复核。后台 Unity 实际运行由 Root 统一安排。历史 Desktop* 的 passed 不作为本次证据。

执行方法（每个入口使用独立 `SDT_UNITY_CHECK_OUTPUT`）：

| Unity executeMethod | 断言范围 |
| --- | --- |
| `Sdt.Editor.CurrentMigrationFlowValidation.Run` | 标题→设置4分类→键位捕获/真实保存映射→无档照相馆背签保存失败/重开/重试→选档→基地7入口/返回选档→选人/整备草稿→出征失败保留/重试→补给→背包安全格失败/重试→保存退出→实际选档续档 |
| `Sdt.Editor.CurrentMigrationFlowValidation.RunJourney` | 高生命/攻击与补牌夹具，经真实地图移动、门、祭坛、首脑命令走四层→真实终局撤离→整理→入库→结算→基地，重复结算不重复增加仓库和统计 |
| `Sdt.Editor.CurrentMigrationFlowValidation.RunReceipts` | 撤离/入库/完成整理故障原档保留和重试；战斗生命归零/主动判负/放弃回执各防重；安全格来源身份；真实火堆回血复原/奖励候选领取失败重试/当前事件选项确认与持久化 |

每个入口只用 1920×1080 原生离屏画面。`profile-<scenario>-<UTC时间>` 位于本次输出内；不访问玩家正式存档。输出 `result.json`、`<scenario>-trace.json`、场景PNG；失败保留原始异常到 `failure.txt` 并退出2，成功退出0。Root runner 负责执行前后源 manifest、后台进程和退出码。

输入证据分开记录：按钮/卡片使用生产 EventSystem 的 `RaycastAll` 验首个命中，再以 `ExecuteEvents` 派发按下、释放、点击；文本使用构造的 InputField endEdit；键位使用生产 `CaptureKey`/`ActionFor` 与 fresh SaveSystem 读盘。地图/战斗路线的显式正式命令写入 trace。这些均为程序构造输入，不是操作系统硬件输入。650ms长按只对生产组件的取消/释放/离开/失焦选择生命周期作合成 holding 状态检查，不声明 hidden batch 下持续物理按住成功。

夹具边界：旅程高生命与高攻击/补牌不用于证明数值平衡、自然资源消耗或原版随机数等价；独立房间用现行地图节点位置与可辨识候选注入，只证明当前房间展示、输入、命令和持久化。旅程遇到强制支付时调用现行 `ConfirmRuleHandPayment(selectionId, materials)`，trace记录是否实际遇到；没有遇到时不将该旅程当作多支付边界证明，独立边界证据由 current-core-payment-fix 负责。

私有类型检查：从项目根运行 `python _planning/migration-1029/current-native-flow/check_types.py`。只创建自有 types/ 快照与输出，不启动 Unity，不使用共享 check_compile。类型通过仍不能替代 Root 的三入口实际执行。
