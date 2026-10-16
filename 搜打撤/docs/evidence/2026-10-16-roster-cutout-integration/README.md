# 黑像 / 星月透明候选无损转码核验

## 结论

两张 PNG→WebP 的解码 RGBA、alpha 和画布均完全一致，但都超过当前每文件 <1 MiB（1,048,576 bytes）门槛，**保持候选，不正式接入**。父任务已确认不放宽门槛、不做有损压缩，不再进行额外转码试探。未改生产资产、资产清单、源码或测试。

| 候选 | WebP bytes | 超出 1 MiB | 解码 RGBA / alpha 差异 | 画布 |
| --- | ---: | ---: | --- | --- |
| 黑像 v1 | 1,160,262 | 111,686 | 0 / 0 | 1024×1536 |
| 星月 v2 | 1,103,162 | 54,586 | 0 / 0 | 1024×1536 |

两张合计 2,263,424 bytes。原始 PNG 保留于现有预览目录并沿用该目录的 PNG 忽略规则；超限 WebP 只保存在仓库外：

- `/workspace/shared/roster-cutouts-lossless-20261016/heixiang-cutout-v1.webp`
- `/workspace/shared/roster-cutouts-lossless-20261016/xingyue-cutout-v2.webp`

本任务不放宽/绕过资产门槛，也未把必需运行时图片排除出发布流程。这里的仓库外文件只是未接入的评审候选。

## 保真与来源

- 读取 [原候选 manifest](../../previews/roster-cutouts-20261016/manifest.json) 中的真实 source、source_sha256、generated_source、variant sha256 和完整提示词。两张原立绘、两张预览 PNG 与各自原始生成件的实际 SHA256 均匹配。
- 编码只用 Pillow 的 WebP lossless、quality=100、method=6、exact=true。lossless 模式下 quality 控制压缩努力程度；exact=true 保留 alpha=0 下的 RGB，因此核对覆盖完整 RGBA，不只比较可见像素。
- 未缩放、裁切、修边、重绘、调整颜色或 alpha；未做有损压缩。两张都保留原 alpha 0–254。
- “逐像素一致”只指已经存在的透明 PNG 候选与本次 WebP。生成式去底相对原白底定稿的保真度仍以原候选说明和父任务的真实 HTML 深/浅底审核为准，不能据此声称与原白底画面逐像素一致。
- 白塔、常无欲未转码、未接入。根据父任务的实际合成审查，白塔法阵/金色重描与常无欲烟雾白亮边仍留待美术评审。

完整哈希、RGBA 哈希、编码版本、RIFF chunk、尺寸、alpha 范围和像素等价检查见 [transcode-verification.json](transcode-verification.json)。可审计的格式转码脚本见 [transcode.py](transcode.py)。

## 现行接线只读检查

`game/src/hub/hub.personnel.js`：

- `personnelDefaultPortraits` 当前只含 `wu`；仅 `skin === 'default'` 命中时替换配置页主图 URL
- `alphaPortrait` 由同一映射派生，写到人物主图 figure 的 `data-portrait-alpha`
- 主图 `personnelPortraitStyle` 读取 `[width,height,left,top,right,bottom]`，输出高度、底部和水平中心三个 CSS 变量；本次候选必须改用自身画布和 alpha 边界，不能沿用旧横版边界
- 外观缩略图仍走 `art.skinUrl`，人物头像仍走 `art.classAvatarArt`

`game/src/hub/hub.presentation.js` 的 `updatePersonnelV12`：

- 异源切换保留旧图，下一图 onload/decode 后在同一个 reveal 中同步图片样式、portrait-fit、figure 的 portrait-alpha 和 src
- 请求序号只允许最后目标显示；同 src 分支也会同步 alpha marker
- 因此 alpha→alpha、alpha→原图的机制已存在，新增两项映射不需要再次修改该文件

`game/css/base-personnel-v12.css`：

- `data-portrait-alpha="true"` 的私有规则已覆盖透明舞台、透明边框、无阴影与 `mix-blend-mode:normal`
- `data-portrait-fit="body"` 消费共用边界变量；非默认场景皮肤的现有 cover 规则不变
- 不需要为这两个角色增加 CSS 分支

`game/src/core/art.js`：全局 full、skin、avatar、battle 映射相互独立。最小接入应继续局限人员页私有覆盖，不改全局映射、卡图、战斗图或其他皮肤。

## 供后续审批的最小接入方案

**以下只是建议，当前因文件大小门槛未通过，不执行。**

1. 保留原定稿文件，后续只有资产策略明确允许后，才将最终核准候选新增为 `portraits/personnel/heixiang-default-cutout-v1.webp`、`portraits/personnel/xingyue-default-cutout-v2.webp`
2. `personnelDefaultPortraits` 增加这两项；默认主图的 alpha marker 会自动变为 true，其余角色、非默认皮肤和外观缩略图保持原路径
3. 仅更新这两项 `portraitBounds` 为按 alpha≥128 测得的候选边界；坐标 right/bottom 为 Pillow bbox 的排他边界，沿用现行计算方式
4. 按最终获批文件的实际 bytes、SHA256、provenance 新增两条资产清单，并同步 count；保留既有全量条目，不手改其他资产观察值
5. 参数化现有 `tests/hub-personnel-portrait.test.js`：wu/黑像/星月默认图命中私有 URL+alpha，白塔/常无欲默认图仍走原图；保留 Wu 三皮肤、原缩略图、同 src 和保留 DOM 的检查，补连续 alpha/alpha/非 alpha 切换的最后意图覆盖
6. 父任务再用当前内置浏览器核对角色实际切换、完整头/道具/靴、深浅底及非默认皮肤；按质量门定向验证，并在合适的集成窗口核对资产 consumer 指纹和正常构建

| 人物 | 候选 alpha≥128 bounds | 建议 style |
| --- | --- | --- |
| 黑像 | `[1024,1536,35,12,987,1527]` | `--portrait-height:0.932752;--portrait-bottom:3.453465%;--portrait-center:-49.902344%;` |
| 星月 | `[1024,1536,79,21,954,1509]` | `--portrait-height:0.949677;--portrait-bottom:2.330645%;--portrait-center:-50.439453%;` |

## 字节影响（仅分析）

- 若将两张按现状新增且保留原图，运行资产总量新增 **2,263,424 bytes**（约 2.159 MiB）；不是用新图覆盖原图来抵销体积
- 两张原人物 full 文件分别为 190,598 / 180,912 bytes。对应两张人物页主图请求合计增加 **1,891,914 bytes**；原图可能仍被其他页面或外观缩略图请求，具体会话传输量依缓存与打开路径而定
- 每张仍为 1024×1536，按 RGBA 解码的像素存储为 6,291,456 bytes；没有通过降低尺寸减少解码数据
- 本任务未运行构建，因此不声称新的构建压缩体积或预算通过

## 验证边界与交付

- 已完成：定向 handoff；来源 SHA；两次无损编码；原件保留；WebP 重新解码；全 RGBA / alpha 字节一致；画布一致；大小门槛（两张失败）；迁移至仓库外后再验 SHA 与解码一致；现行 alpha/bounds/skin/battle 路径只读审计
- 只读生产指纹见 [production-readonly-reference.json](production-readonly-reference.json)，涵盖当前人员页、presentation、CSS、Art、清单、相关专测、原 full 与皮肤、黑像/星月 avatar/battle 文件
- 未操作浏览器、服务、build、测试、提交、推送、发布或生图工具；未改任何生产文件
- 父任务负责统一共享台账。本子任务的独占证据已完成，编辑释放；后续整体资产策略由美术评审决定
