# 房间背景无损格式派生

现役NAI V5房间候选由PNG改用相邻WebP，1216×832尺寸、解码RGBA与alpha逐字节相同，省424,413B。原PNG保持SHA不变，未删除；已有NovelAI软件/模型/seed元数据及home.visuals来源说明准确记录在receipt.json，沿用既有私有项目使用范围，不宣称新增公开分发授权。

只修改home.visuals静态URL/说明路径、增加WebP和manifest单条；没有转换来源未核实的照相馆框、两张大PNG或字体。WebP不足1MiB，可随源码正常交付，不依赖ignored必需文件或新增构建依赖。

编码使用已安装Pillow12.3.0/libwebp，lossless=True, quality=100, method=6, exact=True；从未resize/crop/repaint。验证见verification.json。完整构建与实机由父任务统一。
