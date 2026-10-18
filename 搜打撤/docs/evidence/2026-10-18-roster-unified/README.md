# 五人统一立绘（2026-10-18）

老板要求重绘全部角色并统一尺寸。内置 image_gen 分别重绘无、常无欲、白塔、黑像、星月；每张以本人原运行图控制身份、服装、姿势和道具，以 `output/imagegen/wu-boots-1018/wu-boots-final.png` 仅控制10-18默认精修二次元半厚涂画法。完整词和参考路径见 [request.json](request.json)。

五张原稿均为1024×1536；导出时整图等比缩为922×1382，居中放在1024×1536白色画布，统一最小安全留白，不裁切人物及道具。白塔保留坐姿、椅子、蛋糕、古书和法阵；其他四人保留站姿及各自道具。运行图与人设参考副本逐字节同步；对应素材清单仅更新五条。

运行路径为 `game/assets/portraits/full/{wu,changwuyu,baita,heixiang,xingyue}.webp`；原稿与轻量成品在 `game/art-source/characters/roster-unified-20261018/`。大于1MB的PNG通过本目录 `.gitignore` 排除，仅本地保留；旧图备份在 `.tmp/imagegen/roster-unified-20261018/backup/`。来源、SHA256与逐图尺寸见 [receipt.json](receipt.json)。未改变战斗帧和皮肤。

导入首次执行在五图转换完毕后，因当前Python版本不支持Path.write_text的newline参数而中断；修正该参数并核对已导入图等于自有导出图后续跑，保留原始备份，完成清单与收据。

验证：五图解码1024×1536、运行图与参考副本一致；生成图已逐张目检。inspectAssets五个目标路径零问题，docs:check通过（549条链接），自有差异空白检查通过。当前Codex内置浏览器于`http://localhost:5200/`，1280×720当前窗口，从档位01进入基地、出征人物选择，真实点击切换五人；五张页面截图`page-<id>.png`均已目检，完整轮廓、白塔椅子法阵及黑像巨剑可见。四位同伴DOM图片尺寸与加载完成状态见[browser-checks.json](browser-checks.json)，无另有页面截图与本地解码证明。未启动出征或改写存档内容，未启动新服务，未build、未提交。既有5200服务保持运行。
