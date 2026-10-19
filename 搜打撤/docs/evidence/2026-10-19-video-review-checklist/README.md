# 录屏体验复核清单

现有录屏工具增加候选编号、源时间区间、前后各2秒上下文（裁到分析范围）、类型对应的体验复核提示，输出可填写的 review-checklist.md；JSON schemaVersion 2 增加各视频 reviewChecklist。全部条目初始是 needs-review，低变化先核对输入或预期动画，不把阅读菜单、暂停和等待判为卡死。HTML候选点击同步更新并排采样；清单的锚点可直接展开时间线。

定向验证：tests/video-review.test.js 共6项通过（含实际ffmpeg合成视频管线、片段偏移与范围裁剪、静止画面提示、Markdown文件名转义、候选同步和深链DOM行为），Node语法与定向ESLint通过。合成视频不是实玩；未启动浏览器或录屏，不给出游戏FPS、卡死或性能改善结论。

workflow review 按显式三路径运行，选中录屏定向测试；恢复副本无Git，handoff无法获得HEAD/index。docs:check实际返回 ok:false，存在恢复快照缺失链接（工具箱既有 STATUS.md、agent-protocol.md等），本次录屏节没有新增本地Markdown链接；未将该检查记为通过。未运行游戏build/全量测试；本批为内部工具改动。
