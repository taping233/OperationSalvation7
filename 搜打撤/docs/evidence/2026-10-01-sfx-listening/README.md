# 音效一键试听（WF-sfx-listening）工作记录

> 本目录为 2026-10-01 打包提交时代写：原会话按当时指示未另留证，此处以 REGISTRY 已释放行存档事实为准补一份归属记录，便于追溯。

- 会话：Friday（音效一键试听），09-30 深夜～10-01 00:02，完成后因 Codex 侧网络中断暂停，10-01 归档。
- 工作内容：认可 40 个既有音效保留；新增 67 采样（含 7 个环境循环）；旧触发换新，节点/交易/成长接线；元素/武器卡命中声分化。
- 涉及：audio/sound.js、sound.policy、sound bank 与 alternatives/arknights-runtime/；run/scenes、altar、flow、shop、session.death；battle/lifecycle、vfx、attack-cues、resolution（纯音效透传）；hub/base、meta、game.bag、game.hub.depart 音效接线；UI overlay/game.menu；tests/sound-bank.test.js。
- 当时验证：107 音频 HTTP、95 项定向测试与改动文件 lint 通过；内置浏览器 7 号页 05 新档启程/战斗/出牌核对后恢复保留，无新增音频报错。
- 边界：不 build/提交；试听服务 5391 与试玩页保留给老板（归档未动，处置待老板指示）；`.sfx-work/` 为自有中间文件，不随打包入库。
- 代码落库：随 2026-10-01 打包提交入库（哈希见 git log 音效相关文件）。
