# 透明缩略图通道修复

2026-10-11，Friday / WF-studio-total-1010。

## 根因证据

当前内置浏览器复现冰冻药水：小图文件为assets/thumbs/cards/items/tt3-iceheart-potion.webp，放大最终为原图assets/cards/items/tt3-iceheart-potion.webp。两个容器计算背景均rgb(37,37,39)。原图1024²，左上像素(0,0,0,0)，alpha范围0..255；缩略图448²，同处(0,0,0,255)，alpha全255。UI.js原有渐进加载先小图后原图，导致底色变化；此前容器底色修复不够。

历史临时调色脚本.tmp/rebake-thumbs-tinted.py以convert('RGB')烘焙，丢弃透明通道。现行game/tools/bake-card-thumbs.cjs保留canvas alpha，无须修改其调色逻辑。

## 修复

只恢复扫描确定的60份缩略图alpha：使用当前原图按缩略图尺寸LANCZOS缩放后的alpha，保留当前缩略图RGB，使用无损WebP编码避免二次有损调色。原图不改，其他缩略图不改，保留既有共用深色衬底与渐进加载。

修改前文件备份在忽略目录.tmp/studio-alpha-backup-20261011/；逐文件来源与前后SHA256见assets.json。未全库重烘焙，未build/提交。实页定向复核见后续截图，其他图片未逐张实页验收。

## 定向实页反馈

当前1280×720内置浏览器刷新后，冰冻药水小图与放大原图均显示相同深灰衬底，已观察并保存thumbnail.jpg与zoom.jpg。原始透明通道问题与容器底色来源分别查证；其余59张仅恢复通道，未逐张实页验收，无全量测试/build/提交。
