# 免费可商用音效库再筛（2026-10-18）

老板认为整体库仍不合适，要求寻找更符合代号柒、质量更高的来源；追问预算后明确“只找免费、可商用的库”。本轮以未来科幻城市、冬境、战术卡牌、克制界面反馈为筛选依据，保留已认可的原创点击/确认/奖励，未改游戏或任何运行映射。

## 主要结果

### Sonniss GDC 2026：已从官方镜像取得18个原始样本

官方入口：https://gdc.sonniss.com/ 。官方声明347+文件、7.47GB+，来自商业声音库的原文件；免费，允许商业游戏、修改和不限项目使用。许可原文：https://sonniss.com/gdc-bundle-license/ （v2.0，2026-08-27生效）；禁止将音效本身作为素材包再分发或用于训练/开发AI。此处是使用条款摘要，不是免除遵约义务。

本轮取得官方公开CSV目录 `sources/sonniss-2026.csv`，发现适合后续选择的系列：

- Epic Stock Media / Anime Game：二次元战斗命中。
- Epic Stock Media / Board Game：纸牌翻动、选择、出牌。
- Epic Stock Media / Tower Defense Game：挥击、单位部署与特殊动作。
- Cinematic Sound Design / UI Interaction Elements：Accept Shimmer Clear、Deny Muted、Ting Coins。
- Cinematic Sound Design / System & UI Feedback Elements：低沉拒绝、科幻提示与揭示。
- 344 Audio / Casino Cards Vol.1：抽牌与洗牌实录。

主下载站的终端HTTP范围请求返回403。随后经官网给出的Google Drive镜像，以匿名公开下载入口读取五个ZIP目录，按18个文件的范围获取约69MB原始WAV；没有下载全量7.47GB，没有使用浏览器账号凭证。读取过程核对ZIP CRC及字节数，只用于确认传输完整，不是游戏或听感验收。原件留在 `sources/sonniss/`；`sonniss-receipt.json` 记录官方链接、所在分包、原路径、相对本地路径与SHA256，`fetch-sonniss-mirror.py` 记录获取方法。

样本包括6个按钮/系统提示、4个奖励候选、3个纸牌和5个战斗/技能。按原始完整时长制作 `03-sonniss-ui.mp3`、`04-sonniss-rewards.mp3`、`05-sonniss-card-combat.mp3` 三段本地选样，声音之间留800ms，只降低响度，不EQ、不变调、不叠层；来源与时间轴见 `sonniss-preview-receipt.json`。Sonniss公开CSV与实际ZIP个别文件名不同，下载与来源登记以ZIP目录为准：例如UI Interaction Elements中的实际样本是Accept Boing Crunch而非CSV中的Accept Shimmer Clear；本轮未选该Boing音。

这组声音仍是待老板试听的候选，未把供应商名称或文件规格等同于听感通过。Sonniss允许同一项目团队内部共享，音频只在本地证据目录供本项目选样，未对外发布音效包。

### 小红书参考笔记的线索

老板提供的笔记为《来，教你0元搞定所有游戏音乐音效！》：https://www.xiaohongshu.com/explore/69ede968000000003601f460 。Codex内置浏览器读取相关第1至5张图；第4张实际推荐Freesound、Kenney、Sonniss、ZapSplat、Pixabay/Mixkit。其余音乐与AI创作内容未作为本轮音效来源。

沿线取得Kenney Interface Sounds完整100音效源包（CC0，官网和包内License.txt均允许商业使用且不强制署名），尚未接入或声称听感通过。官网：https://kenney.nl/assets/interface-sounds ，本地 `sources/kenney_interface-sounds.zip` ，下载指纹与清单见 `kenney-receipt.json`。

另定位Freesound/Tissman的modern GUI：menu move1、menu move7、notification2三个单音页面均明确CC0，分别为54ms、60ms、1592ms；原始下载要求登录，本轮只保存来源线索，没有领取。来源：https://freesound.org/people/Tissman/packs/29401/ 。未重复采用已被老板否定的Mixkit；ZapSplat没有进入本轮下载候选。

### Chequered Ink 400 Sounds Pack：已实际取得的整体候选

来源：https://ci.itch.io/400-sounds-pack 。作者明确允许免费商业用途，可署名也可不署名，禁止把未修改素材当作自己的素材资产再出售或再分发。涵盖Card & Board、Combat & Gore、Items、Weapons、UI、环境、机械与其他类别；本轮不选其Retro/8-bit、卡通与大段乐器音阶作为游戏方向。

通过作者提供的“No thanks, just take me to the downloads”零费用入口获取64MB源包，未支付、未注册账号、未提交邮箱。源包与解压目录只在 `sources/` 本地保留，不进Git；源包字节/SHA256与文件清单见 `chequered-inventory.json`。分类页快照为 `sources/chequered.html`，下载页仅本地存档，含临时下载上下文，不对外分享。

从同一库中准备10个跨场景样本，分为两段：

1. `01-ui-and-items.mp3`：科幻选择→科幻确认→系统完成→获得物品。
2. `02-card-and-combat.mp3`：抽牌→展牌→轻斩→挥斩→格挡→钝击。

保持每件原时长与音色，不变调、不EQ、不叠层；仅降低响度（平均-25dBFS与峰值-16dBFS上限，不提升）并插入650ms分隔，供老板本地选样。完整来源路径、单件SHA256、增益、起点和时长见 `preview-receipt.json`。这只是候选，不将作者口碑、文件规格或数值处理称为质量/听感验收。

## 其他筛选与边界

老板试听后否定本轮Sonniss候选，未将其接入。随后转向日本音效站，取得効果音ラボ六个按钮/获得候选和OtoLogic三个源包（Cyber14、Assorted SE01、Assorted SE08），各准备六个声音的短试听。新候选、许可、时间轴、来源路径与获取指纹见 [日本音效候选记录](JAPANESE-AUDITION.md) 和 `japanese-preview-receipt.json`；仍由老板验听，没有游戏修改。効果音ラボ为私有项目选样，不对外分发；OtoLogic发布时需按CC BY 4.0保留署名。

SoundMorph First Contact（https://soundmorph.com/products/first-contact）是100+文件的免费专业样包，涉及技术冲击、科幻能量、机械、转场和雨景；官方领取要求注册账户、订阅通讯及零费用结账。本轮未代老板注册、订阅、接受协议或领取。未列其付费Modular UI/Users of Tomorrow为本轮免费可用资产。

SwishSwoosh Free UI Click Sound Pack有100个声音、7MB，适合界面细节，官方个人许可支持单用户用于电子游戏。它不覆盖整体战斗/卡牌库，且许可与领取流程需随实际使用主体保留，因此没有取得或接入。

本轮未验证游戏、未构建、未运行测试、未人工耳听、未提交；没有对已认可三样进行修改。音频和压缩包均不进Git，只留来源、路径、获取方式和指纹。是否采用候选由老板试听决定。
