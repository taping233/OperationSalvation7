# 第二轮15项音效处理

老板在前轮32项替换后导出15个仍需更换的触发场景，随后补充「进入界面可以不用音效」。据此将open、safeEnter、altarEnter、doorEnter、shopEnter、extractionEnter六项取消声音；close、energyDown、buffDown、curseEnd、parry、curse、attackIce、heal、cardRestore九项换音。其余91个事件定义保留，音乐未改，制作名单音效署名没有加回。

6个取消项使用空files列表和零增益，不生成静音WAV，也不加载或创建对应音源，游戏行为保留。当前/旧试听页均保留这些项目并标明「已取消音效」，不触发加载失败；旧页连续播放跳过它们。原E编号、勾选与备注保留，S编号随去重变化。

新声音为Kenney Interface Sounds与Impact Sounds，以及効果音ラボ两份新原件，均未在被否定的这15项上一轮音源中使用。关闭与能量降低采用短操作音；格挡采用轻金属与闷碰两种变体；冰霜改用轻玻璃颗粒；诅咒采用低重力音色；恢复及诅咒结束采用克制的恢复提示，使用不同片段长度/速率。8个WAV的制作选择不代表老板已听感验收。

官方来源：<https://kenney.nl/assets/interface-sounds>、<https://kenney.nl/assets/impact-sounds>，均CC0；Interface源包复用本会话已取得的官方包，Impact源包由官网公开下载链接获取。効果音ラボ新原件来自已保留官方页面中的下载链接，允许免费商业游戏与修改，禁止独立素材再分发和AI训练。只用于本项目运行及本机私有审听，未对外发布素材包。

捕获基线与15个ID见before.json；逐项前后映射、6个静音和9个换音见 [mapping.json](mapping.json)；8个WAV的原件/运行路径、SHA256、处理参数与许可见 [receipt.json](receipt.json)。获取及制作方法见 [prepare.py](prepare.py)，接入方法见 [install.mjs](install.mjs)。音频、原始OGG/MP3及ZIP不进Git，许可与加工说明留在运行素材目录SOURCES.md。

入口：<http://127.0.0.1:5200/sfx-review.html?batch=selected15-r2>。按老板要求未运行测试、build、浏览器或耳听验收；安装过程仅核对授权ID和共享文件基线，避免覆盖其他内容。没有启停服务、提交、推送或发布。
