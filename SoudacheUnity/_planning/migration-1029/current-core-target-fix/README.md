# 当前Core目标与留手修复（已冻结，待Root原生验收）

生产修复均按现行源规则字段消费：`keepInHand`在主结算后恢复同UID，移除played/discard记录；满手转入discard；`fuelAllowed:false`同时约束人工UID选择、自动选料、确认及支付二次校验。保留了真实离手期间的抽牌上限和lastHand判定。

`foeFight/pick:two`先依用户次序收集两名不同存活敌人，再付费/消耗材料，攻击者自身atk、atkUp和受击者bleed经CombatResolver攻击伤害入口结算；首击死亡取消反击；复用原生enemy-windup和受击presentation。自动施放且没有用户目标对时沿源保留前两名fallback。`pick:new`从主段剥离，在主结算结束后建立可取消/可结束回合放弃的二段目标；目标命令校验BattleToken和selectionId。`bindTarget:prevDamage`沿本次damage实际目标列表，不把死亡目标转移给首名敌人。

UI沿既有点击、拖拽、空地判断、hover、键盘确认与Esc路径；只为二段增加命令分支，双敌第二选时排除首名，注能时禁用燃料呈弱化状态。新增PendingTarget字段不写入存档。源文件只读；未启动Unity、浏览器、CUA或服务。

验收：

- 原独立审查的4组真实源进程结果与本片私有Core进程结果一致：不朽斩二次同UID、双镖各自状态、三敌选1&2、燃料排除。见comparison.json、source-round2-results.json、core-round2-results.json。源证据复用current-core-independent/inputs-round2-sha256.json及前序source清单；receipt列本片当前源SHA。
- 47项边界通过：多敌、死敌不反击与重选、同一目标重复、取消/结束回合/跨局/selection失效、UID保留和成本、满手fallback、抽牌时真实离手、目标完成前燃料不消费、自选目标与燃料联合恢复、确认前变成禁用燃料。
- 合并生产快照回归：current-integration 1814/1814、forecast 289/289、card-semantics 167/167。各自结果只写本片私有子目录。
- 全7程序集私有类型检查0错误；10项现有Res/UI警告（反序列化字段、重复using、继承方法隐藏）。最后presentation调用增量由47项Core重新编译验证。

生产freeze及SHA见receipt.json。原生实际点击/拖拽/hover/Esc及渲染由Root集中执行，以上类型与逻辑结果不替代原生输入验收。

`apply.py`为一次性开发草稿，生产已按断言上下文应用；请勿重复运行。`check_compile.py`仅写本目录compile，不占Root共享输出。两测试工程共目录，执行时请使用各自obj-target/bin-target或obj-round2/bin-round2，再直接运行对应DLL，避免dotnet run启动缓存造成误报。
