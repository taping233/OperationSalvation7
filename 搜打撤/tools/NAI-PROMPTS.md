# 生图提示词入口

## 出图导航（先看这里）

- 画风配方唯一权威：`nai_style.py`（画师串/风格块/负面基线 + 全部 build_* 构建器），禁止散抄画风文本。
- 新批次构建入口：`nai_prompt_clean.py`（转发 nai_style + 负面词去重 + 透明战斗立绘构建器）。
- 当前流程与可复用请求记录示例：[NAI 提示词组合](../docs/production/art/NAI-PROMPTING.md)。新批次按用途构图、角色分槽、固定参数对照并保存完整请求；当前配方v3.4，质量尾、按需质量词、负面和画法以nai_style及组合手册为准，默认四画师链保留；人物关系与适度重复沿组合原则；默认免费横版1344×768、CFG5.5、28步（大图须老板明确指定）、Variety+关闭，完整参数见客户端与认可请求。
- 生图客户端与护栏：`nai_gen.py`（模型/参数/双通道/大图限额）+ `nai_guard.py`（节奏/配额/冷却）；离线测试 `tools/tests/`。
- 视觉规范与认可锚点：`docs/production/art/VISUAL-BIBLE.md`（portraits/full 五图为唯一认可图）。
- 角色身份与 tag 口径：`docs/character-bible/`（每页只认「现行权威」段，历史段不拼入新配方）。
- 历史查证：`.tmp/nai/`（不入库）与 `docs/archive/`；旧输出复现以当次 payload/manifest 为准，不用旧文案反改现行配方。

网络与传输：老板已授权代号柒项目级公网访问。根 `.codex/config.toml` 现以 `default_permissions = "project-network"` 选择继承 `:workspace`、`network.enabled = true` 的命名权限配置，保留工作区文件保护。旧 `sandbox_workspace_write` 网络表已迁移，不混用两套配置；新建沙箱指定该配置的无凭据 NAI 探针 HTTP 200，配置备份与验证见[网络修复及泳装交付](../docs/evidence/2026-10-15-wu-swim-nai/README.md)。

执行前以平台本轮实际网络权限为准。若当前聊天明确为 restricted / disabled，直接把具体生成命令交给平台网络审批执行，不先发已知无法联网的生成请求；审批不可用或拒绝则保留请求并记录阻塞，不换端口、清护栏或绕过审批。已有聊天可能仍保留旧权限，磁盘配置验证不能当作当前聊天权限已变更；宿主采用新配置后的真实请求才证明当前聊天恢复。`CODEX_SANDBOX_NETWORK_DISABLED` 可能被子进程继承，单个环境变量不足以证明新建沙箱的有效网络状态。

`nai_gen.py` 仍默认用 Python requests 直连，000 时读取运行时 `HTTPS_PROXY` / `ALL_PROXY`；旧环境确需 Windows curl 时显式设 `NAI_TRANSPORT=curl`。`HTTP 000` 先看具体异常：代理连接 WinError 10013 表示套接字权限被拒；仅在获准执行中仍连不到代理时再核对系统代理与监听端口。历史传输修复见[对照与网络诊断](../docs/evidence/2026-10-13-wu-nai45-prompt-compare/README.md)。所有生图继续走 `nai_gen` / `nai_guard`，不要手写请求绕过节流。

2026-10-03 整理：画风原文仍来自 `nai_style.py`；新批次从 `nai_prompt_clean.py` 导入构建函数，后者只做兼容转发、负面词去重和透明战斗立绘用途分离。配方版本与整理器版本分别记录。

## 新批次

```python
from nai_gen import generate_image
from nai_prompt_clean import build_asset_prompt, build_battle_portrait_prompt, build_uc

prompt = build_battle_portrait_prompt(
    subject_layer,
    composition_layer='Body, face, gaze and weapon point toward screen-right; entire figure stays inside the canvas.',
    light_material_layer=light_material_layer,
)
uc = build_uc(extra_uc)
```

- 主体/身份：认可参考图与人物页现行段。角色栏主要放身份外貌；动作、朝向、构图放主提示词，关键锚点可适度重复，人物/双手/视线/道具关系与参考正向词选用沿[组合原则](../docs/production/art/NAI-PROMPTING.md#人物关系强调与参考正向词)。
- 用途/构图：立绘完整轮廓；卡面按实际裁切；透明底立绘不用涂刷背景 helper。镜头截到膝盖时不再要求脚下地面。
- 光色/材质：补单图具体材质和光色，不在场景层重复通用画风全文。
- 排除：`build_uc` 按词项去重，保留首项、大小写原文及加权组；不自动猜测近义词或消解冲突。多人物构图不使用 `solo`；成年人物不排除 `adult woman`。
- 请求字段中的 `input`/`base_caption`、角色栏的同步副本属于客户端字段同步，不当作词项冗余移除。
- NAI 新请求走 `nai_gen.generate_image`，不复制历史 curl 请求循环；默认模型和护栏以该客户端实时源码为准。
- 本轮老板要求的透明图使用内置 imagegen 与认可无立绘参考；“transparent background”文字本身不证明 NAI 输出含真实 alpha，交付按文件检查。

## 历史脚本与本轮整理

`.tmp/nai/` 的 59 个 Python 文件中，50 个含生图入口。43 个脚本已更新兼容导入或明确的文本冲突；每个被修改脚本的原字节均备份，旧产图、payload 与 manifest 不改。

保留 14 个不走共享正向构建器的历史实验/复现入口：`painterly_card_style_compare_*`、`select_style_reference_test_*`、`v10_select_style_iterations_*`、`wu_portrait_v14_large_*`、`wu_select_portrait_v22_*` 至 `v31_*`。它们的实验画风不改成当前配方，也不作为新批次模板。

无 v28-v31 的年龄排除与 v22-v31 的单排裙边矛盾已修正；常无欲三批移除与敌人数量冲突的 solo 前缀；研发/常无欲三处场景层通用风格句合并到共享配方；潜匿裁切不再要求完整可见身材比例；满月卡共享场景不再强制脚下地面。

逐文件路径、原 SHA256、修改后 SHA256、改动原因、原字节备份位置见 [整理清单](../docs/evidence/2026-10-03-WF-nai-prompt-clean/cleanup-manifest.json)。旧脚本整体已登记为历史用途；需要复现旧输出时以该次完整 payload/manifest 及备份为准。

离线检查：`python -B -m unittest discover -s tools/tests -p test_nai_prompt_clean.py -v`。检查不读 token、不发请求、不生成图片。
