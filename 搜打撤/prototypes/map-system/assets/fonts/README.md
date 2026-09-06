# 内嵌字体（OFL 许可，允许随软件分发）

- `cascadia-code-400/700.woff2`：Cascadia Code（微软终端字体）子集，OFL；来源 C:\Windows\Fonts（https://github.com/microsoft/cascadia-code）
- `notosans-sc-400/700.woff2`：Noto Sans SC（思源黑体同源）按项目文本子集（1704 字形），OFL；来源本机 NotoSansSC-VF.ttf 实例化（wght 400/700）
- 子集重建：`pyftsubset`（fonttools）；字符集 = 项目全部 src/css/html/ink 文本 + ASCII + 常用符号。
  新增文案含生僻字时会回退 "Microsoft YaHei"，视觉差异可接受；必要时重跑子集化。
