# 地图动态字体修复与原生复核入口

当前状态：已独立读取 `搜打撤/docs/evidence/2026-10-29-unity-desktop/visual-2/map.png`，确认地图节点名称和编号呈碎线、缺笔，原 `HasCharacter`/世界高度断言无法证明画面完整。已补地图动态字体刷新和诊断；**新画面仍须主会话统一原生离屏复核**。

依据：当前 `BoardView` 原先未处理动态图集重建；Unity 自带 `UGUI/UI/Core/FontUpdateTracker.cs` 与 `Text.cs` 在 `Font.textureRebuilt` 后主动失效几何以更新 UV。修复复用当前 NotoSansSC-Bold 字体、材质、原有字号与布局，不创建新字体资源。

生产改动仅 `Assets/Scripts/Sdt.View/BoardView.cs`：地图字符一起预热；图集重建后集中重建所有地图 TextMesh（包含暂时隐藏节点），重绑当前材质；在 LateUpdate 和棋盘相机实际绘制前处理待更新文字，禁用视图时取消事件订阅。

诊断仅 `Assets/Editor/MapVisualProbe.cs`，主会话可按既有后台渲染流程调用：

1. 地图创建后调用 `Sdt.EditorTools.MapVisualProbe.StressFontAtlas()`，保存返回值，然后稳定数帧。
2. 沿现有 `OffscreenCapture` 拍摄新 `map.png`，必须人工查看可读性。
3. 调用 `Verify()`，记录图集纹理与更新号、重建代数、字形缓存 UV/图集墨迹像素、材质纹理、渲染器纹理覆盖、可读取的原生 Mesh UV。
4. 调用 `ExportFontAtlas(绝对路径)` 保存实际 GPU 字体图集 PNG，供缺笔定位。

使用独立目录 `MapFontCheck.csproj` 对当前 Unity 6000.6.7f1 DLL 编译 View 和探针，通过 0 警告、0 错误。未启动 Unity、未操作前台、未运行共享编译。图集断言是诊断证据，不能代替新地图 PNG 的完整字形检查。
