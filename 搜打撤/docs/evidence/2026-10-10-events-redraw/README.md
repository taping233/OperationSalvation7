# 事件逐张重绘（2026-10-10）

老板授权将现行 eventCardArt 对应的19张事件画面逐张重绘并接入。保留原图人物、动作、道具位置和场景透视，采用宽笔块面手绘；不改事件规则。

全部19张原图与缩略图已替换，19个事件卡缓存revision与对应素材清单已更新。生成方法为内置ImageGen，每张一次调用。画作已在工具返回时查看；未运行测试、资产审计、游戏实页或build，未提交。

| 批次 | 事件ID | 提示词与来源 | 产物与备份SHA256 |
| --- | --- | --- | --- |
| 1 | tt6-demondeal、tt6-bandits、tt6-mystery、tt6-goldmine、tt6-goldhammer | [request](batch1/request.json) | [receipt](batch1/receipt.json) |
| 2 | tt6-relief、tt6-airdrop、tt6-chestdraw、tt6-systemsupply、cmtn7qttxqo4 | [request](batch2/request.json) | [receipt](batch2/receipt.json) |
| 3 | ev19-vital、ev19-pearlbox、ev19-fireballs、ev19-classchest、ev19-recode | [request](batch3/request.json) | [receipt](batch3/receipt.json) |
| 4 | ev19-potions、ev19-arrows、ev19-gamble、ev19-quartermaster | [request](batch4/request.json) | [receipt](batch4/receipt.json) |

运行资源位于 game/assets/scenes/，缩略图位于 game/assets/thumbs/scenes/。源PNG与替换前备份保存在 .tmp/imagegen/events-redraw-1010/batch1 至 batch4，均不进Git；相对路径与SHA256记录在各批receipt。接入脚本位于 .tmp/imagegen/events-redraw-1010/import_events.py。
