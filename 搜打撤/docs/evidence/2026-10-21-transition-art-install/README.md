# 过场现图选择与局部修正

老板先授权补充过场美术，随后要求先列全部现图，由老板选择哪些重新生图；又指出扩展重绘细节经不起推敲，要求基于NAI原图修正即可。当前只交付选择清单和修正版，未接入游戏。

`inventory.json`列23项：现役有图/共用过场、当前无图入口及现有可复用场景、未使用旧图、NAI小稿和本轮候选。现行映射核对`camp-entry.js`、`settings-transition.js`、`showRunTransition/enterNode`、`map-passage.js`、`page-visual-ready.js`、`page-loading.js`与实际调用方；缩略图是原图等比缩小，没有伪造游戏截图。18项含图，其中有重复引用；5项当前无图。研究所冻结排除。每张路径/尺寸/SHA见`inventory-receipt.json`。

本轮第一次内置重绘1672×941保留为已否定候选，不采用；第二次只参考成功的NAI4.5原稿，保留3:2构图和原画法，修门框/接缝透视及通道地面连接，1536×1024。完整请求/输出路径与SHA分别见`request.json`和`correction-request.json`；PNG副本根`.tmp/nai/transition-art-sample-20261021/{expanded-rejected-v1,corrected-original-v2}.png`，大图留本地不入Git。

当前展示在本聊天选择清单中；编号22为局部修正版，23为老板已否定版。助手不代替老板认可新候选。等待老板选图后再决定生成及接入范围；生产JS/CSS、运行图片和资产清单均未改动。

`gallery-check.json`仅验证清单交互、缩略图来源与尺寸，不是游戏实页或玩法验收。未测试游戏、未build/提交，无新增服务。
