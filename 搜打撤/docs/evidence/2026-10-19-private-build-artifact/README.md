# 私仓完整构建制品

原Vite run只执行npm run build且不归档，预算失败后没有可取回的dist。现拆分原prebuild/Vite/postbuild链，保留全部检查；只在Vite成功、逐文件清单和字体许可原件核验成功时保存私仓Actions artifact，7天到期。预算失败仍使run失败，制品内明确记录failure，不标为全CI通过。

- 新增build-provenance.json含完整源SHA、run ID、各文件SHA256/大小、许可路径、预算真实结果；不含凭证或工作区绝对路径。
- upload-artifact固定官方v4当前commit ea165f8d65b6e75b540449e92b4886f43607fa02；仅上传desktop-app/game生成目录，contents仍read，无权限扩张。
- 5组91项集中验证通过（制品清单/构建输出/脚本契约/review/保存退出）；ESLint、Node语法、YAML解析通过。完整真实构建与制品下载须在提交后的CI核验，当前不完整恢复目录不能替代完整dist。
- 本轮未创建/配置Sites。已知4项性能预算超标不在此处放宽；源字体许可禁止修改，未进行WOFF2转换或子集化。
