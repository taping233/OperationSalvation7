# 一只实图结构箱：NAI → 内置组合

2026-10-11，老板否定前套木箱，root转达新范围：只一只STS2青黑箱结构，NAI+内置真正组合，不成套，不接运行引用。

## NAI一次请求

现有tools/nai_gen.py与nai_style.py v1.3，默认nai-diffusion-4-5-full，28steps/scale6.5/k_euler_ancestral/karras/variety_plus。1344×768免费档，seed1011569501，HTTP200直连；guard默认使用，无改默认/安装/手工重试，token未输出。完整prompt/UC在nai-request.json与generate-nai-once.py。

客户端没有图ref，本阶段`naiImageReferences=[]`。真实STS2图只用于查看后描述低宽拱盖、连续箱身、两道宽包边和盖缝，**没有把结构原图送入NAI**。候选source/nai-sts2-cyan-chest-v1.png，855077B，SHA256 `8b83b86de82aede7dc182d51f9377689c3b6970aaab7449e9a6bb287629bee37`。实际看图：箱体结构可辨，但颜色偏亮青、表面顺滑，不能称画法合格。

## 内置单候选组合

实际同时输入四图：NAI候选为编辑目标、真实STS2箱只结构、珍珠盒/锦囊只画法。输出source/builtin-sts2-nai-card-combo-v1.png，1254² RGBA，alpha0–255，1370964B，SHA256 `a8178d3e026d0b05137e6dbb1ce3144aa640177cc18b168b1e36b9199376cda9`。>1MB源图本地精确.gitignore，git check-ignore通过；只原字节复制无裁切/重采样/接入。生成原path与四输入SHA/角色见combo-receipt.json，工具未返回model/seed。

已实际看组合候选：色相压回青黑，双宽边、拱盖、盖缝完整；顺滑青色改为大方向笔触，扣件改小平铁片，无巨大金锁，无雪/场景/地板/鼠标/白圈/光柱。是否好看与是否最终采用待根/老板观察，alpha技术事实不等同审美合格。只这一只，未生成新家族或改CHEST_ART/manifest。

## 完整内置编辑词

```text
Perform a real combination EDIT of image 1, the NAI chest candidate, into ONE game prop on a fully transparent background. Explicit input roles: image 1 is the EDIT TARGET and initial single-box composition; image 2 is the real Slay the Spire 2 chest STRUCTURE reference ONLY; images 3 and 4 are the project's actual pearl-box and crimson-pouch cards, PAINTING STYLE references ONLY. The output must remain just one closed chest, no collage or comparison sheet. Correct image 1's overly bright cyan and smooth airbrushed surfaces. Follow image 2's LOW WIDE arched lid, continuous dark squat body, TWO broad structural edge bands that curve over the lid and continue vertically down the front/body edges, and ONE dark horizontal lid/body seam. Main broad front face, visible right arched end, quiet uncomplicated construction. Avoid copying image 2's mouse pointer, white hover outline, rocks, pedestal, floor or black background. Keep only the useful chest construction. No huge golden lock, no keyhole sculpture; use one SMALL unobtrusive flat recessed iron fastening tab, not a new focal ornament. Main material deep blue-black matte metal, restrained muted teal-blue bands and blue-gray light planes. Reduce saturation substantially from image 1: NOT a luminous turquoise chest. Paint the chest using image 3 and image 4's loose, opaque, directional broad brush masses and 3 to 4 coherent hard-edged light/shadow groups. Visible economical brush edges inside the surfaces, fully filled readable outer silhouette; not uniform tiny triangle facets, not perfectly smooth CGI gradients, not glossy 3D, not clean vector lineart, not pixel art. Light from upper-left, quiet broad dark front and side, simplified metal highlights as painted masses rather than white light strips. Square canvas, chest roughly 78 percent canvas width, all edges fully visible with transparent margins. Clean real alpha, fully opaque chest interior. No ground shadow plane, scenery, snow, ice, blue ribbon, rose, character, faction emblem, jewels, coin burst, magical symbols, UI border, white outline, glow, light beam, particles, letters, numbers, logo or watermark. No new reward rules or story identity. Prioritize the low wide cyan-black construction of image 2 and the actual project cards' painting, rather than reproducing the failed reddish wooden chest family.
```

地图/导航与背包另待真实新屏继续迭代，本资产仅单样本，不暂停其他授权域。
