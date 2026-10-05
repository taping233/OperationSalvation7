# WF-nai-v13-restore：nai_style v1.3 恢复 + 无正面立绘批次记录

2026-10-03 深夜，老板令：①修复 nai_style v1.3 缺口（以 1.3 为基准）②理顺画风文档口径 ③出一版无的正面立绘验收画风与提示词 ④弃用的 WF-wu-nai-v3 会话由本会话收尾。基线 HEAD `425d03920e`，共享混树；未刷新远端、未 build、未提交、未改游戏运行素材。

## 一、v1.3 缺口根因与恢复

- 现象：在途 `tools/nai_prompt_clean.py`、`tools/NAI-PROMPTS.md`、`tools/tests/test_nai_prompt_clean.py` 与已修改的 VISUAL-BIBLE 均按 nai_style v1.3 书写，但工作树 `tools/nai_style.py` 停在 v1.2（与 HEAD 一致），`import nai_prompt_clean` 抛 AttributeError，离线测试红。
- 根因：v1.3 曾落盘并被 import（`tools/__pycache__/nai_style.cpython-38.pyc` 3706→4455 字节为证），后源文件被还原/丢失；pyc 成为唯一完整样本。
- 恢复方式：marshal 反编译 pyc——4 个函数（build_prompt / build_character_portrait_prompt / build_asset_prompt / build_uc）字节码+常量递归对比、5 个模块常量、docstring 全部与重建源码一致；签名 keyword-only（build_character_portrait_prompt 第三参 composition_layer、build_asset_prompt 三参 purpose/composition/light_material）均按 pyc co_argcount/co_kwonlyargcount 确认。
- v1.1 存档注释块按修订史「仍保留」继续保留于文件尾。
- v1.3 相对 v1.2 实质差异（pyc 原文）：①RECIPE_VERSION='1.3'；②PORTRAIT_SCENE_TAIL 由「full standing figure」改为「complete character silhouette …; preserve the specified pose」（不再强制站姿，支持白塔坐姿）；③新增 build_asset_prompt 用途/构图/光色分层；④build_character_portrait_prompt 增 composition_layer 参。
- 画风本体未变：ARTIST_BLOCK、STYLE_BLOCK、BASE_UC 与 v1.2 逐字相同。

## 二、验证

- `python -B -m unittest discover -s tools/tests -p test_nai_prompt_clean.py -v`：**6/6 通过**（去重、加权组、专属项、旧函数兼容、透明用途分离）。
- pyc 字节码对比：4 函数全 MATCH；常量与 docstring 全 SAME。
- 端到端冒烟：build_battle_portrait_prompt 透明分离、build_character_portrait_prompt 尾句在且无强制站姿，均通过；全流程未读 token、未发请求。
- `tools/__pycache__` 误跟踪（.gitignore 已有 `__pycache__/` 规则，pyc 属规则前入库）已 `git rm -r --cached` 移出 index，工作区文件保留；该项为 index staged deletion，随下次授权提交生效。

## 三、画风文档口径终检（修复后已自洽）

| 文档 | 口径 | 与 v1.3 关系 |
|---|---|---|
| `docs/production/art/VISUAL-BIBLE.md`（M，WF-xart-z1 art_spec 子线在途件） | 出图配方六层、v1.3、客户端默认 4.5/V5 显式 | 一致，未改 |
| `tools/NAI-PROMPTS.md`（WF-nai-prompt-clean 在途件） | 画风唯一权威=nai_style.py；新批次入口=nai_prompt_clean.py | 一致，未改 |
| 仓库根《NovelAI生图功能手册-AI接手版.md》 | 已头注化为历史记录，现行以 nai_gen/nai_style 为准 | 一致，未改 |
| `docs/character-bible/wu.md` 等 | 现行权威段=认可五图锚点；历史段不拼入配方 | 一致，未改 |

「乱」的根源即源码回退导致的文档-代码脱节；源码恢复后全部自洽，本轮未再改任何文档内容。

## 四、WF-wu-nai-v3 收尾盘点（老板 10-03 令弃用）

- 证据目录 `2026-10-03-WF-nai-prompt-clean/` 内 gen_wu_nai_v3/v4/v5.py 与 wu-battle-nai-v3/v4/v5.request.json 均已备（22:41–22:52）；但原登记的 image-validation-nai-v3.json **不存在**，`.tmp/nai/output/wu-battle-right-transparent-20261003/` **不存在**——NovelAI 出图未落地。
- `.tmp/nai/request-rate.json` 干净（request_pending=false，冷却已过期），无在途进程、无半开状态。
- 半成品脚本与请求体原样保留不删（删除须另获批）；其「3:2 横幅朝右战斗立绘」任务被老板本轮「正面立绘」指令取代。REGISTRY v3 行已改「已停止（无产出，现场保留）」。

## 五、无正面立绘批次记录

- 脚本：`gen_wu_front_portrait.py`（本目录）；身份层逐条对齐 `docs/character-bible/wu.md`「现行权威（2026-10-03）」段。
- 渠道：本地 NAI 客户端 `tools/nai_gen.py` 直连通道一次成功（HTTP 200，channel=0 --noproxy），无重试无 429。
- 实际模型：`nai-diffusion-4-5-full`（客户端默认；V5 未使用）；配方版本：nai_style **v1.3**（build_character_portrait_prompt + build_uc 去重）。
- 参数：832×1216（免费档竖版，长×宽≈101 万 px < 108 万，不占大图限额）、steps 28 / scale 6.5 / cfg_rescale 0 / k_euler_ancestral / karras / variety_plus。
- **seed=1481474331**。
- 参考图（认可锚点）：`game/assets/portraits/full/wu.webp` SHA256 见 `wu-front-portrait.request.json` 的 reference_sha256 字段。
- 完整正负词与请求体快照：`wu-front-portrait.request.json`（同目录）；UC=BASE_UC+专属排除（反光镜片/袜类/蓬松发/high-low 裙/遮眼发/双剑/多人）。
- 产物：`.tmp/nai/output/wu-front-portrait-20261003/wu-front-portrait-20261003.png`，832×1216 RGBA，1,056,340 字节（>1MB 留 .tmp 不进 Git），**SHA256=5ca8da7f1d0c842fcd6134eb1113aee0a521be2360a949372a8a05fbfc161084**；PIL 尺寸+verify 已过。
- 技术核验（非审美验收）：正面全身完整轮廓、蓝眼露虎牙、蓝缎带、头顶墨镜、黑露肩裙+腰带、蓝星裙衬、裸腿黑厚底踝靴、黑长剑斜背（柄左肩露/鞘尖右下）、安静浅背景均命中。**存疑项供老板评判**：①painterly 笔触块面感偏弱，成图偏清透 anime；②马尾垂落右侧身后（wu.md 现行段为左侧）；③额前碎刘海特征不突出、长鬓发偏多；④黑蔷薇落在剑柄处而非马尾根。审美验收权在老板；未接入运行时，不改游戏引用。

## 六、v2 批次（老板 10-03 深夜画崩定位方案，v1.4 草案实测）

老板逐条定位 v1 崩因并给出调整方案（对话原文）：画师串权重对调（quasarcake 主导 1.1 / miv4t 0.7）、风格块前置紧跟画师串、身份层精简去歧义（charcoal-black outer skirt 等长句简化）、姿态层删精细手势、UC 重写（over fluffy hair 保留发丝层次+deformed hands/bad anatomy）、scale 6.5→5.5（CFG 过高扭曲造型）、steps 28→32（定位 32-36 更稳，取区间下限）、seed 换新。

- 脚本：`gen_wu_front_portrait_v2.py`；按老板方案脚本层拼装（画师串→风格块→身份→姿态→构图→尾句），**nai_style.py v1.3 本体未动**，scale/steps 在脚本内覆盖 nai_gen.DEFAULTS（客户端源码默认未改）；老板验收对味后再固化 v1.4 配方+联动测试文档。
- 渠道：直连一次成功（HTTP 200，channel=0），无重试无 429；模型 `nai-diffusion-4-5-full`；832×1216；**seed=1805482835**（新随机）。
- 产物：`.tmp/nai/output/wu-front-portrait-20261003/wu-front-portrait-v2.png`，935,356 字节（留 .tmp 不进 Git），**SHA256=9626d2ee2fa5838423bf28e0b5e1641a4dbd37f65b4e02fe4b1d47ab234bf32e**；完整正负词与参数快照在 `wu-front-portrait-v2.request.json`。
- 技术核验：笔触松散感与边缘破碎感较 v1 明显增强、服装层次清晰（一字肩+荷叶边裙+星衬露出）、叉腰手无畸形、马尾按角色坐标垂左侧符合口径、白底干净。**遗留待老板评判**：①武器形状读感偏"枪"不像长剑，蔷薇长在武器顶端而非马尾根旁；②眼周出现红色眼影（wu.md 未载）；③墨镜偏大偏中。老板教的后手未动用：`hair drawn in grouped brush chunks`、`anime sketch painting, like character concept art`。
