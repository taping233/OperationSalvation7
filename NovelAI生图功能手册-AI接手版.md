# NovelAI 生图功能手册 · AI 接手版

> 打包日期 2026-09-13。本手册自包含：新会话的 AI 读完即可接手本项目的全部生图工作
> （卡面 / 角色立绘 / 场景图 / 战斗序列帧），不需要再追问历史。
> 项目背景：《拯救计划·柒》（搜打撤）卡牌 Roguelike，Vite+JS 主线，资产落地在
> `搜打撤/game/assets/`。本文所有路径以仓库根 `D:\素材\代号柒\` 为基准。

---

## 0. 环境与前置条件

| 项 | 内容 |
|---|---|
| Python | 3.8+/3.11 均可，依赖 `requests` `pillow` `numpy` |
| 代理 | Clash/Mihomo `127.0.0.1:7890`，**保持 rule 模式，不要切节点（尤其不要切香港）** |
| NAI token | 找项目所有者索取（`pst-` 开头），存为 `.tmp/nai/token.txt` 一行纯文本；脚本读第一个非 `#` 行。**pst- token 只能出图，API 查不了余额；此文件勿提交 git** |
| 生图脚本目录 | `.tmp/nai/`（几十个批次脚本，见 §8 索引） |
| 序列帧烘焙目录 | `.tmp/frames-bake/` |

⚠️ `.tmp` 是临时目录、历史上被整目录清理过。核心配方都写进了各脚本本体，丢了可按本手册 §8 重建。

---

## 1. NAI V5 API 链路（已跑通，照抄即可）

- 端点：`https://image.novelai.net/ai/generate-image`，模型 **`nai-diffusion-5-full`**
- 认证：`Authorization: Bearer <token>`
- 返回：**zip 字节流**，第一个条目就是 PNG（`zipfile.ZipFile(io.BytesIO(r.content))` 再 `z.read(z.namelist()[0])`）
- curl 直调要加 `--ssl-no-revoke`；官方 Swagger 全 404，别浪费时间试
- NAI 全系无 LoRA；Opus「无限额度」只对 V5 受限

### 1.1 参数口径（拉满配置）

```
steps 28 · scale 6.5 · variety_plus true
sampler k_euler_ancestral · noise_schedule karras · cfg_rescale 0.0
```

### 1.2 尺寸与额度

| 档位 | 尺寸 | 额度 |
|---|---|---|
| 免费小图 | steps≤28 且 长×宽 < 1,080,000 px（竖 832×1216 / 横 1216×832） | 免费 |
| 大图 | 1536×1024 等 | 烧 Anlas |
| API 硬上限 | 1536×2048（4096×2304 直接 400） | — |
| 16:9 合法最大 | 2048×1152 | — |

**老板口径：迭代全走免费小图，定稿才烧大图。** 4096 立绘 = 出小图后本地放大，不直出。

### 1.3 payload 骨架（V5 实际可用结构，摘自 warrior_batch_0913.py）

```python
payload = {
  'input': prompt, 'model': 'nai-diffusion-5-full', 'action': 'generate',
  'parameters': {
    'width': W, 'height': H, 'steps': 28, 'scale': 6.5, 'seed': seed,
    'sampler': 'k_euler_ancestral', 'noise_schedule': 'karras',
    'cfg_rescale': 0.0, 'ucPreset': 0, 'qualityToggle': False,
    'variety_plus': True, 'negative_prompt': UC, 'characterPrompts': [],
    'v4_prompt': {'caption': {'base_caption': prompt, 'char_captions': []},
                  'use_coords': False, 'use_order': True},
    'v4_negative_prompt': {'caption': {'base_caption': UC, 'char_captions': []},
                           'use_coords': False, 'use_order': True},
    'deliberate_euler_ancestral_bug': False, 'prefer_brownian': True,
  },
}
```

### 1.4 错误码即铁律（脚本用退出码表达）

| 情况 | 动作 |
|---|---|
| HTTP 429 | 停 15 分钟再试 → 再 429 再停 15 分钟 → 第三次**立即停手上报** |
| HTTP 403 | **立即停手**（风控禁无限小图，所有人都用不了），不重试 |
| 其他非 200/201 | 打印响应前 300 字符，停 |

---

## 2. 全局铁律（节奏与流程）

1. **一轮一张，两张间隔 ≥45 秒**（脚本 `MIN_INTERVAL_S = 45` 强制 sleep，别去掉）。单张 3-5 秒返回是服务端 GPU 速度，正常；风控看的是请求频率。
2. **老板流程：先出中文版提示词给他确认，再喂英文出图**（他要看懂才放行）。老板说「一字不改」就原样用串，不动一个词。
3. **出图产物直接给老板看，不先自检**（2026-09-12 老板令）。
4. 迭代每轮只改 2-3 处；**锁种子 = 复现构图**（脚本第 3 参数），老板点名要哪张就锁那张的种子改。
5. 抽卡工作流：写提示词 → 中文版确认 → 免费小图（随机种子，一次 1-3 张看稳定性）→ 老板点名某张 → 锁种子每轮改 2-3 处逼近 → 满意后同种子扩 1536×1024 定稿（烧 Anlas，老板明说或按「定稿」口径执行）。
6. 每轮交付口径：图片路径 + 命中项 + 已知偏差 + 下轮可调的旋钮。
7. 每个批次脚本跑完都会写 `manifest.json`（file/card/seed/prompt/uc/png），**种子和提示词以此为准**，丢了可复现。

---

## 3. 风格配方（三条已定稿的路线）

### 3.1 画师串（立绘口径）

```
1.2::miv4t::, 0.8::quasarcake::,
```
miv4t 主导笔触（细发丝勾勒+颗粒），quasarcake 辅助极简平涂。立绘风格层放提示词**最后**：

```
limited palette, <X> theme, flat color, gradient background, film grain
```
- theme 跟人设换色（蓝→blue / 绿→green），背景句颜色同步换
- 颗粒要更重：`1.3::film grain::, grainy`
- 长发角色笔触句（风格灵魂）：
  `Her extremely long white hair is drawn with fine individual strands, and several thin locks dissolve into flowing line work against the background.`
- **注意：limited palette / film grain 仅立绘口径。物件卡面已弃用它们（暗调病根）。**

### 3.2 卡面口径（09-13 现行，赛璐璐明亮动漫系）

画师串照挂，质量尾换成赛璐璐串（摘自 warrior_batch_0913.py）：

```
TAIL = 'cel shading, flat color, anime coloring, rich color, best quality, amazing quality, absurdres'
```

卡面 UC（在 §3.4 基础串上的卡面增补）：

```
opaque background, painterly, thick paint, blurry, midriff, 1girl   ← 按角色性别调
```

**画风基准 = 奥术弹 tt7-arcanebolt（明亮动漫系）。** 暗调 painterly 跑偏版本已被整批否决，别再走暗色调。

### 3.3 卡通版（Q 版表情演出，不挂画师串）

`chibi, flat color, thick outline, white background` 系。与正式版两套质量尾**不要混用**。

### 3.4 UC 基础排除串

```
lowres, worst quality, low quality, jpeg artifacts, blurry, bad anatomy, bad hands,
extra digits, fewer digits, extra fingers, missing fingers, malformed hands, fused fingers,
extra limbs, extra arms, extra legs, deformed, mutated, disfigured, bad proportions, long neck,
distorted face, ugly, text, watermark, signature, logo
```

### 3.5 字段分工规矩

- 画师串放主提示词**最前**，风格层放**最后**
- 角色栏（characterPrompts）只放外貌，`girl`/`1boy` 打头；外貌词只在角色栏出现一次，主提示词不重复
- 人数 tag 只在最前出现一次
- 构图只说方向（竖/横），像素只在出图时指定

---

## 4. 卡面管线（1.32 横版，主力管线）

### 4.1 出图→落地标准链

```
NAI 出图 1216×832（免费档）
  → 按 384:291（尖塔2官方卡框比例，≈1.32）左右居中裁切
  → resize 896×679
  → WEBP q90 落地 搜打撤/game/assets/cards/<族>-<id>.webp
```

裁切代码（一行流，已在批次脚本验证）：

```python
tw = round(im.height * 384 / 291)
left = (im.width - tw) // 2
im.crop((left, 0, left + tw, im.height)).resize((896, 679), Image.Resampling.LANCZOS)\
  .save(cards_dir / filename, 'WEBP', quality=90)
```

### 4.2 文件命名 = 按 id 绑定（铁律，翻过车）

- 命名格式：`martial-<id>.webp`（武术）/ `equip-<id>.webp`（装备）/ `spell-<id>.webp`（法术）/ `cc-*.webp`（诅咒等）等
- **配图前必核对现役 id**：卡库里有多池并存+已退役 id，拿旧 id 配图会落空（盗宝 `cc-treasure`→`cmtn1i64j7y7` 翻过车；千变万化=`cmtn1p9vb5au`）
- 卡面渲染优先级：`cardArtOverrides` > `resourceArt`，换图前先在页面 evaluate 确认 src 实际指向
- 能力卡各用各的图需补 `heroCardArt` 映射（在 `game/src/art.js`）

### 4.3 art.js 与守卫测试

- `game/src/art.js` 是**唯一**图片路径构造点
- 守卫测试 `搜打撤/tests/card-art-coverage.test.js` 双层红灯：孤儿检测 + LANDMARK_ART 定稿清单，**新批次必须登记**，否则测试红
- sfx/game-icons 报孤儿是假阳性；`asset-manifest.json` 会毒化审计，别信它

### 4.4 卡面构图规矩

- **角色卡面脸必须可见，禁止背面构图**（09-13 被否）
- 成批出图：**视角零重复、多创意**（参考 warrior_batch_0913.py 的 11 连视角表：正面抱臂/侧面疾奔/仰视拄盾/侧3-4开襟/俯视旋斩/坐姿磨刀/微距破甲/虫视腾跃/微俯盾阵/越肩双镖/侧面偃月波）
- 每张配一句「一句话读卡」英文收尾（如 `The immovable mountain - everything breaks, he does not, read at a glance.`）

### 4.5 人设锚点（逐字串制）

角色卡面的人设描述用**定稿立绘的逐字串**（已验收过脸的串直接复用），存放在对应批次脚本里，如黑像：

```
dark-skinned male, black hair, short hair, amber eyes, scar on cheek, stitched scar,
muscular, huge muscles, massive build, broad shoulders, thick arms, tall,
black fitted long-sleeved shirt, shoulder armor, black gloves, black pants, black boots,
orange scarf, smirk
```

五角色人设权威出处 = `搜打撤/docs/character-bible/`（玄砾→黑像、灯葵→星月；常无欲=男/红瞳；「无」=固定裸腿）。人设细节变更以 character-bible 为准，别引用旧 Danbooru 文字设定。

---

## 5. 角色立绘管线

- 画师串 + limited palette 那套（§3.1），画风定调 = **赛璐璐色块**
- 定稿参考：黑像=白底巨汉捏小咖啡杯反差感；星月=淡金编发白裙青披肩星灯
- 尺寸：迭代走免费小图（竖 832×1216）；定稿大图横版上限 2048×1152；4096 立绘=小图放大
- 画师串权重只在 V5 有效（感知区间 1.0-2.0，1.3-1.8 最值得调）；搬到 4.5 等模型会裸奔
- 立绘出完直接给老板，不自检（§2 铁律 3）

---

## 6. 战斗序列帧管线（GPT 出帧 → 烘焙落地）

这条线**不走 NAI**：老板在 GPT 网页版按「出帧包」批量出透明底整图，AI 负责切片+烘焙+接入。

### 6.1 上游：GPT 出帧包

完整出帧提示词在 `.tmp/nai/战斗帧序列-出帧包v4.md`。要点：

- 口径 = **每动作 6 帧**（v3 单帧动画感不足被否），角色 6 动作（idle/atk-wind/atk-hit/hurt/cast）×6 帧
- 用法：每动作开一个 GPT 对话，先上传该角色 NAI 基准帧（idle-1），贴锁定句 + 该动作 6 句，**一帧一图**
- 锁定句核心：同角色同脸同装、侧面朝右全身、**背景全透明（PNG alpha）**、发丝贴身
- 常见坑（发现即重出，别手改）：背景不透明/带地面阴影、脚被裁、比例不一致、换发型、顺序跳帧、四格拼图
- 三角色：shuangling（无·侠客·蓝·哥特剑少女）/ baiqi（常无欲·降临者·紫·**男生**，句中 She→He、sword→staff）/ lituan（白塔·法师·绿·绿裙）

### 6.2 下游：切片 + 烘焙（AI 的活）

老板交付的是 **12 格精灵图**（2 行×6 列整图），处理链在 `.tmp/frames-bake/`：

1. **切片**（谷底切割+最大连通域+内容裁边）→ `sheets/<角色>/cell-01..12.png`
2. **烘焙** `bake-sheets.py`：
   - 去低 alpha 雾（α<24 清零，RGB 一并归零利压缩）
   - 清贴边纵向贯穿细列（源精灵图网格线伪影：贴左右边 ≤3px 且贯穿 ≥55% 高度的列）
   - 每角色统一缩放（最高格 fit 750px、最宽格 fit 506px），**角色内部体尺恒定**
   - 贴 512×760 画布、脚底贴底水平居中
   - 输出 `搜打撤/game/assets/portraits/frames/<角色>/<动作>-<n>.webp`（q88）+ 棋盘格对照表 `contact-<角色>.png`
3. **12 格→动作映射**每角色不同，表在 `bake-sheets.py` 的 `MAP` 字典里，**顺序即语义，别重排**
4. 接入序列帧播放器（游戏侧批次 D/E，已实装）

---

## 7. 语义坑清单（每条都烧过图验证）

| 坑 | 解法 |
|---|---|
| `oval` tag | 画成椭圆画框截腿，禁用 |
| 宽幅图 full body 截脚 | 句子写死 `open ground below her feet` |
| V5 立绘句下 `sitting` 不坐实 | （4.5 反而稳）加 `sitting, table, round table` 等离散 tag 辅助 |
| 角色名/作品名 | 只认 ASCII（danbooru 英文写法），中文名无效 |
| 裸腿 | 角色栏 `bare legs` + UC 排除 `pantyhose, tights, thighhighs, stockings`（limited palette 会把腿染成丝袜色，这套组合压得住） |
| 签名头饰等裸标签 | 会画成悬浮光环，要用整句把位置钉死 |
| 角色卡面背面构图 | 被否，脸必须可见 |
| 参考图构图 | = 构图 tag + 占画幅句子落地（句子写空间关系，tag 钉离散事实） |
| 正对画面 | `straight on, facing viewer` 叠加 `looking at viewer` |

---

## 8. danbooru 查证法 + 脚本资产索引

### 8.1 danbooru tag 查证

- 本地代理直连会被 Cloudflare 403（requests/curl 都拦），**用 WebFetch 直达**：
  `https://danbooru.donmai.us/tags.json?search[name_matches]=X&only=name,post_count`
- posts.json 匿名 2-tag 上限，`order:score` 这类 meta 也计入，3 个条件报 422
- 已查证可用：limited palette 26407 · blue theme 39752 · gradient background 188888 · miv4t 277 · quasarcake 378 · facing viewer 103209 · bare legs 179443
- 查无/弃用：two-tone（0 post）、dark blue theme（不存在）、namie（6 张）、rscript（查无）

### 8.2 `.tmp/nai/` 脚本索引（接手先看这三个）

| 脚本 | 用途 |
|---|---|
| **warrior_batch_0913.py** | **卡面批次管线范本**：TASKS 表（prompt+落地文件名）→ NAI → 裁切 → webp 落地 → manifest.json 全流程。新批次抄它改 TASKS |
| roster_heixiang_v3.py | 定稿立绘脚本（黑像人设锚点逐字串出处） |
| style_extract.py / style_garden.py / nai_gen.py | 最早的三个单张模板（payload 同源；style_extract 保留老板水彩实验提示词勿覆盖） |

用法通式：`python 脚本.py 张数 [宽x高] [锁种子]`，如 `python style_garden.py 1 1536x1024 162757161`。

其余几十个脚本（wu_cards_*、spell_card_batch、curse_redraw、enemy_redraw、scene_redraw、token_color_redraw……）都是历次批次的一次性脚本，结构同源，**配方以 manifest.json 为准**。

序列帧侧：`.tmp/frames-bake/bake-sheets.py`（烘焙主脚本）、`bake-frames.py`、`sheets/`（切片产物）、`contact-*.png`（对照表）。

### 8.3 已验收的复现种子

| 内容 | 命令 |
|---|---|
| 黑白蓝剑女定稿（横 1536×1024） | `python style_extract.py 1 1536x1024 1794101880` |
| 绿系园艺少女定稿（横 1536×1024） | `python style_garden.py 1 1536x1024 162757161` |
| 序列帧基准帧 | 种子见文件名：shuangling=712683577 · baiqi=774635701 · lituan=267473626 |

---

## 9. 接手检查单（第一次干活前过一遍）

1. `token.txt` 在不在？不在 → 找项目所有者要，**别猜、别试旧 token**
2. 代理是 Clash rule 模式、端口 7890？→ 试跑一张免费小图验证链路
3. 卡面任务 → 先查现役 id（游戏内或 `game/data/cards-sync.json`），再抄 warrior_batch_0913.py 开批
4. 新批次落地后 → 登记 `tests/card-art-coverage.test.js` 的定稿清单，跑 `npm test` 守卫
5. 改了 `game/` 下源码 → 记得 `搜打撤/` 目录 `npm run build`（桌面版玩的是构建产物）
6. 429/403 按 §1.4 处置，**不要加压重试**
