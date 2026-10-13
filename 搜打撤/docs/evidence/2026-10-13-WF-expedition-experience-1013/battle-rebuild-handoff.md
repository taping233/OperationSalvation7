# 战斗返工交接

2026-10-13：源码已交付、停止编辑，未提交。主协调可同步 battle-rebuild.md 的完整生产/测试路径清单到5373冻结副本。不要沿用旧美术验收结论。

已重建全屏战场、两侧操作/牌堆、顶栏选项、九叠低弧手牌；大卡与显式使用约定保留。拖牌按真实StS2中心跟随/出牌线/取消线/真实目标释放实现。入战只等可绘制首idle帧，其余后台补齐。换场手牌/单位令牌拆分，修复旧离场UID继承。定向整合回归9文件118项通过，定向lint、CSS解析、tracked diff检查通过。

实页待验：1920×1080真实九叠身份可读、大卡长规则、单敌明确使用再选目标、连续拖牌跨线/真实释放/回手、冷暖首帧及后台补帧。此聊天未操作任何浏览器tab、启动服务或build，不能宣称这些已通过。

入战仍有节点依赖：当前flow战斗选项调用enterNode('battle')，scenes enterNode对battle/boss仍插city-cut接敌页；请节点负责人/主协调删掉这段重复流程，确认事件选项后直接openBattleCell并保持上下文守卫。本聊天遵守节点属地限制未改该处。ready首帧优化不能替代此项。

详细实现/完整清单见 [battle-rebuild.md](battle-rebuild.md)，源码参数见 [battle-drag-reference.md](battle-drag-reference.md)，首帧加载见 [battle-entry-first-frame.md](battle-entry-first-frame.md)。奖励持久上下文、afterRewards与已有380ms胜利反馈未改。根台账交主协调销账；没有新增老板决策。
