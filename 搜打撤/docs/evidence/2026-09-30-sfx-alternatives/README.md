# 三套现成素材试听方案

- 老板否定 v6，明确授权直接轻调方舟声音或使用优秀开源素材，并提高并行度、给出多个版本。
- A 子代理 /root/arknights_samples：A-arknights/ 与 game/assets/sfx/alternatives/arknights/；方舟素材轻调，准确保留来源和权利事实。
- B 子代理 /root/cc0_ui_samples：B-cc0-ui/ 与 game/assets/sfx/alternatives/cc0-ui/；现成冷感 UI + 对应 CC0 游戏声音。
- C 子代理 /root/cc0_action_samples：C-cc0-action/ 与 game/assets/sfx/alternatives/cc0-action/；独立录音材质与动作素材，避免与 B 共用主体。
- 主代理只改自有试听页 HTML/JS/CSS，汇总试听与验收；子代理不操作浏览器，不启动服务，不改共享台账或游戏调用，不提交。
- 每套相同十个动作 ID；页面支持在同一动作之间切方案，方便直接对比。不将方舟轻调素材说成原创或已获本项目授权。
- 基线 fd38468；沿用 127.0.0.1:5391 / PID 28088 / exec 26494，父代理只用自己的 Codex 内置试听标签，避开 Luna 的 5386 试玩标签。
- 状态：三套各十个已交付，完成未提交；编辑占用释放，5391 服务保留供老板试听。未安装依赖、build、删除旧版本或接入游戏。
- 验证：父代理逐项复核30个 OGG 的 48kHz/双声道/Vorbis、有限数值、无削波、清单时长与HTTP音频字节一致；所有文件返回 audio/ogg。见 parent-checks.json。
- 内置浏览器实际点击出牌，再切 B/C，三套均保持“出牌”且正确切换源文件，readyState=4、error=null；V 键回到 A、停止播放通过，当前窗口截图与记录见 comparison-page.jpg / browser-comparison.json。未触碰 Luna 的 5386 标签，未进行多尺寸检查。
- 听感选择由老板在同页比较；数字检查只证明文件与播放功能，不代替音效质量或游戏流程验收。A 含确认/格挡/破盾/首脑候选用途，具体映射未核原版客户端。
- A：原游戏素材轻调，来源与权利事实见 A-arknights/README.md；B/C：实际使用来源均核为 CC0，许可原文和处理记录在各子目录。
- 交付入口：http://127.0.0.1:5391/sfx-audition.html?set=alternatives&pack=arknights 。先点一个声音，再切 A/B/C，会自动播放同一动作；V 键也可轮换方案。
- 最终当前窗口检查：十个试听按钮全部在固定播放器上方可见，见 current-window-layout.json；页面已标记为保留的交付标签，默认 A 且停止播放。没有设置或修改 viewport。

## 后续：方舟主体微改

老板认可 A 后要求轻微改变，新增十个 A2 并保留 A/B/C；当前默认 A2，原三套验证与截图仅证明其原交付时点。A2 的参数、验证和当前页面见 [A2-adjusted](A2-adjusted/README.md)。音效仍未接入游戏触发。
