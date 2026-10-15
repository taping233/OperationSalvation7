# 选择存档天气图标接入

老板认可五张预览并授权接入；档位01—05依次为晴、多云、雨、雷、雪。保留天气含义，使用暗圆承托、局部辉光及细光痕，替换旧方框SVG。

- `game/src/ui/slot-emblems.js` 使用五张透明WebP；`game/css/slots-cover.css` 图像画布由110px调整为146px，以容纳图内透明留白。
- 原始生成件保留在 `game/art-source/slot-weather-20261015/`；运行素材位于 `game/assets/ui/slot-weather/`。源图未重抠或改色，等比缩至384×384并以无损RGBA WebP编码。
- 图源、尺寸、透明范围、字节数与SHA256见 `receipt.json`，生成提示见 `prompts.json`；转换流程见 `install.py`。使用Codex内置image_gen，方舟原板仅作视觉关系参考，未接入参考原图。
- 雷原稿超过1MB，留本地并通过原稿目录 `.gitignore` 排除；获取方式为保留的内置生成工具路径（详见收据），或沿提示和参考重新生成候选，重新生成不保证字节一致。
- 沿老板“不用测试”要求，未运行测试、构建或浏览器验收；实页显示效果未核验。未启动服务、未提交。
