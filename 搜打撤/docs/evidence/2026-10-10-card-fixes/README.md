# 10-10 点名卡牌修正

老板授权修改点名卡、删除三张卡，并明确接手卡牌数据文件，保留现有改动。

- 毒爆（cc-poison-burst）费用2→1。
- 神秘召唤仅发现传说。同步描述与结构化卡池；解析器复合池必须含「或」，避免纯传说误收能力卡。
- 员工通行证A保留cmtmvq6ss84l，退役旧合成材料tt-token-color；事件碎片计数与祭坛流程保留。员工通行证C改传说。
- 深海印记tt3-deep-seal、魔法锅炉tt3eq-boiler、急救合剂tt-medneedle退役；清除源批次与迁移批次定义，旧档退役列表随sync v36刷新。
- cards-sync由既有sync脚本导出的buildDoc生成，仅覆盖3个目标；现有银河之旅/恶魔之力改动保留。输入和脚本在本目录。
- 剑荡妖邪、飞身劈由内置imagegen重画为无人剑势；提示词、参考、源图与SHA256见[request.json](request.json)、[receipt.json](receipt.json)。
- 封印肢体1、2已为手；3、4各两次内置生图均报网络错误，改复用1、2现有手图，保留透明底，形成四只手。手势重复，不是四张新画。来源与接入见[hands/request.json](hands/request.json)、[hands/receipt.json](hands/receipt.json)。

## 验证

定向Vitest：card-fixes-1010、cards-sync-snapshot-guard、message-batch-0917、m4-data、m6-data、m10-data、m11-data共7文件，97通过、1跳过。覆盖完整播种、退役名单、存活卡迁移与神秘召唤实际出牌发现选项仅传说。

docs:compendium：12通过，图鉴已同步。validate-data与相关diff --check通过。

Codex内置浏览器127.0.0.1:5200，当前默认窗口，真实按钮点击与搜索：照相馆显示268张；毒爆费用1；通行证检索只出现一张员工通行证A；员工通行证C大图背签显示传说。检查时页面error/warn为空。未做真实战斗实页，发现流程由Vitest战斗测试覆盖。卡图查看生成返回图和接入后的本地图，未运行卡图测试、资产审计、build或提交。

未启动服务，复用既有5200；本会话编辑已释放，全部改动完成未提交。
