# 工作流短入口标准化

本轮实现优先三项：收官报告汇总、NAI请求记录与本地只读预检、当前Codex内置浏览器可续跑人物外观配方。复用已有验证/台账/取证机制，不引入新任务系统，不修改游戏业务或已接入图像，不发图或扣NAI额度。使用方式见[工作流短入口](../../workflow-recipes.md)。批量反馈映射与交付内容对账本轮未实施，仍复用既有review/staged/ship。

工具为`tools/workflow-summary.mjs`、`tools/nai-workflow.py`、`tools/browser-personnel.mjs`，专属测试为`tests/workflow-standardize.test.js`与`tools/tests/test_nai_workflow.py`。13项Vitest（含既有取证助手5项）+6项Python通过；目标ESLint与567条相对链接文档守卫通过。覆盖失败不被stale掩盖、跳过/未知不算通过、摘要拒覆盖、布尔装备授权、当前档位保护、进度持久化与已达目标不重走、NAI预检只读/凭据脱敏/冷却配额/不可覆盖请求/差分边界。

实际NAI status只读成功，模型/尺寸/节流/冷却及代理端点集中返回；服务器unverified、余额unknown。用[spec.json](spec.json)生成[请求示例](request-example.json)，参考仅记路径/角色/hash，未上传、未生成、未修改guard或预扣额度。像素差分只作为变动提示，不判断审美。

当前Codex内置浏览器5200原窗口尺寸，静音后调用配方：进入城市→指定档位01→配置→常无欲→外观→余响·鼓房，六步与取证在一次调用中完成，未应用装备。[操作记录](personnel-live-route.json)和[取证记录](personnel-live.json)显示preview-observed、real-input、图片1659×948 complete/contain、error空；[截图](personnel-live.png)已保存。刷新读档/自然战斗未验；已达目标跳过导航、断连保留进度由mock契约验证，不冒充本轮真实断连实验。

本轮实际结果与源码清单见[checks.json](checks.json)，已由新工具生成[收官摘要](closeout/summary.json)、[可读摘要](closeout/summary.md)和待负责人审阅的task-close输入；当前文件哈希匹配。摘要将测试passed与页面observed分开，未核项保留，不自动写台账或把证据转换成全量通过。普通任务没有为此创建task.json。

没有新服务、没有修改运行图或游戏业务，没有全量测试/build，本会话未操作index或提交；编辑占用已释放。
