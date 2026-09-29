# find-B-0036 —— 存档与随机数健壮性对照（STS2 v0.107.1 参照）

- 日期：2026-09-29 夜班 | 开采者 B（只读调研）
- 本项目 HEAD 时点工作区实况，未做任何写/改/删（除本单）
- 参照：D:\素材\杀戮尖塔2源码\sts2-decompiled\（MegaCrit.Sts2.Core.Saves.* / MegaCrit.Sts2.Core.Random.*）
- 三个对照方向：存档健壮性、随机数纪律、数值结算精度

---

## 本项目侧发现（按严重度排）

**B-1 | P3 | 战斗效果 deps.random 有 Math.random 裸随机退化口**
- 本项目：`game/src/battle/effects/effect-steps.m2.js:307` 逐字：`const uid = hand[Math.floor((deps.random || Math.random)() * hand.length)];`
- STS2 参照：`MegaCrit.Sts2.Core.Random/Rng.cs:18-23` 逐字：`/// <summary>/// A non-deterministic RNG instance. This will not produce the same results after saving and loading. /// Good for when we need to randomize things that don't impact gameplay. /// </summary> public static Rng Chaotic` —— STS2 把非确定性随机显式隔离成独立 Chaotic 实例，gameplay 随机一律走种子化 Rng，不存在裸随机 fallback。
- 差距：生产路径 `battle.resolution.js:85` 已注入 `random: randomBattle`（绑定 'battle' 流，:513），现网无恙；但该 fallback 使 deps 漏注入时 copyRandom 静默脱离种子流（快照复现分叉）且无任何告警——防御性写法掩盖注入遗漏。
- 建议修法：去掉 `|| Math.random` 退化，deps 缺失时直接 throw（或告警后取流），让漏注入在测试期暴露。

**B-2 | P3 | 迁移链缺级静默跳过，无完整性校验**
- 本项目：`game/src/hub/versioned-slot-reader.js:63-69` 逐字：`let mv = v; while (mv < maxVersion) { const m = migrations[mv]; if (m) data = m(data); mv++; data.version = mv; }` —— `if (m)` 无 else：未来 SAVE_VERSION+1 忘写 MIGRATIONS[新级] 时，旧档静默跳级盖章，数据形状损坏不报错。当前 MIGRATIONS（game.storage.js:25-30，{1:…}）与 SAVE_VERSION=2 恰好自洽，暂无实际触发。
- STS2 参照：`MegaCrit.Sts2.Core.Saves.Migrations/MigrationManager.cs:180` 逐字：`throw new MigrationPathGapException(message2);`（另 :173 DuplicateMigrationException、:649 `throw new MigrationException($"Missing migration path for {typeof(T).Name} from v{num} to latest version")`）——迁移表缺级/重复/断链显式异常。
- 差距：STS2 把迁移表完整性当硬约束（抛异常），本项目静默容错。
- 建议修法：createVersionedSlotReader 初始化时校验 migrations 表 1..maxVersion-1 全级存在（缺失即 throw），把断链从运行期静默提前到装载期显式失败。

**B-3 | P3 | 对局档无「上一个好档」备份，写坏即丢**
- 本项目：`game/src/hub/game.storage.js:146` 逐字：`localStorage.setItem(RUN_KEY(index), nextRaw);` —— 唯一档位键被新值直接覆盖；corrupt 键只在「读档解析失败」时才有原串（versioned-slot-reader.js:36-42），若写入的数据本身有 bug（逻辑损档、序列化出坏结构），下次读档进 corrupt 备份的也是坏串，玩家丢档。
- STS2 参照：`MegaCrit.Sts2.Core.Saves/GodotFileIo.cs:277-280` 逐字：`/// Copies the current save to a .backup file using temp+rename for crash safety. /// The .backup serves as a fallback for the non-atomic rename on Windows and for /// recovery when the primary save is corrupted.`；配合 `SaveManager.cs:589` `string text = runSavePath + ".backup";`、`RunSaveManager.cs:38` `_saveStore.FileExists(CurrentRunSavePath + ".backup")` —— 写前轮换备份，主档坏可回退上一好档。
- 差距：浏览器 localStorage 单键 setItem 有事务性，无「写一半毁档」，但同样无「写坏了能回滚」——本项目少一层逻辑损档保险。
- 建议修法：write 成功后把覆盖前的原串写入 `sdt-run-<i>-prev` 备份键（读档失败且 corrupt 备份也无/同串时回退），成本一个键位。

**B-4 | P4 | 坏档备份单键轮换，多坏档互相覆盖**
- 本项目：`game/src/hub/game.storage.js:7` 逐字：`const CORRUPT_KEY = index => ` + "`sdt-run-${index}-corrupt`" + `；`game.storage.js:150` 逐字：`try { localStorage.removeItem(CORRUPT_KEY(index)); } catch { /* 无关紧要 */ }` —— 每槽仅一份坏档备份，且写入成功即删。
- STS2 参照：`MegaCrit.Sts2.Core.Saves/CorruptFileHandler.cs:27` 逐字：`string text4 = $"{value}.{value2}.{reasonChar}.corrupt";` —— 坏档改名带 Unix 秒时间戳+原因码（JSN/FUT/OLD/MIG/EMP…），多份共存可溯源。
- 差距：本项目按 localStorage 配额做了最小化，可接受；但连续两次不同原因坏档时只留最后一次，归因困难。
- 建议修法：低优先；如要改进，键名拼入 issue 类型（corrupt/tooNew）即可区分主因。

**B-5 | P4 | 深渊诅咒池用比较器排序洗牌（有偏），代码已自认挂账**
- 本项目：`game/src/battle/core/battle.resolution.js:154` 逐字：`const pool = combat.CURSES.filter(k => k !== 'atkDown').sort(() => randomBattle() - 0.5);`（:152 注释自认「分布有偏是已知债，为保持两路径掷骰序列一致不改」）
- STS2 参照：`MegaCrit.Sts2.Core.Random/Rng.cs:75-79` 逐字：`public int NextInt(int maxExclusive = int.MaxValue) { Counter++; return _random.Next(maxExclusive); }` —— STS2 随机选取一律按 NextInt(index) 均匀采样（如 hand 选取），不用比较器排序。
- 差距：Fisher-Yates（本项目 battle.deck.js:3-9 正确实现）与比较器排序在两处战斗路径并存，诅咒分布有偏。
- 建议修法：按代码注释属挂账债，改动会动掷骰序列，建议保持现状并留在台账，等口径统一窗口期换成 Fisher-Yates 同流采样。

---

## 参照模式（STS2 好做法沉淀，本项目暂无对应问题或为等价实现）

- **R-1 三层原子写**：`GodotFileIo.cs:110/137` 写 `path + ".tmp"` 后 rename；`:277-284` 写前把当前档复制为 `.backup`（tmp+rename 保 crash safety，.backup 兜 Windows 非原子 rename 与主档损坏）。云同步侧 `CloudSaveStore.cs:629` 明确 `.backup` 不上传云端。
- **R-2 Seed+Counter 序列化**：`PlayerRngSet.cs:55-65` 逐字：`serializablePlayerRngSet.Seed = Seed; ... serializablePlayerRngSet.Counters[key] = rng2.Counter;` —— RNG 持久化只存种子与各流调用计数，读档后 `FastForwardCounter`（Rng.cs:56-70）空转复现，存档小且可校验。本项目存全量 streams 状态（random.js:35 snapshot），等价但更重。
- **R-3 按用途分流 RNG**：`PlayerRngSet.cs:14-26` Rewards/Shops/Transformations 各自独立 Rng；本项目流名分布（battle×17、loot×29、card×9、enemy×5、shop×3…）已对齐此思想。
- **R-4 非确定性随机显式隔离**：`Rng.cs:18-23` Rng.Chaotic 注释明令只用于不影响 gameplay 的随机，与种子流物理分离。
- **R-5 未知内容降级不崩溃**：`SaveUtil.cs:21-25` 逐字：`public static EventModel EventOrDeprecated(ModelId id) { return ModelDb.GetByIdOrNull<EventModel>(id) ?? ModelDb.Event<DeprecatedEvent>(); }` —— 存档遇到已删除/改名的模型 id 降级为 Deprecated 占位继续读档（CardOrDeprecated/RelicOrDeprecated/PotionOrDeprecated 全套）。本项目侧对应行为（未知卡 id 读档）本次未核实，可作为后续单独立项。
- **R-6 坏档溯源**：`CorruptFileHandler.cs:27` 时间戳+原因码命名；`SaveManager.cs:586-629` 云同步后 stale 档清理（history 已有 start_time 即删 current_run+.backup）。
- **R-7 数值全整数**：`SerializableRun.cs` 全文无 float/double/decimal 字段；伤害/金币/生命全走 int。本项目抽查（battle.engine.js:1139 `foe.hp -= loss`、game.session.bag.js:103 `gainCoins` 内 `Math.max(1, Math.round(n * (modeCfg().coinMul || 1)))`、龙巢心数折算 probe.dealt→0/1/2）均整数语义，未见浮点累加误差风险——此项两侧行为一致，无发现。
- **R-8 迁移表构建期硬校验**：`MigrationManager.cs:173/180/649` Duplicate/Gap/Missing 三类显式异常（见 B-2）。

---

发现 5 条 + 参照模式 8 条
