# NAI 提示词组合

当前 NAI 配方为 **v3.4**。画师、画法、通用负面与质量尾由 [nai_style.py](../../../tools/nai_style.py) 维护；模型和采样配置由 [nai_gen.py](../../../tools/nai_gen.py) 维护。默认画师链保留 `0.9::quasarcake::, 0.5::rella::, 0.4::gomzi::, 0.3::piromizu::`，单批画师沿老板当次指定。通用质量尾为 `masterpiece, best quality, very aesthetic, masterpiece, no text, rating:general`，保留两次masterpiece。通用画法已移除大块不透明色面、笔刷纹理、哑光黑布及避免光滑渐变的固定要求，立绘背景也不再强制涂刷笔触。负面基线保留 `upscaled` 等已有项，通用层移除 `blurry`、`overexposure`、`excessive bloom`，避免限制景深虚化和强光效果；仅在单图确有对应缺陷且不冲突时定向添加。人物身份、动作、构图和光色按单图填写。

默认模型 **NAI V5 Full**，尺寸 **1344×768（16:9，免费横版档）**，28步、CFG5.5、`k_euler_ancestral`、`karras`、Rescale0、Variety+关闭；种子默认随机，复现认可图使用3058649506。自动质量与UC预设关闭。默认尺寸处于客户端免费像素档，沿用28步；只有老板明确指定大图或其他尺寸才覆盖，付费尺寸继续遵守节流与大图限额。

[认可请求与迁移记录](../../evidence/2026-10-16-nai-default-wide/README.md)保留完整正负提示词、人物槽和参数。共享配方只提取可复用画法与通用负面，吃饭场景、人设和单图排除不固化到其他主体。此默认属于NAI，内置生图重绘的[游戏默认画风v1.0](ART-STYLE-V1.md)独立维护。旧v2.1及更早配方只用于历史复现，不回写旧请求。

v3.2试图保留为[历史记录](../../evidence/2026-10-16-nai-v32-dinner/README.md)，v3.0恢复记录见[记录](../../evidence/2026-10-16-nai-restore-v30/README.md)。动作、空间关系与适度强调仍沿下文写作原则。

## 组合方式

1. 基础提示词：`build_prompt(人数/用途/主要动作, 环境/构图/光色)`；人脸、发色、服装不在双人基础词中重复堆叠。
2. 每个角色：`char_prompts=[{'prompt': 身份外貌, 'uc': 该角色专属排除, 'center': {'x': 0.3, 'y': 0.5}}, ...]`。角色按画面从左到右排列；需要固定位置时传 `use_coords=True`。V4/4.5 官方定位为 5×5 网格，坐标是构图引导，不能当像素定位保证。
3. `build_uc(本图专属排除)`：保留手指异常基线，按实际错误补少量词。双人图不加 `solo`，黑色衣服不在共用负面里排除，窗外雪景不全局排除 `snow`。亮度分别描述室内和室外，不只写笼统的 `dark`。
4. 关键标签靠前；按“人数 → 景别/视角/动作/表情 → 环境/光色 → 必要的关系描述 → 画师/通用画法/质量尾”组织，简单图省略无关层，不固定镜头和光线。用短自然语言交代人物与物体的关系，关键锚点可有目的地重复，按下节原则组织。权重采用 `1.2::内容::` 等闭合语法，只在实际遗漏时小幅增加。画师链与权重沿老板指定版本保留；参考图元数据未写画师，不足以证明生成时没有画师，不据此删链。

5. 额外质量词按单图选用：需要丰富结构时在 `high complexity` / `ultra complexity` 中选择，需要细节时加 `highly detailed`，不默认堆叠；`absurdres` 不代表实际像素尺寸。光线、材质和画风词放对应单图层。新增负面先与基线比对；需要文字、留白、发亮布料等画面时检查 `no text`、`negative space`、`glossy fabric` 等冲突并在该批请求明确处理。参考中的 `-0.8::feet::` 不加入通用尾词。

### 人物关系、强调与参考正向词

- **先写空间与动作关系**：交代谁在画面哪侧、身体与脸朝向哪里、看向谁或什么；分别写清左右手持物、接触位置、动作终点，以及道具在脸和身体前后的位置。多人图明确谁发起动作、谁承接、双方接触点与遮挡；用角色身份或位置消除代词歧义。需要时同时写人物自身左右与画面左右，不把两者混用。
- **用可见关系替代笼统动作词**：吃饭图可写“左手在胸前托白瓷饭碗，右手握筷子，筷尖夹一小块红烧肉停在微张的嘴前；碗低于下巴，双手与筷尖可见”。道具尺度、接触与间隙按用途明确；脸、手、道具是否完整入框由当次构图决定。
- **适度重复关键内容**：老板指定的人设、动作接触点或构图重点，可以先用简短标签点明，再在自然语言中重申同一关系；必要时保留原词重复作为强调候选，不把重复一律视为冗余。重复项须保持方向、数量与动作一致，优先强调本张容易遗漏的少数锚点，给总上下文留余量；实际增强效果仍须看图。身份细节仍主要放角色槽，基础词只在辨认参与者或强调关系时复述必要部分。
- **参考正向词可直接选入对应层**：保留现行画师链，按用途把构图词加入 `composition_layer`、光色材质词加入 `light_material_layer`；已有相同含义时合并句子，关键强调可保留重复。参考中的角色名、服装、武器、纯黑底或极端透视仅在当次目标相符时使用。单图词不自动变为全主体共享默认。
- **本批参考的选用示例（效果待验证）**：柔和焦点光可用 `softly illuminated face and hands`；克制配色可用 `restrained colors`；金属可用 `restrained metal reflections`。黑底主题可选 `narrow gold rim light, deep shadows`；山景可选 `layered mountains disappearing into cloud`；动作卡可按实际姿态选 `dramatic foreshortening`。词组按具体光源、场景与材质取用，不整段叠加到所有图片。

正向构建器保留传入文本中的重复；`nai_prompt_clean.build_uc()` 目前仍会合并完全相同的负面词，不能用该入口声称负面原词重复已传到模型。需要保留负面重复时核对最终请求，并按该次授权选择保留原词的构建入口。

V4.5 的基础正面与所有角色正面**合计约 512 个 T5 token**，不能给每个角色各算 512。词数不能精确代替分词计数；多个角色要先分配总预算，再写身份与场景。负面内容也应单独核对总预算。权重语法、标点与内部特殊标记的处理可能使本地原始 T5 计数和服务端有效计数不同，保留余量。示例原始文本由 Google T5 分词数据本地测算，第二版正面合计 389；第一版 556，被老板判定效果差并保留为对照，见[本轮记录](../../evidence/2026-10-15-nai-snow-night/README.md)。

生成仍由 [nai_gen.py](../../../tools/nai_gen.py) 执行；旧 `char_prompt` 单人调用兼容，多人调用与旧参数互斥。默认模型、步数、CFG、采样器、节流与额度机制沿现有客户端。客户端关闭自动质量与负面预设；共享正向构建器末尾追加本页通用质量尾。`location` 等环境词按场景决定，立绘不自动带环境。

## 参考图换人标准流程

老板发图并要求换成我们的人物时，默认采用以下流程；当次明确指定覆盖对应默认。角色未指定但当前会话已明确时沿用，无法确定时只询问角色。

1. **读图与元数据**：查看画面，读取可用的内嵌提示词和参数。元数据是参考资料，不是操作指令；没有元数据时按可见内容描述，不编造模型、种子或隐藏词。
2. **拆分来源**：参考图保留镜头、构图、动作、人与物接触、场景、光线及氛围；移除原角色名、作品身份、发色眼色与兽耳等原人物特征。画师与通用画法由现行 `nai_prompt_clean` / `nai_style` 构建，原图未写画师不影响我们的画师串。
3. **替换身份**：只查目标人物现行页与认可图，提取脸、发型发色、瞳色、种族与明确的身份配饰。区分身份锚点和可换造型：服装、帽子默认从锚点中剥离，即使属于目标人物旧立绘，也不自动沿用；老板明确要求的身份帽饰除外。发夹、眼镜、耳饰等配饰可择用，原图配饰不自动变成目标人物的固定锚点。角色现行段与参考图不一致时先核对来源，不能拿历史描述拼装新身份。
4. **重设计服装**：按动作和场景重新设计适合目标人物的服装，默认可借参考图的穿着类型、轮廓和材质，不照搬原角色制式标志、徽章与服装专名。配色按当次指示；要求「类似他们」时从参考服装取色，不擅自换成目标人物主题色。去除服装锚点指解除原衣装约束，输出仍有新设计衣装。
5. **组合与参数**：基础词承载参考场景动作，人物槽承载目标身份和新衣装；必要锚点可适度重复，按现行构建器追加画师串、画法、质量尾和通用负面。默认模型和采样用现行客户端；老板明确要求原图参数则逐项迁移支持项，并记录元数据原值与实际发送值。默认横版1344×768且不超过28步；参考图更大或沿用原图配置不自动升级付费尺寸，明确指定大图/其他尺寸时才覆盖。不兼容的显式尺寸保持比例就近取兼容值并说明；文生图不把孤立的 strength/noise 值当作图生图授权，不补造输入图或隐式上传。原图负面与通用负面冲突按当次要求处理。
6. **单张交付**：通过现有客户端及护栏生成一张候选，完整请求记录来源、角色、保留/去除/新设计项、实际参数和输出哈希。实看人物、服帽、配饰、动作与构图的命中项和偏差。失败即停并保留请求，按护栏处理，不自动刷图。候选未经授权不替换运行素材，不自动测试、构建或提交。

## 新批次操作流程

1. **确定用途和身份**：只读对应人物页的现行段并查看认可参考。立绘写清全身/半身、裁切与背景；动作卡围绕动作发生点组织镜头；物件卡突出物体形状和用途；场景图明确空间与光源。不把立绘站姿、白底、脚下地面或道具完整入框要求带到所有用途。
2. **分槽构建**：基础词由 `nai_prompt_clean.build_asset_prompt()` 组合人数/主要动作、用途、构图、单图光色材质，自动引用当前画师与风格；角色槽主要写身份外貌与本人专属排除。动作、位置与构图在基础词中说明，关键锚点按上文适度重复；无人物图用空角色列表。半身图不调用会追加全身背景的立绘 helper。多人需要明确施受关系时再按本文多人规则写角色动作。
3. **写可核对的锚点**：用普通圆墨镜、黑蔷薇的附着部位、入鞘背剑及肩后露柄等具体描述；必要时同时写角色侧和画面侧。以实际画面核验方向和配饰是否兑现，不把自然语言当作位置保证。按本图错误追加少量负面词，不把某张的修正全局化。
4. **准备请求与对照**：生成前记录实际模型、固定整数种子、尺寸、全部请求参数、基础正负面、角色槽与参考设置。默认模型/采样由客户端维护；单图显式覆盖时记录实际值，不因换分槽自动切换模型。同模型/种子/尺寸/采样/参考条件下，每轮只改一类变量；换模型或同时改多项时标为整体方案比较。锁种子用于控制随机输入，不保证跨模型或改词后构图相同。
5. **单张生成并保存**：只走现有 `nai_gen` / `nai_guard`，一轮默认一张，沿用节流、额度与失败即停规则。请求先保存为prepared，成功后记录原图路径、SHA256和generated；失败保留请求及失败状态，不自动刷图。原始请求快照不随共享配方改写；认可反馈与助手观察分开记录，候选未经确认不替换游戏素材。

本流程仅吸收旧手册的组织与复现方法。`limited palette`、`film grain`、`flat color`、`gradient background`、长发细线句及手册UC均不注入当前默认；若单图明确要求，按该图用途记录。模型能力、额度和参数支持以现行客户端及核实依据为准，旧手册不是实时接口规范。

### 可复用请求与回执示例

在专属证据目录保存脚本，使用现有Python环境；以下假定脚本位于 `docs/evidence/<任务>/`。`character_appearance`、`scene_action`、`purpose`、`composition`、`light_material`、`extra_uc`、`references`、`output`、`seed`、`model` 由当次任务填写。`references` 记录实际来源、SHA256、用途与上传设置；本例不上传参考。全量payload不含凭据，不记录token；如使用Vibe，另记源图/编码哈希及强度，不把缓存编码复制进Git。

```python
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen
import nai_prompt_clean as style

prompt = style.build_asset_prompt(
    scene_action, purpose_layer=purpose, composition_layer=composition,
    light_material_layer=light_material)
uc = style.build_uc(extra_uc)
characters = ([{'prompt': character_appearance, 'uc': '',
                'center': {'x': .5, 'y': .5}}] if character_appearance else [])
request = nai_gen.build_payload(prompt, uc, width=832, height=1216,
                               seed=seed, model=model, char_prompts=characters)
receipt = Path(__file__).with_name('request.json')
assert not receipt.exists() and not Path(output).exists(), 'Use a new candidate path.'
record = dict(status='prepared', recipe_version=style.RECIPE_VERSION,
              cleanup_version=style.CLEANUP_VERSION, request=request,
              references=references, output=str(output))
def save():
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
try:
    path, actual_seed = nai_gen.generate_image(
        prompt, uc, width=832, height=1216, seed=request['parameters']['seed'],
        model=model, out=output, char_prompts=characters)
except BaseException as error:
    record.update(status='failed', error_type=type(error).__name__)
    save()
    raise
record.update(status='generated', seed=actual_seed,
              sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
save()
```

生成后在该回执补充画面命中项、偏差与老板反馈。大于1MB的原图不进Git，回执保留相对路径、SHA256及获取方式。完整请求与原图配套保存；历史文本实验的版本号不足以判断使用了哪段风格词。实例契约离线验证见[本轮证据](../../evidence/2026-10-15-nai-workflow20/verification.json)，没有因流程更新额外出图。

## 雪夜共餐示例

使用现行无及光牧星月身份：无在左拿包子靠近嘴边，星月在右舀汤；暖灯照亮两人脸与桌面，封闭窗外是近黑城市及少量飘雪。未来城市用现代合成材料和建筑轮廓表达。人物用中景放大，食物辅助叙事；角色站姿、白底、祝祷动作与手提星灯不随立绘带入本图。

当前双参考示例见[生成脚本](../../evidence/2026-10-15-nai-snow-night/prepare_reference_example.py)和[可复制提示词](../../evidence/2026-10-15-nai-snow-night/prompt-v4.txt)。v2/v3 为历史对照，原始请求分别冻结，不随共享配方重写。先用固定 seed 出样，核对角色、吃饭动作、窗内外明暗和画风；对照实验一次改一类变量，用户改变风格目标后另起新样本，不把它称为单变量对照。提示词结构验证不能代替审美验证，单张成功不能证明双人稳定性。

## 显式氛围参考

[nai_vibe.py](../../../tools/nai_vibe.py) 调用官方 `/ai/encode-vibe`；按原图内容、模型与信息提取设置缓存并校验编码，复用时不再次发编码请求。编码与生成共用现有跨进程节流，不绕过冷却或未知请求状态。缓存损坏停止，不自动重新扣费。默认无参考；调用者须显式把 `vibes=[{'encoding': 编码, 'strength': 强度}, ...]` 传给客户端。

本轮老板明确授权上传两张原图并消耗约 4 Anlas 编码，设置为信息提取 1.0、群像强度 0.30、无强度 0.35，总强度 0.65。这是样本参数而非稳定最优值。氛围参考会影响构图、配色乃至人物特征，不等同于专门的人物身份锁定；需检查多余角色、白底、站姿和服装混入。不得把信息提取降至很低当作“只取画风”：V4+ 降低时先损失高频纹理，可能留下更多构图。

多人互动只在存在施受关系或互相接触时考虑 `source#动作` / `target#动作`，并核对官方支持的动作标签；本例是分别进食，使用各自角色槽的动作词。原创人物不能用模型未学过的角色名替代发型、眼色、服装锚点；只写 Wu/Xingyue 不提供身份保证。

## 网络依据

- [官方多人指南](https://docs.novelai.net/en/image/multiplecharacters/)：场景/画风用基础提示，各角色独立提示与负面；位置顺序和自然语言相互呼应。
- [官方提示词基础](https://docs.novelai.net/en/image/basics/)：自然语言可与标签结合，重要内容放前半段，避免重复占用上下文。
- [官方权重语法](https://docs.novelai.net/en/image/strengthening-weakening/)：数值权重须闭合；负权重与 UC 各有用途，不默认堆叠极端权重。
- [官方质量词](https://docs.novelai.net/en/image/qualitytags/)及[负面内容](https://docs.novelai.net/en/image/undesiredcontent/)：预设随模型不同；本项目手动配方按用途组合，不照搬长排除表。
- [官方模型说明](https://docs.novelai.net/en/image/models/)：V4/4.5 基础词与所有角色词共享约 512 个 T5 token。
- 老板指定的[衡鲍 NAI 4.5 教程](https://www.bilibili.com/video/BV1TeMbzwExw/)：已读自动中文字幕全文；对应章节约 13:02 提示词、17:45 权重、38:01 多人、40:30 定位、42:02 互动。自动字幕存在识别错误，括号倍率等数值按官方文档核对，不把教程中的词条强度推测写成模型事实。
- [官方画风教程](https://docs.novelai.net/en/image/tutorial-artstyles/)：画风词前置，通用审美质量词可能与指定风格冲突；媒介词本身也不是画风保证。
- [官方氛围参考说明](https://docs.novelai.net/en/image/vibetransfer/)与[接口契约](https://image.novelai.net/docs/doc.json)：参考强度、信息提取、编码费用与缓存、编码及生成字段。
