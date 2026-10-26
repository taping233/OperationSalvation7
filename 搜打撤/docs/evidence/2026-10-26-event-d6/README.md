# 事件六面骰与文字清晰度

已完成，未提交。公共投骰入口统一D6；超过六项的候选池在后台不放回抽六项并随节点保存，再让玩家投骰。少于六项按连续点数分组；旧存档迁移保留命中奖励。静止与动画终点使用同一顶面朝向。

投骰区加深色底板、亮白奖励文字和浅金点数，六条规则完整显示，行距增大。

验证：六个文件87项定向测试通过（event-dice、event-settlement-unification、project-bug-sweep-round2-dice-lifecycle、project-bug-sweep-events-1024、event-recode-selection-continuity、event-choice-recovery-cloud）；目标ESLint、Stylelint与docs:check通过。

当前平台内置浏览器、当前窗口、内存隔离救护站实页：从实际选项进入大候选池，显示六条规则；手动投出3点，顶面3点，与“迅疾箭”一致；暂离后重进保留同六项及3点结果。截图[result.png](result.png)。构造场景经正式事件处理器运行，未操作真实存档；未完整跑局或验多尺寸。

复用5200时共享变更触发刷新，改用本会话5318预览（禁HMR/监听，最终PID35660/会话12548），取证后已核实身份并停止，端口已释放；未停止其他服务。无build、提交、推送。