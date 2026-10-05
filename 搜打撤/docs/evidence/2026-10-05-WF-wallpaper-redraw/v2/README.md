# 第二壁纸宽笔块面与五人修正

本页为五人宽笔版时点记录；老板续令玻璃/背景及提供画法参考后的当前实装见 [v3](../v3/README.md)。

2026-10-05，Friday（Codex）。老板续令：宽笔触/大面积色块替代不必要细节与褶皱；黑像和常无欲脸对齐选人立绘；去掉左上侧脸男和左中小黑发男，仅保留五名角色。

- 内置ImageGen，块面厚涂技能的原图8/5作画法参考，当前选人立绘 `portraits/full/heixiang.webp` / `changwuyu.webp` 作脸部身份参考。保留壁纸现有服装与动作；黑像按金瞳/后梳露额/宽男性脸/缝线疤痕，常无欲按男性细长脸/黄瞳/圆镜/尖耳修正。白衬衫/裤子和外套合并为大明暗面，头发成束；最终只留无、黑像、常无欲、白塔、星月五人。最终提示词 [prompt-five-final.txt](prompt-five-final.txt)，中间稿未作最终交付。
- 当前运行图1672×941、237722 bytes，同名WebP替换，不裁切缩放。[来源/hash](asset-source.json)记录原PNG、身份参考和中间七人稿；[前轮备份](before.webp)、[去人前备份](before-five.webp)。大PNG留生成路径，不进Git。CSS仅第二壁纸两URL加 `?v=block-five-1005` 避免普通刷新沿用旧图，布局/淡切/第一壁纸/切换逻辑未改。
- [定向素材检查](asset-check.json)：解码、bytes/hash、清单353/353一致，本资产零发现；范围外1106项发现未修。未跑整树编译/全量/build，未提交。
- Codex IAB@127.0.0.1:5200 当前1280×720窗口刷新后目视最终五人/大衣褶面/菜单在位，DOM核对版本URL与contain/延伸层，console error0。[实装截图](current-window.png)、[原始浏览器证据](browser-current-window.json)，已用workflow browser import留证；本次未重新按钮点击，切换逻辑沿前轮证据。其他尺寸/性能/全量/远端CI未核。
- HEAD425d039，本地origin差53/0，远端未刷新。5200既有服务未启停，完成未提交并释放本轮编辑占用。
