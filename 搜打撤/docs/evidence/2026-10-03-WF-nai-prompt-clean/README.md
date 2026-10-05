# 生图提示词整理与无朝右透明战斗立绘

2026-10-03，老板授权本轮整理并生成一张无的朝右透明底战斗立绘。基线 HEAD `425d03920e`，共享混树；未刷新远端、未 build、未提交或替换游戏运行素材。

## 整理

- 新增 `tools/nai_prompt_clean.py` 兼容入口，引用在途 `nai_style.py` 的原配方，不覆盖他人规范改动；新批次说明见 `tools/NAI-PROMPTS.md`。
- `.tmp/nai/` 59 个 Python 文件，50 个含生图入口；43 个更新兼容导入或明确冲突，全部原字节保存在 `original-scripts/`。完整路径、前后 SHA256 与改动原因见 `cleanup-manifest.json`。
- 负面词按完整词项去重，保留首项和 NAI 加权组。无的年龄/单排裙边矛盾、常无欲多人物 solo、三个重复通用画风段、潜匿露身比例和满月卡脚下地面要求已整理。历史实验画风保留；旧 payload、manifest 和产图不改。

## 验证

- `python -B -m unittest discover -s tools/tests -p test_nai_prompt_clean.py -v`：6 项通过，覆盖去重、加权组、专属项、旧函数兼容和透明用途分离。
- 59 个脚本全部 AST 语法检查通过；43 个修改后 SHA256 与原字节备份逐一核对；两处原先各重复 16 个基线词的常无欲批次实际构建 UC 无重复。见 `cleanup-validation.json`。
- 整理及验证未读凭据、未发 NAI 请求。生图只调用一次内置 imagegen；共享规范和游戏源码无本轮修改。未宣称全量测试、游戏页面或远端 CI 已通过。

## 图片

完整实际提示词、通道、配方版本和认可参考图 SHA256：`wu-battle.request.json`。附带 NAI 提示词仅为离线记录，本次图片来自内置 imagegen。

图片：仓库相对路径 `.tmp/nai/output/wu-battle-right-transparent-20261003/wu-battle-right-transparent.png`。1024×1536 RGBA，四角 alpha 为 0，包含真实透明区域；文件约 1.98 MB，位于忽略目录，不进 Git。原图获取方式为内置生图结果复制，SHA256、像素统计和原生保存路径见 `image-validation.json`。

可见复核：无朝屏幕右方，剑尖向右；完整马尾、裙摆、双脚和剑保留；银白高马尾、蓝缎带、头顶墨镜、黑蔷薇、黑露肩裙及蓝星内衬继续沿参考。供老板审美验收，尚未接入运行时。通道不暴露随机种子，不虚构可精确复现承诺。
