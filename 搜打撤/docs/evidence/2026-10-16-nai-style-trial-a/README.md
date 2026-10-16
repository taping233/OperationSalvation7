# NAI 画法单变量候选 A

2026-10-16 老板授权单张对照，尚未选择为默认。沿用[认可请求](../2026-10-16-nai-default-wide/approved.request.json)的场景、人物槽、四画师、负面词和全部采样配置，仅替换画法段落及其客户端同步副本。seed=3058649506，2048×1152；通过现行 nai_gen / nai_guard 生成，HTTP 200。

完整候选、替换前后画法、输出 SHA256 与默认文件指纹见 [request.json](request.json)，复现脚本见 [run_trial.py](run_trial.py)。生成前逐字段断言请求只改变 input 与 parameters.v4_prompt.caption.base_caption；生成后确认 nai_style.py 和 nai_gen.py 指纹未变。

原图位于项目根 `.tmp/nai/wu-dinner-v5-arknights-wide-2048-20261016.png`，候选位于项目根 `.tmp/nai/wu-dinner-v5-style-trial-a-20261016.png`。两图均超过1MB，不入Git；候选通过本目录脚本和现有授权凭据获取。脚本拒绝覆盖已有请求和输出，重新生成须另建独立版本。

本轮视觉观察：候选袖子与躯干的明暗归组更集中；长发内部仍有密集细线，头发归组目标未充分达到。人物动作大体延续，但厨房透视比原图更倾斜，背景构图发生变化；同种子不锁定修改提示词后的布局。尚无全面优于原图的结论，不覆盖共享默认、不接入游戏，不追加出图。

未验证：其他种子、其他场景的稳定性；本轮只证明这一次请求与输出。未提交、未推送。
