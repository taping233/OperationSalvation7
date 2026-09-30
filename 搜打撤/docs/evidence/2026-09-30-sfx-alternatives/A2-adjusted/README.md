# A2 方舟微改

- 老板明确认可方舟版主体，要求轻微改变。以 A 的无损处理后 WAV 为输入，保留旧 A 对照；本轮仅新增十个 A2、调整自有试听页入口。
- 属地：本目录、game/assets/sfx/alternatives/arknights-adjusted/、父会话试听页自有文件；服务仍为 5391 / PID28088 / exec26494，不启动新服务、不改游戏触发、不build/提交。
- 处理目标：小幅音高/速度变化、温和频段平衡及尾音收束；不叠加新音效层，避免把已认可的主体质感重做。
- 来源仍为方舟原素材的衍生处理，继承 A-arknights 的来源与权利记录；微改不使它变成原创或改变其授权事实。
- 状态：十个 A2 已完成、完成未提交；编辑占用释放，5391 服务和当前内置试听页保留。主观变化程度与适配仍以老板试听为准。
- 实际范围：音高 -0.90 至 +0.50 半音，tempo 0.97 至 1.09；5.6kHz 以上柔和衰减 0.3–1.3 dB，18–65ms 尾部轻收束。使用本机现有 FFmpeg Rubber Band 质量模式，打击音选择 crisp/percussive，持续音选择 mixed/compound，不安装依赖。
- 十个 OGG 的 48kHz/双声道/有限值/无削波/尾部检查与MP3合集解码通过，实际 4x 真峰值最高 -8.66 dBFS；HTTP 十项均返回有效 audio/ogg，详见 checks-and-processing.json / http-checks.json。
- Codex 内置当前可见标签验证：先播放 A 的进入事件，再切 A2，动作名称保留且源 URL 正确改变；两项 readyState=4、error=null，停止正常。旧保留标签 4 绑定超时后使用已存在的同页标签 5，没有切外部浏览器、修改窗口尺寸或新起服务。
- A2 已设为无指定 pack 时的默认；同页保留 A 上版对照与 B/C。证据 browser-checks.json / preview-page.jpg，入口 http://127.0.0.1:5391/sfx-audition.html?set=alternatives&pack=arknights-adjusted 。
