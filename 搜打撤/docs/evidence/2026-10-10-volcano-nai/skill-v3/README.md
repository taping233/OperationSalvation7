# NAI5技能学习与单张重写

找到并读取 `C:/Users/太平/.zcode/skills/nai5-prompting/SKILL.md`，按需读取两份参考的构思分工、语法容量、字段模板、镜头/姿势词组、互斥背景、关系句、迭代和§9检查表。

前两轮的可核实问题：采用V4.5，而技能适用V5；机位与姿势主要用长句描述；v2又把完整人设放主提示词并清空角色栏。长句描述肢体不能替代机位/姿势tag，增加长度本身不是修复。

v3 Prompt最前仅一次1boy/solo；用from above、upper body、leaning forward、outstretched arm、open hand定位机位与动作，dark background单一背景类型；Character 1以boy开头，完整列原创男性人设，不带动作/场景；关系句写占画面与纸牌卷入喷发。画师串只引用项目nai_style已给配方；保留其画风块，删除不需重复的masterpiece/best quality。UC通过项目构建器保留其基线与本图排除项，API预设none。完整字段见request.json。

显式调用nai-diffusion-5-full，不修改全局默认，1024×1024/28步，单张随机seed1586848622，HTTP200。原图1319495字节，只留根.tmp/nai/output/volcano-painterly-20261010/volcano-nai5-v3.png；SHA见receipt.json，不入git。

实际查看：人物躯干与施法手臂连贯，低发髻/圆镜/黄瞳/黑紫高领袍/白羽蓝宝石胸饰可辨，三张牌边缘燃烧并进入喷发；暗色背景存在，但四周留有白色刷边，脸与衣面仍偏细线/平滑明暗。只交候选，未宣称画风通过，未替换现行卡图。未测试、未build、未提交。
