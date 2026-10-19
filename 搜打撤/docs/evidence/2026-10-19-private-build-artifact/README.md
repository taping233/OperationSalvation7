# 私仓完整构建制品

原Vite run只执行npm run build且不归档，预算失败后没有可取回的dist。现拆分原prebuild/Vite/postbuild链，保留全部检查；只在Vite成功、逐文件清单和字体许可原件核验成功时保存私仓Actions artifact，7天到期。预算失败仍使run失败，制品内明确记录failure，不标为全CI通过。

- 新增build-provenance.json含完整源SHA、run ID、各文件SHA256/大小、许可路径、预算真实结果；不含凭证或工作区绝对路径。
- upload-artifact固定官方v4当前commit ea165f8d65b6e75b540449e92b4886f43607fa02；仅上传desktop-app/game生成目录，contents仍read，无权限扩张。
- 5组91项集中验证通过（制品清单/构建输出/脚本契约/review/保存退出）；ESLint、Node语法、YAML解析通过。完整真实构建与制品下载须在提交后的CI核验，当前不完整恢复目录不能替代完整dist。
- 本轮未创建/配置Sites。已知4项性能预算超标不在此处放宽；源字体许可禁止修改，未进行WOFF2转换或子集化。

实际制品核验：b4ed9d3 的 ZIP 与 GitHub digest 一致，1637 个归档文件逐项字节数与 SHA256 一致，9 份许可齐全。原清单额外包含上传器默认排除的 5 个 .gitkeep/.gitignore（438 字节）；未缺运行资源。后续清单按相同隐藏路径规则记录 excludedHiddenPaths，原文件不删除。构建成功、性能预算失败分开保留。

交付复用：只读验证入口在 1004f21 的真实 Actions 制品上通过，1637 文件 / 222357530 字节与来源、逐文件 SHA256、许可完整匹配；该制品预算结果仍为 failure。定向 7 项测试覆盖来源不符、文件篡改、多余文件、重复/越界清单路径及既有构建边界，ESLint 通过。此结果不是实页验收。
