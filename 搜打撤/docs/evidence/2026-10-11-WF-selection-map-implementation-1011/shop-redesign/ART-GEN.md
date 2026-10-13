# 商店冬境背景生成样本

2026-10-11。状态：一张候选已生成、转码和解码检查，待根当前窗口与老板审阅。未修改商店CSS/JS、素材映射或manifest。

## 构图依据与分工

来源：[真实商店图分析](REFERENCES.md) S01/S02；项目L1/M1冬境气氛、L2视觉规范；默认 [Wu模板](C:/Users/太平/.codex/skills/artifact-template-wu/SKILL.md) 仅借画风。根最终决定商人左28%、商品右72%，九货位由节点代理实现。原画与方舟商人身份没有被复画，未新增商人姓名或业务叙事。

生成前已与根、节点、地图代理确认：商人主体x5–25%、y17–78%，右x32–96%为商品低纹理安全区；顶部12%、底部14%不放关键脸部/道具。图中没有价格、文字、商品卡、货品框、按钮；交互和可读文字由代码承担。

## 生成与产物

- 渠道：内置 image_gen.imagegen，单张生成；模型/seed工具未返回，未填写推测值。
- 唯一图片输入：C:/Users/太平/.codex/skills/artifact-template-wu/assets/reference.png，作为画法参考；未套无的人设。
- 参考SHA256：58ca8ec7125b1149c190491643caf1c41b9f22a664e0dfd859e31bc90844cfac。
- 工具原产物：C:/Users/太平/.codex/generated_images/01a12a92-b505-7cd3-8cde-6b7393d6e77f/exec-9930ea72-e7de-4855-b784-5d611ab24e15.png。
- 本地源图：source/winter-caravan-1011-v1.png，1672×941，1,832,967字节；SHA256 fceec0012b6d5b8d392ee251373c14b6803c7aa933a1634ca66965833c3dc8c6。源图超过1MB，由source/.gitignore精确排除；git check-ignore已核。
- 新运行产物：game/assets/scenes/shop/winter-caravan-1011-v1.webp，1672×941，100,932字节；SHA256 fd8dc0f12b32f296b586abdd57ea14f89bd34101b28973a6bcc57eee464691d5。
- 转换：复用既有 Pillow WEBP quality=87/method=6 配方（参照game/art-source/scenes/base-home-v4-20261011/encode-wallpaper.py），已有环境可用，没有安装；仅格式转换，不裁切/重采样，完整构图比例保留。
- 解码：Pillow完整load，尺寸与源图一致；view_image检查运行WebP。无透明背景，RGB不透明。
- 可供节点CSS静态URL接入：assets/scenes/shop/winter-caravan-1011-v1.webp；映射与接线由节点代理负责。

## 已看图与边界

原图/运行图可见大块冷灰阴影、少量暖灯、原创商人清楚脸部及双手，风格沿概括块面。商人脸在左约20%/垂直31%，右侧有安静棚布大形，未画UI字/价格。柜台和少量箱轮廓延至约42%宽，右货区局部有低对比环境轮廓；实际九卡覆盖后的避让与文字对比仍由根窗口确认。不是对最终UI/命中区域的验收；无需本轮build。

## 完整生成词

```text
Create one new game-environment illustration, wide landscape 16:9, for the winter expedition supply shop in an original anime card game. Image 1 is DRAWING STYLE ONLY: retain its economical opaque brushwork, broad angular painted color masses, hard-edged light and shadow, sparse hand-drawn contour accents and low detail density. Do NOT depict the reference girl, her hair, clothes, sword or accessories. Scene: a quiet temporary winter supply shop beneath a rough canvas-and-timber shelter, cold gray-blue daylight entering from a distant snowy opening, a modest wooden counter on the LEFT with one small warm lantern. One ORIGINAL anime adult shopkeeper wearing a plain charcoal winter work coat, knit cap and muted scarf; clear friendly human face and coherent hands, standing behind the left counter, no mask or bucket helmet, no silver cloak, no familiar franchise character. Compositional allocation is functional and strict: shopkeeper silhouette entirely concentrated in x5%-25%, y17%-78%; counter and a few broad supply-crate silhouettes remain in LEFT x0%-28%, not sprawling across the screen. The RIGHT x32%-96%, y15%-86% must be a spacious low-contrast quiet charcoal/cool-gray plane of the shop's interior, with only very faint large shelter shapes: this is negative space for nine interactive product cards added later in code. Leave the upper 12% and lower 14% quiet with no face, lamp, merchandise or important props, for live resource and action controls. The merchant is the only high-interest painted focal point; understated pale warm face and a single small amber lamp against cool gray shadows. Integrated scene depth, complete readable silhouettes, simplified timber/canvas material blocks, sparse purposeful highlights, a calm winter atmosphere. No UI, no cards, no product frames, no numbers, no prices, no labels, no readable text, no logo, no watermark. Avoid photorealistic surfaces, smooth 3D rendering, airbrush gradients, busy shelves, detailed market clutter, colored rim lights, particles, glitter, dramatic fog or a second character. This is a production background scene, not a screenshot of a finished interface and not a repaint of Arknights or its merchant.
```
