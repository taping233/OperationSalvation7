# 普通战与首脑战专用过场图复用

2026-10-21老板明确要求把旧战斗专用过场图和旧首脑专用过场图接入当前入口。

普通战使用`game/assets/scenes/transition-battle-v2.webp`，首脑使用`game/assets/scenes/transition-boss-v2.webp`。两文件本轮没有改动；`camp-entry.js`恢复各自映射，`enterNode`显式传入对应选图，其他city-cut入口继续原有field选择。现有文案、时长、跳过、资源准备和取消归属保持原实现。保留共享树已有类型补注，未将其他修改纳入本任务归属。

5套111项定向测试通过：e4真实异步入口、transition-gate-lifetime、run-architecture及两个架构哨兵；e4分别核对普通战与首脑的最终图片路径。camp-entry与e4定向lint通过；scenes的`finishInstant(_completed=false)`既有未用参数lint错误已存在于编辑前的类型补注增量，留原负责人。自有diff检查通过。

Codex内置当前窗口1002×956，在5200调用真实`showRunTransition`构造两种切幕，两图均解码1280×720。截图仅将临时预览延为60秒、动画暂停400ms；`battle-held.png`与`boss-held.png`记录实际呈现，不冒称自然跑局或真实战斗输入。最初`battle.png`截到标题页，不作为验收图。页面error为空，临时标签已关、共享5200保留。完整边界和SHA见`verification.json`。

完成未提交，编辑释放。未build、提交或推送。
