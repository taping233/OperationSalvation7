# 祭坛地图图标的现存资产校验

本页于 2026-10-18 补齐资源清单指向的缺失来源入口。记录依据是当前运行资产与 `game/assets/asset-manifest.json`，不恢复原始生图请求、参考板或历史实页验收。

运行资产为 `game/assets/scenes/map-nodes/altar-symbol-1017-v2.webp`，68,276 字节，SHA256 为 `290185e51e34e7326822c5dcf3ddb07d831c789d5e9c9b7b72812e5f55478ac6`。清单登记来源为本项目内置 image_gen 原创图。原始大图和生成回执在当前资料中未找到，因此这里只证明已登记来源与当前运行文件的字节一致。

`tests/altar-node-art.test.js` 核对地图、详情与富文本图标同源、尺寸边界，以及运行文件的字节数和指纹。该校验不代替原始生图过程证明。
