# 充能火山 NAI 单张试图

老板授权调整本次画风提示词并使用现有NovelAI API出一版。现行全局nai_style v1.3与客户端默认均未修改；通过nai_prompt_clean.build_asset_prompt/build_uc追加单图要求。

实际调用nai_gen.generate_image，模型nai-diffusion-4-5-full，1024×1024，28步，seed 101010031，单张。直连HTTP200，PNG尺寸与完整性由现有客户端核验，shared guard已解除request_pending，未重试第二张、未购买或追加额度。密钥未输出。

正负词、角色栏与参数见request.json；原图路径、体积与SHA256见receipt.json。角色栏采用常无欲现行男性身份；未发送参考图，客户端只有文本角色栏。

实际看图：男性/银发/金瞳/眼镜/尖耳存在，但脸部与服饰未准确匹配定稿；画面偏细线和平滑明暗，背景为白色，人物躯干像裁断贴片，火焰细线束未落实大色块与宽笔要求。画风、构图与身份细节均未达目标，不接入游戏。交付单张真实API样本供老板评价，不把API成功写成美术通过。

未运行测试、build或提交。仅保存候选与来源记录。

## v2单张

老板纠正后，完整人设进入主提示词，角色栏留空；增加连续躯干/手臂、卡片消耗与能量交互、沿卡名设计抽象暗底，见request-v2.json。老板确认「画吧」后由generate-v2.py复用同一客户端调用，参数与seed保持不变。

HTTP200单张成功，guard request_pending已解除。结果保留暗底与男性身份，但人物仍成为断开的半身贴片，手臂不连续，喷发变成平滑白色月弧；没有落实目标构图/交互/宽笔画法。原图1139191字节，仅留根.tmp/nai/output/volcano-painterly-20261010/volcano-nai-v2.png，不入git；SHA与参数来源见receipt-v2.json。未接入游戏，未额外重刷，未测试或提交。
