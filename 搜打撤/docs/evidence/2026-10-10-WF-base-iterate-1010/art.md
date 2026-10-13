# 基地第三版美术交付

本轮使用内置 ImageGen 完成 17 件可接入美术：10 枚基地导航与资源图标、6 张伙伴完整插画、1 张主页宽景。生成模式未使用外部 API 或安装依赖；WebP 编码只使用现有 Pillow 缩小原图、保留透明 alpha。

## 画法与身份

共同画法为手绘二次元、低细节、大块不透明色面、硬边明暗与概括笔触。图标统一使用冷灰暗面、奶油亮面与局部暖金；伙伴各自使用物种对应的局部色彩。

Wu 基准图仅作为画法参考。其他主体没有沿用她的蓝眼、虎牙、发型、护目镜、黑蔷薇、蓝缎带或衣饰。犬稿保留老板认可的第二稿造型与坐姿，定向修正为棕眼和没有尖牙的正常狗嘴。招财猫为姜色奶油毛、琥珀眼与红绳金币；猎鹰为棕灰羽毛与棕眼；机器人为灰色机械结构和琥珀色眼屏；火焰精灵为暖橙奶油块面与棕眼；企鹅为灰白羽毛、棕眼与暖黄色围巾。

## 可接入文件

全部位于 `game/assets/icons/base-v3/`，主会话负责源码接入与当前窗口实页比较。

| 类型 | 文件 | 输出边界 |
| --- | --- | --- |
| 导航 | `expedition.webp`、`warehouse.webp`、`personnel.webp`、`shop.webp`、`archive.webp` | 最长边 480 px，透明 |
| 资源 | `wood.webp`、`rations.webp`、`key.webp`、`coin.webp`、`rune.webp` | 最长边 480 px，透明 |
| 伙伴 | `companion-dog.webp`、`companion-falcon.webp`、`companion-cat.webp`、`companion-robot.webp`、`companion-fire.webp`、`companion-penguin.webp` | 最长边 720 px，透明 |
| 主页场景 | `base-home-v1.webp` | 1672 × 941，接近 16:9，不透明 |

主页场景为冬夜远征者休憩厅：左侧灰墙与地面保持安静空间，右侧暖灯书桌、书本、茶杯、披毯和雪夜高窗形成视觉焦点。场景没有人物、文字或 UI，没有新增建筑经营设定。

## 检查与修正

先生成并检查仓库和出征两枚代表图标，再扩展同一体系。每一张生成结果均检查完整轮廓、主体辨识、块面画法、身份、眼色与尖牙边界。文件检查确认 16 件图标/伙伴存在透明 alpha，主页场景为不透明；图标不超过 480 px，伙伴不超过 720 px，交付 WebP 均低于 1 MB。

火焰精灵前两稿存在弥散光晕和背景，记录为 rejected，未产出可引用 WebP。第三稿改为完整、不透明的硬边火焰形体，背景透明，通过检查后接入候选集。其他素材均以检查通过稿交付。

## 原图与生成收据

完整提示词、每张图的输入参考、内置通道、来源绝对路径、项目原图相对路径、原图 SHA256、输出尺寸和字节数保存在 [`receipts.json`](../../../game/art-source/ui/base-v3/receipts.json)。获取方式为当前 Codex 内置 ImageGen，保留默认 `C:/Users/太平/.codex/generated_images/` 原图，并复制到 `game/art-source/ui/base-v3/raw-*.png`。

所有原图通过该目录局部 `.gitignore` 排除；原图大于 1 MB 时也不会进入 git。重编码辅助为 `game/art-source/ui/base-v3/encode.py`。本子任务未改游戏源码、CSS、共享 manifest 或项目台账，未启动服务、build、提交或修改伙伴能力数据。游戏实页表现由主会话验收。

## 当前接入状态（2026-10-11 重做后）

主页改用已获认可的 `game/assets/scenes/hub-wallpaper.webp`；`base-home-v1.webp` 和五枚导航插画保留为上一轮候选，当前主页不引用。五枚资源图标与六张伙伴插画继续接入，资源计数在主页上栏和仓库，伙伴完整插画位于伙伴页。当前主页入口采用轻量文字；不要把本文件的生成交付清单等同于全部现行引用。完整接入与实页结论见本目录 README.md。
