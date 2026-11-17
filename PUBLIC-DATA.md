# CUE 公共媒体版

首页和灵感档案仅从 `shared/media-sources.js` 中的行业媒体读取公开文章。来源名单来自提供的两张参考图；不能读取、停更或需登录的站点不会伪造内容。主页保持原有排版。付费抖音采集和账号浏览器采集已停用，Pages 不使用这些配置。

脉动现在是独立报告搜索，使用 `feed.publicPulse.researchItems`，不读取首页文章。搜索默认为近 90 天，也可选择 30 / 180 天；最多返回十篇可核实日期的市场、消费及品牌报告/深度报道，不用热搜条目或新品快讯补数。独立来源包括艾媒咨询公开报告摘要、CBNData、Glossy、Daxue Consulting、Dao Insights、Marketing to China 等。关键词同义词、领域相关性和发布日期共同筛选。源站没有足够内容时显示实际数量，不保证任意词都有十篇。

原版 TrendRadar `DataFetcher` / `RSSParser` 采集公开内容，`count_rss_frequency` / `prepare_report_data` 整理报告，`render_rss_html_content` 生成可打开的原生 HTML 汇总。固定十个常用研究主题每轮生成；自由输入关键词检索同一独立报告库。此处“报告”指来源实际发布的研究或深度报道，不代表由 AI 凭空写出十篇研究结论。

选刊的“仅看中国”在所有已收录分类的并集中筛选，再分页；按标题和摘要的发生地证据判断。未提及发生地的文章不会仅凭中文或中国品牌被收录，因此是保守筛选。

英文标题、摘要及日报导语在发布前使用 Argos 英中离线模型 1.9、CTranslate2 CPU 推理翻译。固定模型 SHA-256，70 MB 模型在 Actions 缓存，不依赖翻译 API 或登录。原始文本保存在 originalTitle/originalExcerpt，原文链接、日期和指标不变。翻译缓存跨发布保留；翻译失败则不发布半成品。品牌名称和专业术语的机器翻译仍可能需要人工校订。模型来自 https://argos-net.com/v1/translate-en_zh-1_9.argosmodel ，上游项目与许可见 https://github.com/argosopentech/argos-translate 。

## TrendRadar

实际运行 [TrendRadar](https://github.com/sansan0/TrendRadar) 的原版 `DataFetcher`，独立 Python 进程获取 NewsNow 公开热榜。上游版本固定为 `86584f5544c66d4e22132f9b87c44a7ea3a32fea`；安装脚本核对文件校验值，并保存上游 GPL-3.0 LICENSE。未改动、未将上游代码打包进前端。不使用可选付费 AI、账号 Cookie 或通知渠道。上游源码及许可证可在该固定提交中查看。

## 自动更新与部署

`.github/workflows/pages.yml` 在 main 推送、手动运行、每小时 17/47 分钟以及北京时间 08:00 运行。免费 GitHub 托管任务读取媒体与热榜，再发布静态网页和公共 JSON。访客无须登录；网页每分钟重新读取数据。GitHub 定时任务可能排队，公开来源也可能失败，因此不承诺秒级实时或精确到分钟的日报发布。当天 08:00 后生成昨日新闻日报，归档保留 90 期。

每次从已发布数据继承最近 30 天文章及原始排名历史；相同平台/URL/上游时间戳去重，缓存内容不会重复制造趋势。原始来源失败时保留先前数据的原始日期。无可用文章或无法读取上一版时停止部署，已有网站继续服务。数据健康状态在公开 JSON 的 sourceHealth 中，访问密钥、数据库和账号状态不发布。

本地：`node scripts/setup-trendradar.mjs`，`python -m pip install -r requirements-public.txt`，`node scripts/collect-research.mjs`，`python scripts/trendradar_bridge.py`，`node scripts/refresh-public-data.mjs`，`python scripts/localize-public-data.py`，`node scripts/prepare-research.mjs`，`python scripts/render-research.py`。设置 `VITE_PUBLIC_DATA=true` 后构建，把 `.artifacts/public-data/content-data.json` 放入 dist。

修改设计或逻辑后推送 main 即重新构建；在 Actions 查看 Update CUE website 是否成功。仓库长期无活动时 GitHub 可能暂停定时任务，应检查并重新启用。精选版块保持原分类与原文跳转，晨报保留原栏目及归档。

云端无需账号的常驻服务入口为 `server/public-server.js`、`Dockerfile.public` 和 `compose.free.yaml`，详见 [CLOUD-PUBLIC.md](CLOUD-PUBLIC.md)。该路径不同于旧账号采集入口，启动后自行轮询更新。
