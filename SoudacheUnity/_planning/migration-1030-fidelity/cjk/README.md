# 中文自然折行

生产与 Editor 文件已冻结，指纹见 `freeze.json`。本代理未运行 Unity、未操作前台、未改存档或提交。

player-7 已证明 U+200B 被实际 TextGenerator 忽略；本片移除该字符串替换。现在仅 CardFace 规则、指南 Flow、generic 节点正文和选项详情 opt-in 原生字宽排版。其余文字、输入框、照相馆富链接的旧字符索引不受本片转换影响。

`InlineIconText` 在当前字体、字号、实际 glyph pixels-per-unit 下取得未换行 TextGenerator 的 advance；`CjkNativeLayout` 按真实可用宽度选择中文自然断点，生成显式换行。测量高度与绘制使用同一结果和 raster scale，并禁用 native 自动词段折行。缓存按原 document、宽度和 raster scale 失效。原始 `_source`、富标签、已有段落以及图标占位原字符保持；图标占位视为原子并重映射其字符索引。闭标点不移到行首、开括号不留行末；可容纳的英文和数字词段保留，过长词依源 overflow-wrap:anywhere 才允许拆。

私有生产编译：0 错、10 项既有警告。新 Editor 入口编译：0 错、0 警告。合成 advance 的 21 项内容、标签、括号禁则、词段与图标索引不变量通过；这不代表原生字宽或图片已验。

Root 先运行 `Sdt.Editor.CurrentCjkLayoutValidation.Run`：真实当前字体的四种已知文本盒，核 Native character-index 假设、原生最终行宽、标点禁则、内容/富标签保真和图标重映射。此入口不创建场景、不写用户 profile。随后实际当前 2560×1440 Standalone 的完整页面及独立审图仍是效果验收依据。

密度 A/B 应比较原 `SourceText` 的内容保真，保留 `RenderedText` 的显式换行和 lineStarts 差异；不同 raster hinting 可能产生不同换行，不能宣称字形采样提高后行布局完全不变。
