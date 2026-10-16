# 角色序列帧无损编码优化

263张R2实际发布的现役WebP在原路径重新进行标准无损编码，全部严格变小，共省5,160,770B（4.922MiB）。原SHA逐一在写前复核，全部RGBA、alpha和尺寸逐字节相等。动画文件与映射未修改；5份animations.json的SHA与R2一致，完整目录中所有当前动画必需纹理已解码。

receipt.json逐项保存旧/新SHA、原来源/许可、字节收益、RGBA/alpha哈希、编码版本/设置；manifest仅同步263条bytes/SHA，原来源与许可保持。所有候选均不足1MiB，不新增依赖。原像素与更早生成PNG来源仍可追溯。

复核：python docs/evidence/2026-10-16-WF-cloud-sprite-lossless/reencode.py --verify-only

重现候选可指定--output-dir到仓库外目录；脚本禁止覆盖正式源，使用receipt绑定的现行同像素WebP重编码并验证精确SHA。验证结果见verification.json。无build、服务或浏览器操作；父任务统一实机和构建。
