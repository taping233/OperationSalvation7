# 无背后黑剑与剑带

老板要求给现行无立绘补挂在身后的黑剑并带剑带。内置image_gen局部重绘：黑色直身长剑入黑鞘，缠柄与简洁护手从画面左肩后露出，下段黑鞘从画面右侧裙摆后延伸；黑色皮革剑带斜跨胸前，方扣与腰侧固定环可见。保留白底、交错站姿、人设、黑灰裙与块面画法。

运行图`game/assets/portraits/full/wu.webp`与人设参考副本同步，1024×1536。完整词与参考见[request.json](request.json)，尺寸/新旧SHA256见[receipt.json](receipt.json)。旧版在`.tmp/imagegen/wu-back-sword-20261018/backup/`，原PNG与轻量成品在`game/art-source/characters/wu-back-sword-20261018/`；PNG超过1MB，仅本地保留并由目录.gitignore排除。其他四人不变。

验证：生成图已目检，背剑、剑鞘与胸前剑带可见；解码1024×1536、运行图与参考副本一致，目标素材检查零问题，文档检查549链接通过，自有差异空白检查通过。Codex内置浏览器5200当前1523×956窗口真实进入档位01→配置培养页，图片加载完成，自然尺寸1024×1536，背剑与剑带显示完整，见[实页截图](personnel.png)。未新增服务、未build、未提交。
