# Unity 原生资源导入专项

独立磁盘核对：14 张现行纸框 PNG 与源 WebP 尺寸一致，13 张为 512×768，interior 为 256×384；Importer 元数据均为 nPOTScale=1、maxTextureSize=2048。CardVisual 开孔按 512×768 计算，CardFace 纸框使用 preserveAspect，Res.Sprite 按实际 texture.width/height 创建精灵。磁盘证据支持 NPOT 形变假设，真实导入尺寸待主会话后台执行确认。

后台入口：`Sdt.EditorTools.CurrentTextureQuality.NormalizeAndProbe()`。设 `SDT_UNITY_CHECK_OUTPUT` 为新的输出目录，先保存全部原生 before.json 与 before-after.json，再在确认形变后，仅设置 `Assets/Resources/Art/Current/` 内现有 PNG 的 npotScale=None 并原生重新导入。保留 maxSize、压缩、mipmap、纹理类型等设置，不改原图。已有 before.json 会拒绝覆盖；没有加载时自动修正钩子。

输出 result.json 与 before-after.json 含源 IHDR、原生 Texture2D 尺寸、比例、NPOT/maxSize、源 SHA256、修改路径。尺寸不受 maxSize 限制时要求精确相等；超限时检查比例允许一个目标像素舍入。执行后需要继续复核真实卡框画面。正式只读检查可调用 `Sdt.EditorTools.CurrentTextureQuality.Verify()`，返回 passed、failures 与逐图 samples，避免仅验证磁盘 SHA。

字体独立证据见 source-inspection.json：NotoSansSC-Regular.ttf 与 Bold.ttf 的字节完全相同，两者 OS/2 weight=100，均有 wght 100–900 变量轴，默认100。将它们作为静态 Regular/Bold 导入无法提供真实400/700字重，正文极细与默认细体吻合。当前环境无 FontTools，使用只读 sfnt 原始表解析；未安装工具、未修改字体。是否实际渲染100仍须原生字体复核。

本分工没有启动 Unity、共享编译、前台窗口或输入操控；原生执行与正式检查接入由主会话统一完成。
