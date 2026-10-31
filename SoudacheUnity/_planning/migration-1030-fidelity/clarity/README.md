# 实际播放器清晰度修复与验证

当前实际证据为本任务fidelity-1030/desktop-final-player-2：正式Build/Desktop、2560×1440、DPI120、D3D12、正常ScreenSpaceOverlay/CanvasScaler，共48张画面。result.json、process.json和density-comparison.json分别记录实际绘制、后台宿主与文字测量；最终视觉结论归独立审查。

UGUI动态字体原先只计Canvas.scaleFactor，祖先放大的CardFace把低密度字形再次放大。InlineIconText现按Canvas及祖先局部放大生成字形，再换回同一逻辑单位；字号、外层布局与字体内容保持。PhotoInlineLinks使用同一单位。InputField因Unity caret/selection消费固定pixelsPerUnit，保持原生单位，证据单独标识。

22个文本A/B样本通过内容、外层布局、字体设置及密度提高检查，原像素裁图供独立查看。滚动视口自适应引起的一处断行变化在报告中保留；中文折行和实际字形测量另由cjk-1验证。

后台复验使用现成工具，新输出目录必须为空：

    & ./_planning/migration-1030-fidelity/clarity/run_hidden_player.ps1 -Executable './Build/Desktop/代号柒.exe' -Output '<fresh evidence>' -TransparentCompositor -TimeoutSeconds 240
    python ./_planning/migration-1030-fidelity/clarity/analyse_player_review.py '<fresh evidence>'

宿主保持零透明度、非激活、点击穿透，使用隔离profile；不操作用户窗口、真实存档或剪贴板，不发送系统输入。播放器维持正式Canvas与当前物理客户端，动态缓冲比例1，在WaitForEndOfFrame后ReadPixels读取自身backbuffer。Windows子窗可能标为visible，整体仍由零透明度宿主保持不可见。

只有显式--sdt-background-review才启用QA及同页旧/新密度A/B，普通启动默认新密度。构造UI事件、直接领域命令与实际绘制分别记录；没有物理长按、多尺寸或全部自然随机流程覆盖声明。此前宿主、截图方式和QA旧轮结果归修复历史。
