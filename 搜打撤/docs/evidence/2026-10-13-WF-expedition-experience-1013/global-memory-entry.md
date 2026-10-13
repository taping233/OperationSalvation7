
# Task Group: 代号柒 搜打撤 全流程二游对比与真实玩家迭代

scope: 从基地到结局的全部玩家可见界面与交互，按真实参考和真实玩家路径持续迭代；不改变项目授权与属地边界。
applies_to: cwd=D:\素材\代号柒\搜打撤; reuse_rule=先核对现行源码、根AGENTS和当前占用；本条记录迭代方法与老板偏好，历史测试不代表当前版本完成。source=2026-10-13老板直接指示，证据 docs/evidence/2026-10-13-WF-expedition-experience-1013/iteration-principles-memory.md。

## User preferences

- 老板要求逐页覆盖从基地到打通结局的所有可见和可交互UI；按真实玩家体验指出bug、难懂难用、不好看与重复文字。每发现明确属地可派Sol子代理实施，主协调负责跨页集成和最终路径。
- 源码一轮完成后还要和已核实的真实二游参考同场景对照再迭代；统一验收同时是下一轮找问题的起点。测试通过或按钮齐全不等于审美通过，老板否决就返工。
- 控制台可加快到后段，必须分别注明真实点击/拖牌、刷新读档、构造到场和自然通关。当前平台内置浏览器标准1920×1080；测试页默认静音，新建或重载先核验。上下文长及时新开主聊天并用精确交接继续，不重做有效证据。

## Reusable knowledge

- 顺序：交接/目标源码/占用与参考板 → 按文件属地实施 → 最小定向反馈 → 当前窗口1920实页 → 真实流程及边界证据。独立origin冻结源码、HMR关闭、只读素材junction；各代理端口档位隔离，PID身份核实后由创建者停止。
- 全流程先手动走一条纵向链，再用游戏控制台到其他分支；构造首脑击破不能写成自然通关。CSS解析、定向测试、构造截图与真实输入各自只证明一层，达到当前层完成标准就停。
- 事件页背景需同时有nodeBg映射和`.node-pg[data-asset-key]`图片CSS；仅有data属性仍会纯黑。CSS `flex:0`可能把承托压到子元素外，改为`flex:0 0 auto`并实页查边界。战斗`overflow:hidden`可因手牌点击自动滚动战场，需实测scrollTop；旧!important可盖新血条。九叠按露出宽度排名称/费，点击先大卡再显式使用与选敌，拖牌要实测命中及回手取消。

## Failures and how to do differently

- 快照514文件复制时drift=0不代表后续定向覆盖后manifest仍有效；交付前再冻结。沙箱Vitest/Vite/junction EPERM时，同命令按审批正常权限重跑，零用例不能算通过。
- 浏览器AX可先于转场稳定帧，首个截图可能是空立绘/旧页；等稳定再判断。跨聊天tab句柄不可复用。Codex原始CDP测试调用本轮被安全策略拒绝，不得绕过；未运行的自动剧本不计覆盖。控制台Agent页“贪心一局”点击后无记录/进度，尚待定性。
- 复用完整案例见 docs/evidence/2026-10-13-WF-expedition-experience-1013/next-root-handoff.md、second-pass.md 与 iteration-principles-memory.md。没有提交/推送/发布/删除/build的自动授权。
