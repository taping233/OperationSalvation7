# 火堆界面与城市场景重绘

状态：实现完成，未提交，待老板验收。老板要求不验证，本轮未运行测试、构建、浏览器或页面截图。

## 本轮要求与实现

- 火堆位于城市；采用混凝土墙、卷帘门与远楼剪影，减少纹理、碎笔触与杂物。首版雪林石屋图被老板否定，未接入。
- 先使用 NAI5 Full 生成底图，再用内置 imagegen 重绘；运行资产为 `game/assets/scenes/fire-rest-1021/city-campfire.webp`。
- 保留左侧场景，右侧集中标题、回复生命、随机复原、职业卡概率、容量反馈与休整按钮。次要领取规则折叠，整理背包与离开作为次级操作。
- 休整完成页沿同一布局展示复原卡牌与额外获得卡牌。原生命、概率、复原、容量、一次性消费及保存行为未修改。

## 来源与文件

完整 NAI 请求见 [nai-city-request.json](nai-city-request.json)，内置重绘词见 [redraw-prompt.txt](redraw-prompt.txt)，最终文件及原始图片 SHA256、路径见 [install-receipt.json](install-receipt.json)。

NAI 原图留在 `.tmp/nai/fire-rest-1021/`；内置重绘原图留在回执记录的生成目录。原始二进制不纳入 Git，运行用 WebP 已复制到项目资产目录并登记资产清单。

当前证据只记录生成与接入，不表示页面视觉、运行性能或交互已验证。
