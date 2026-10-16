# 无配置页透明立绘

当前配置页默认无的主展示使用独立版本化透明图 `game/assets/portraits/personnel/wu-default-cutout-v1.webp`。仅 `hub.personnel.js` 的主图 URL 使用私有覆盖；外观缩略图、三张场景皮肤、其余四人、出征、战斗、卡面与 `core/art.js` 全局映射保持原路径。原定稿 `portraits/full/wu.webp` 未覆盖，SHA-256 仍为 `71948f3902351f877de9a8375af33358dc44975ce2965f57d5b4c2d123cf43dc`。

素材由内置 imagegen 对当前定稿进行透明背景编辑；当前内置浏览器深灰底的 [原图与候选对照页](../../previews/wu-cutout-20261016/index.html) 已确认去白底明显改善，脸、衣着、姿势和武器保留可接受。此次接入只做 WebP 无损编码，不再抠图或重绘。源 PNG 超过 1 MB，不入 Git，其原输出路径、字节数与 SHA-256 见 [收据](receipt.json)。

运行图为 1024×1536 RGBA，1,011,996 字节（0.965 MiB），SHA-256 `68fe23ed56b3b9fee7e3fbfef64546ddc260da282897b87703034446b00432de`。Pillow 使用 `lossless=True, quality=100, method=6, exact=True`；解码后全部 RGBA 字节与生成 PNG 一致，包括完全透明区域的 RGB。Alpha 范围 0–254，完全透明像素 1,049,497 个。配置页定位边界按 Alpha≥128 取 `[264,6,935,1525]`，画布和分辨率没有缩减。新路径属于现有 Vite `portraits` 运行资产复制目录，无需新增构建管线。

资产清单仅新增这一条与 count+1；写入时已核对全部其他条目未变。新增专测覆盖默认大图、四位同伴默认路径、三张已装备皮肤、外观缩略图，以及皮肤浏览往返不修改存档。

首次真实配置页确认新图已加载，头顶、剑尖、鞋完整；同时发现 `feedback-oct12.css` 的浅灰舞台与 `mix-blend-mode:multiply` 仍保留白板。后续仅对默认无的 figure 增加 `data-portrait-alpha="true"`，在 `base-personnel-v12.css` 追加更精确的透明舞台、透明边框、无阴影及图像 `mix-blend-mode:normal` 规则。其余角色与场景皮肤标记 false，不命中覆盖；已有 R1 与 feedback 样式保持。专测同时验证标记切换及两条 CSS 规则仅命中默认无。

保留 DOM 的人物更新器 `hub.presentation.js` 在新图解码后的 reveal 与同 src 两个分支同步该标记，旧图尚未替换时不提前改变其混合模式。实际 `presentHub` 回归验证默认无→皮肤→默认无→黑像，以及同 src 刷新，确认图像与标记一起切换、人物容器保持复用。此次只追加这两行同步，不修改播放器、全局预热或源清单指纹。

验证：
- 八个定向测试文件，77/77 通过，见 [Vitest 报告](vitest.json)；含新增立绘与实际更新器专测、人物导航、人物动作、基地流程回归、contracts、architecture-boundaries、base-subpage-header-readability 与 premium-ui-pages
- 定向 ESLint、`node --check` 与自有 diff 空白检查通过
- 新资产与清单检查无问题；全局增量资产门 0 错误、617 条未变历史警告，见 [资产检查](asset-check.json)
- 追加透明舞台与 normal 混合规则后的真实配置页、其他外观切换及当前窗口视觉核验待复验，候选对照确认不代替正式游戏验收
- 未 build、未提交、未推送；未创建或操作服务

回退只需撤去 `hub.personnel.js` 的配置页私有覆盖与对应边界变更，原定稿和原路径始终保留。
