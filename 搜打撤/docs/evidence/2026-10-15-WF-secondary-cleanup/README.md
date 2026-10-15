# 旧包与卡牌总录渲染副本清理

2026-10-15，按老板明确指示清理旧音乐版EXE、旧运行交付ZIP及卡牌总录渲染/QA副本，保留最终Word、PDF、数据和生成脚本，其余不动。实际删除745件、545202116字节（约519.95MiB）；逐件路径、大小、修改时间和SHA256见[删除收据](deletion-receipt.json)。没有提交或推送。

## 删除范围

- `搜打撤/desktop-app/dist/搜打撤-代号7-音乐版-20261005.exe`：187920047字节。
- `搜打撤/.tmp/friday-delivery-final-db831272/OperationSalvation7-db831272780b-runtime.zip`：221460129字节。该目录的交付清单与上传请求JSON保留。
- `搜打撤/docs/evidence/2026-10-09-card-history-document/`下`render`、`render-final`、`pdf-qa`、`pdf-qa-final`中的743张PNG/JPG预览图及接触表：135821940字节。未删除PDF或其他文件，空目录保留；`render-tmp`原本为空。

所有最终绝对路径均核对在`D:/素材/代号柒`内，未对目录递归删除；先生成固定文件清单与哈希，逐件复核大小/修改时间后使用原生PowerShell `Remove-Item -LiteralPath`删除。

## 保留与验证

保留原Word、当前交付PDF、`render`及`render-final`内两份历史PDF、catalog.json、核对数据、全文文本与三个生成/提取脚本。卡牌总录所有非清理目标及ZIP目录两个JSON共14件，删除前后SHA256全部一致，详见收据`preserved`字段。

网页版5200保留PID23856，未重启；清理前后HTTP入口均返回200。本轮不改游戏源码、素材或依赖，不进行游戏构建或玩法验收。上一轮保留的四份独有报告、44份记录及其他目录均不在本轮删除清单。
