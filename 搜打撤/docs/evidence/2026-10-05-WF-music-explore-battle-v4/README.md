# 灰线行军／黑脉交锋 V4 · 2026-10-05

老板认可标题V8，要求以同样思路完成其他两首，允许更丰富的乐器并参考他人素材／标准，随后要求尽快交付。本轮交两首新V4候选；各自旧版仍为V3，标题V8没有修改。

试听：`02-explore-ashline-v4.mp3`（灰线行军，99.31秒／116BPM）与 `03-battle-blackpulse-v4.mp3`（黑脉交锋，87.27秒／132BPM）。同名24位WAV、OGG、LMMS分轨工程保留。沿用两首独立的D小调／E小调材料，未套用标题旋律。

探索曲采用钢琴、拨奏弦乐、单簧管、双簧管、长笛、巴松、竖琴、小提琴、中提琴、大提琴、低音提琴、柔弦乐、钟琴及室内乐打击。15条演奏分轨、14种program/bank组合，按角色进入，未全程堆在一起。结构为0–8小节定向、8–20木管交接、20–28疏朗空地、28–40新路线、40–48改变回答的返回；空地由双簧管接主线，钢琴与较密节奏留白，返回改变句尾与织体。

战斗曲采用主题弦乐、独奏小提琴回答、拨奏中声部、大提琴脉冲、低音提琴、圆号、小号、长号、巴松、双簧管、钢琴、竖琴、长弦、定音鼓及管弦打击。16条演奏分轨、15种program/bank组合。结构为0–6即刻紧张、6–18冲突、18–26升级、26–30短暂释放、30–42反击、42–48转接循环；铜管与小号重点出现在升级／反击，释放改由巴松和钢琴接管。低音提琴、大提琴和定音鼓的低音编排已核对并修正到本轮采用的常规音区。

两首都把短音力度与长音连续CC11表情分开安排，钢琴真实CC64踏板随乐句改变保持时长；声像按乐器角色固定，低于160Hz的侧向量受控。没有随机抖动时值来模拟真人。稀疏回答按“活动时声能”标定音量，避免因整曲只出现少数次而被整体RMS归一化过度放大。

参考与素材来源：

- 实际采样素材为现有 [S. Christian Collins 的 GeneralUser GS](https://www.schristiancollins.com/generaluser)，文件内信息标明2.0.3 BETA、License v2.0；原音源未修改。内嵌许可另存 [GeneralUser-GS-license.txt](GeneralUser-GS-license.txt)，SHA256见总报告。其许可允许用于私人或商业音乐创作，同时保留作者对部分早期采样来源的说明。
- 制作方法参考 [Spitfire 的 Dynamics／Vibrato／Expression 说明](https://support.spitfireaudio.com/en/articles/11816091-what-is-the-difference-between-dynamics-vibrato-and-expression)与 [BBC Symphony Orchestra Core 手册](https://support.spitfireaudio.com/en/articles/16390288-bbc-symphony-orchestra-core-user-manual)：用于区分持续表情、短音力度和不同乐器／奏法职责。没有使用或安装BBC／Spitfire采样库；GeneralUser GS的音量控制与音符接续不等于那些库的采样层交叉渐变或真实录制legato。
- 保留既有官方BGM分析作为声场、律动与发展对照，没有截取或拼接他人完整曲目、旋律或官方录音。各自音符源见 [explore-score.json](explore-score.json)／[battle-score.json](battle-score.json)。

必要验收见 [verification.json](verification.json)：25项通过，包括两曲48k双声道时长、有限值／无PCM削波、文件和分轨指纹、旧输入及音源不变、MP3／OGG解码、OGG帧数和循环接缝、独立段落覆盖、CC11／钢琴CC64、分轨工程引用及低乐器音区。探索全曲−17.43LUFS／LRA9.1LU，战斗−18.02LUFS／LRA9.8LU；为峰值留余量，比各自旧版低约1.08／1.16LU，未用压缩器强行推到同响度。全曲侧向声能分别3.69%／8.49%，只说明空间构成，不是质量分。

本轮成品由现有FluidSynth两轮演奏取第二轮分轨，再直接混音／厅堂处理／固定增益／接缝处理导出。MMP是分轨冻结的LMMS混音工程，保存的是母带处理前分轨；原始演奏与CC数据在score JSON及render.py，修改后可重新生成。工程引用本会话ignored `.tmp/music-workstation/explore-battle-v4/` 中的冻结分轨，移机需要这些文件或重生成。没有额外完整LMMS再渲染，不把引用检查称为原生渲染验收。

复现：`python docs/evidence/2026-10-05-WF-music-explore-battle-v4/render.py`，随后运行同目录 `verify.py`。`--battle-only`用于本轮战斗低音区修正后的定向重渲染，复用现存探索输出；完整重算默认不带该参数。音频及中间大件仅本地保存，路径／字节数／SHA256与获取方式见 [render-report.json](render-report.json)。没有安装新软件、改全局配置、改游戏、删除旧版、构建或提交；无新服务，离线渲染已结束。

尚未人工试听。配器分工和段落安排是本轮制作选择，技术检查不证明听感更好；由老板试听决定后续微调。
