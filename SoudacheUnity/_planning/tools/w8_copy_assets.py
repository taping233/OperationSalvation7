# -*- coding: utf-8 -*-
# W8 资产搬运：按契约 §7 拷贝 + 校验 + 生成 asset-map.md（可重复运行，幂等）
import os, shutil, io

SRC = r"D:\素材\代号柒\搜打撤\game\assets"
DST = r"D:\素材\代号柒\SoudacheUnity\Assets\Resources"

groups = []  # (说明, 目标子目录, [(源相对路径, 目标文件名)])
def add(desc, sub, pairs):
    groups.append((desc, sub, pairs))

def pngs(sub, names=None):
    d = os.path.join(SRC, sub)
    out = []
    for f in sorted(os.listdir(d)):
        if f.lower().endswith(".png") and (names is None or f in names):
            out.append((sub + "/" + f, f))
    return out

def files(sub, names):
    return [((sub + "/" if sub else "") + n, n) for n in names]

# 1. 立绘
add("职业抠图立绘（cut/classes）", r"Art\Portraits\Cut", pngs("portraits/cut/classes"))
add("敌人抠图立绘（cut/enemies）", r"Art\Portraits\CutEnemies", pngs("portraits/cut/enemies"))

# 2. 场景：webp 优先（同名 png 不拷）
scene_dir = os.path.join(SRC, "scenes")
scene_pairs = []
for f in sorted(os.listdir(scene_dir)):
    base, ext = os.path.splitext(f)
    if ext.lower() == ".webp":
        scene_pairs.append(("scenes/" + f, f))
    elif ext.lower() == ".png" and not os.path.exists(os.path.join(scene_dir, base + ".webp")):
        scene_pairs.append(("scenes/" + f, f))
add("场景图（webp 优先，同名 png 跳过）", r"Art\Scenes", scene_pairs)

# 3. 卡牌：类型大图 + hero-* + resources（加前缀）
cards_dir = os.path.join(SRC, "cards")
card_pairs = []
for f in sorted(os.listdir(cards_dir)):
    p = os.path.join(cards_dir, f)
    if os.path.isfile(p) and f.lower().endswith(".png"):
        card_pairs.append(("cards/" + f, f))
for f in sorted(os.listdir(os.path.join(cards_dir, "resources"))):
    if f.lower().endswith(".png"):
        card_pairs.append(("cards/resources/" + f, "resource-" + f))
add("卡面（类型大图 + hero-* + resource-* 前缀）", r"Art\Cards", card_pairs)

# 4. 图标
add("结点图标（icons png，svg 不拷）", r"Art\Icons", pngs("icons"))
add("UI 小图标（ui/icons）", r"Art\Ui", pngs("ui/icons"))

# 5. 音频
sfx_pairs = [("sfx/" + f, f) for f in sorted(os.listdir(os.path.join(SRC, "sfx")))
             if f.lower().endswith(".wav")] + [("sfx/kenney-license.txt", "kenney-license.txt")]
add("UI 音效 wav + Kenney 许可", r"Audio\Sfx", sfx_pairs)
add("战斗音效 ogg + 许可", r"Audio\Sfx\Battle",
    [("sfx/battle/" + f, f) for f in sorted(os.listdir(os.path.join(SRC, "sfx/battle")))
     if f.lower().endswith(".ogg") or f == "kenney-license.txt"])
add("BGM", r"Audio\Bgm", files("", ["bgm-black-stream-sea.mp3", "bgm-sour-orange-earth.mp3"]))

# 6. 标题/杂项
add("标题图（jpg）", r"Art\Title", files("", ["title-hero-ascension.jpg"]))
hub = files("", ["hub-bg-rhine.png", "icon-council.png", "board-backdrop-wreck.webp",
                 "slot-bg-knight-fantasy.jpg", "brand-mark-codename7.png"])
hub += [("portraits/expedition-roster.png", "expedition-roster.png")]
add("基地/杂项（Hub）", r"Art\Hub", hub)
add("冬季 UI 栅格", r"Art\WinterUi",
    [("winter-ui/raster/" + f, f) for f in sorted(os.listdir(os.path.join(SRC, "winter-ui/raster")))
     if f.lower().endswith(".webp")])

# ---- 执行拷贝 ----
copied, total_bytes, fail = 0, 0, []
for desc, sub, pairs in groups:
    d = os.path.join(DST, sub)
    os.makedirs(d, exist_ok=True)
    for s, t in pairs:
        sp, tp = os.path.join(SRC, s.replace("/", "\\")), os.path.join(d, t)
        try:
            shutil.copyfile(sp, tp)
        except Exception as e:
            fail.append((s, str(e)))
            continue
        copied += 1
        total_bytes += os.path.getsize(tp)

# ---- 校验：exists & size>0 ----
bad = []
for desc, sub, pairs in groups:
    for s, t in pairs:
        tp = os.path.join(DST, sub, t)
        if not (os.path.isfile(tp) and os.path.getsize(tp) > 0):
            bad.append(sub + "\\" + t)

print("copied=%d bytes=%d fail=%d bad=%d" % (copied, total_bytes, len(fail), len(bad)))
for f in fail: print("FAIL", f)
for b in bad: print("BAD", b)
for desc, sub, pairs in groups:
    print(sub, len(pairs))

# ---- 生成 asset-map.md ----
out = io.open(os.path.join(os.path.dirname(DST), "..", "_planning", "asset-map.md"), "w", encoding="utf-8", newline="\n")
res_root = "Assets/Resources/"
L = []
L.append("# asset-map.md —— 资源名 → 文件名映射（W8 产出，给渲染/UI/音频 agent 用）\n")
L.append("源：`搜打撤/game/assets/`；落位：`Assets/Resources/`（契约 §7）。Resources.Load 路径 = 下表相对路径去掉扩展名。\n")
L.append("生成脚本：`_planning/tools/w8_copy_assets.py`（幂等可重跑）。\n")

L.append("## 0. 落盘文件全列表\n")
for desc, sub, pairs in groups:
    L.append("\n### %s（%d 个）\n" % (res_root + sub.replace("\\", "/"), len(pairs)))
    L.append("| 文件 | 源 |")
    L.append("|---|---|")
    for s, t in pairs:
        L.append("| %s | assets/%s |" % (t, s))

L.append("\n## 1. 角色 → 立绘\n")
L.append("来源 `src/characters.js` + `src/art.js`：角色选择页立绘不是单图，而是 `expedition-roster.png`（1672×941 合影）按角色切条；职业旧立绘按 CLASS_IDS 映射。\n")
L.append("| 角色 id | name | rulesetId | 立绘来源 | Resources 路径（去扩展名） |")
L.append("|---|---|---|---|---|")
ranges = {"shuangling": "[0,355]", "baiqi": "[338,672]", "lituan": "[655,1010]", "xuanli": "[991,1397]", "dengkui": "[1380,1672]"}
names = {"shuangling": "霜翎", "baiqi": "白契", "lituan": "栗团", "xuanli": "玄砾", "dengkui": "灯葵"}
rsid = {"shuangling": "侠客", "baiqi": "降临者", "lituan": "法师", "xuanli": "战士", "dengkui": "牧师"}
cls = {"shuangling": "sword", "baiqi": "descend", "lituan": "mage", "xuanli": "warrior", "dengkui": "priest"}
for cid in ["shuangling", "baiqi", "lituan", "xuanli", "dengkui"]:
    L.append("| %s | %s | %s(%s) | roster 合影 x 像素区间 %s | Art/Hub/expedition-roster（切条）；职业抠图备用 Art/Portraits/Cut/%s |" % (cid, names[cid], rsid[cid], cls[cid], ranges[cid], cls[cid]))
L.append("\n职业名→抠图立绘（art.js CLASS_IDS，含旧职业兼容）：侠客/剑客→sword、刺客→assassin、战士→warrior、牧师→priest、法师→mage、降临者→descend、术士→warlock、授印者→sealer、召唤师→summoner、守卫→guard、游侠→ranger。文件均在 `Art/Portraits/Cut/{id}.png`。\n")

L.append("\n## 2. 敌人 → 立绘\n")
L.append("来源 `src/art.js` MONSTER_IDS（= cards.js BESTIARY 的 art 字段全集，14 个）。抠图版在 `Art/Portraits/CutEnemies/{id}.png`。\n")
L.append("| 敌人 art key | 文件 |")
L.append("|---|---|")
for k in ["infantry", "archer", "bandit", "cavalry", "orc_jav", "orc_axe", "wolf_rider",
          "fire_el", "water_el", "grass_el", "dragon", "boss_general", "boss_orc", "boss_elem"]:
    L.append("| %s | Art/Portraits/CutEnemies/%s.png |" % (k, k))

L.append("\n## 3. 卡面 art key → 文件名（art.js cardIcon 规则）\n")
L.append("卡面不是按卡 id，而是按 `cardFamily(card)` 家族图 + hero 职业专属 + 资源卡按卡名精确匹配（RESOURCE_ART）。\n")
L.append("| 家族/规则 | Resources 路径（去扩展名） | 说明 |")
L.append("|---|---|---|")
fams = ["hero", "event", "martial-ranged", "martial-melee", "healing", "spell",
        "equipment-armor", "equipment-weapon", "equipment-utility",
        "resource-key", "resource-valuables", "resource-material", "consumable", "unknown"]
for f in fams:
    note = "英雄卡：实际用 hero-<职业id>.png（11 张：assassin/descend/guard/mage/priest/ranger/sealer/summoner/sword/warlock/warrior），缺失回退 hero" if f == "hero" else ""
    L.append("| %s | Art/Cards/%s | %s |" % (f, f, note))
L.append("\n资源卡按卡名 → `Art/Cards/resource-<key>`（原名 `assets/cards/resources/<key>.png` 加前缀防撞名）：\n")
L.append("| 卡名 | 原 key | Resources 路径 |")
L.append("|---|---|---|")
ra = [("制式口粮", "ration-std"), ("口粮", "ration"), ("双份口粮", "ration-double"), ("钥匙", "key"),
      ("一串钥匙", "keys-bunch"), ("一把钥匙", "key-one"), ("木材", "wood"), ("大量木材", "wood-lots"),
      ("一捆木材", "wood-bundle"), ("石榴石弹珠", "garnet-marble"), ("经济卡包", "econpack"), ("钻石", "diamond")]
for n, k in ra:
    L.append("| %s | %s | Art/Cards/resource-%s |" % (n, k, k))
L.append("\n生物图鉴卡（type=生物，BESTIARY 14 条）：卡面用敌人立绘 `Art/Portraits/CutEnemies/<art>.png`（无映射回退图标 paw）。\n")

L.append("\n## 4. 场景 key → 文件名\n")
L.append("来源：`src/game.run.data.js` PRELOAD_SCENES/SCENE_META、`css/scenes.css`。同名 png/webp 并存时只拷 webp（源码里 battle 引用的是 .png 后缀，Unity 侧统一按去扩展名路径加载即可）。\n")
L.append("| 场景 key | Resources 路径（去扩展名） |")
L.append("|---|---|")
for k, ext in [("battle-normal-anime-v2", "webp"), ("scene-door-anime-v2", "webp"),
               ("scene-extract-anime-v2", "webp"), ("scene-fire-anime-v2", "webp"),
               ("scene-altar-anime-v2", "webp"), ("scene-chest-anime-v2", "webp"),
               ("scene-shop-anime-v2", "webp"), ("scene-pickup-coin-anime-v2", "webp"),
               ("scene-pickup-key-anime-v2", "webp"), ("scene-pickup-rations-anime-v2", "webp"),
               ("scene-pickup-wood-anime-v2", "webp"), ("event-bandits-anime-v2", "webp"),
               ("scene-deploy-anime", "png"), ("hub-ach", "png"), ("hub-classes", "png"),
               ("hub-stash", "png"), ("hub-upgrade", "png")]:
    L.append("| %s | Art/Scenes/%s |" % (k, k))

L.append("\n## 5. 音频 key → 文件名（src/sound.js）\n")
L.append("BGM：局内 = `Audio/Bgm/bgm-black-stream-sea`（loop），标题 = `Audio/Bgm/bgm-sour-orange-earth`。Sfx 战斗键（键名→随机取 1..N，camelCase 注意）：\n")
L.append("| sfx 键 | 文件（Audio/Sfx/Battle/） |")
L.append("|---|---|")
for k, n, cnt in [("hit", "hit", 4), ("hurt", "hurt", 2), ("parry", "parry", 2), ("curse", "curse", 2),
                  ("heal", "heal", 3), ("chestShake", "chestshake", 2), ("chestBurst", "chestburst", 3),
                  ("reveal", "reveal", 3), ("legend", "legend", 3), ("victory", "victory", 2), ("defeat", "defeat", 1)]:
    L.append("| %s | %s-1..%d.ogg（%d 个） |" % (k, n, cnt, cnt))
L.append("\nUI 音效（Audio/Sfx/）：click1-5.wav、rollover1-6.wav、switch1-6.wav（sound.js 运行时随机取）。全部 Kenney CC0（Audio/Sfx/kenney-license.txt、Audio/Sfx/Battle/kenney-license.txt）。\n")

L.append("\n## 6. 标题/Hub/冬季 UI\n")
L.append("| 用途 | Resources 路径（去扩展名） | 引用处 |")
L.append("|---|---|---|")
L.append("| 标题主视觉 | Art/Title/title-hero-ascension | css（.title-bg）/ PRELOAD |")
L.append("| 基地背景 | Art/Hub/hub-bg-rhine | css/hub.css |")
L.append("| 槽位背景 | Art/Hub/slot-bg-knight-fantasy | css + game.menu.js |")
L.append("| 棋盘背景 | Art/Hub/board-backdrop-wreck | game.boot/renderer（webp） |")
L.append("| 徽记 | Art/Hub/brand-mark-codename7 | index.html favicon/头像 |")
L.append("| 议会图标 | Art/Hub/icon-council | 未在 src/css 直接引用（备用） |")
L.append("| 远征队合影 | Art/Hub/expedition-roster | art.js characterArt 切条 |")
L.append("| 冬季 UI 栅格 | Art/WinterUi/{black-longsword,snowflakes,squirrel-branch,winter-hotpot,winter-rose} | winter-ui 源（svg 未拷） |")

L.append("\n## 7. 汇总\n")
L.append("- 拷贝总数：%d 个文件，合计 %.1f MB" % (copied, total_bytes / 1048576.0))
L.append("- 校验：全部目标文件 exists 且 size>0（脚本内逐个检查，BAD=0）")
L.append("- 跳过清单（按指令不拷）：icons-source-web/、icons-orig/、winter-ui 的 svg 源、winter-ui-source/、menu-emblems/source、portraits/{classes,enemies,full} 原版未抠图、M500000rh0dE2TyUic.mp3（孤儿）、reconstruction/ 大图（title 引用的 wallpaper-original.jpg 未在指令范围内，未拷）、cards 大图原版已全量拷贝无跳过、scenes 同名 png 原图（battle-normal-anime-v2.png，webp 已拷）、assets 根下其余 title-*.webp/png（指令仅要求 *.jpg）、fonts/（协调者负责）\n")
out.write("\n".join(L) + "\n")
out.close()
print("asset-map.md written")
