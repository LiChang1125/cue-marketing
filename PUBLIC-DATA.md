# CUE 公共媒体版

首页和灵感档案仅从 `shared/media-sources.js` 中的行业媒体读取公开文章。来源名单来自提供的两张参考图；不能读取、停更或需登录的站点不会伪造内容。主页保持原有排版。付费抖音采集和账号浏览器采集已停用，Pages 不使用这些配置。

脉动使用独立的 `feed.publicPulse.items` 内容池，不读取首页文章；排除首页媒体域名和已经在首页出现的原文链接。TrendRadar 扩展公开热榜，并使用固定版本的原版 RSSParser 读取 `config/pulse-feeds.json` 的独立商业、消费、时尚与科技来源。关键词及中英文同义词筛选后，优先有发布日期的报道，再补充匹配的热榜话题，最多 10 条并尽量分散来源。媒体关注图仅按真实发布日期计数，热榜首次出现时间不冒充发布时间。热榜轨迹使用同一平台原始排名，不等于全网讨论量。

英文标题、摘要及日报导语在发布前使用 Argos 英中离线模型 1.9、CTranslate2 CPU 推理翻译。固定模型 SHA-256，70 MB 模型在 Actions 缓存，不依赖翻译 API 或登录。原始文本保存在 originalTitle/originalExcerpt，原文链接、日期和指标不变。翻译缓存跨发布保留；翻译失败则不发布半成品。品牌名称和专业术语的机器翻译仍可能需要人工校订。模型来自 https://argos-net.com/v1/translate-en_zh-1_9.argosmodel ，上游项目与许可见 https://github.com/argosopentech/argos-translate 。

## TrendRadar

实际运行 [TrendRadar](https://github.com/sansan0/TrendRadar) 的原版 `DataFetcher`，独立 Python 进程获取 NewsNow 公开热榜。上游版本固定为 `86584f5544c66d4e22132f9b87c44a7ea3a32fea`；安装脚本核对文件校验值，并保存上游 GPL-3.0 LICENSE。未改动、未将上游代码打包进前端。不使用可选付费 AI、账号 Cookie 或通知渠道。上游源码及许可证可在该固定提交中查看。

## 自动更新与部署

`.github/workflows/pages.yml` 在 main 推送、手动运行、每小时 17/47 分钟以及北京时间 08:00 运行。免费 GitHub 托管任务读取媒体与热榜，再发布静态网页和公共 JSON。访客无须登录；网页每分钟重新读取数据。GitHub 定时任务可能排队，公开来源也可能失败，因此不承诺秒级实时或精确到分钟的日报发布。当天 08:00 后生成昨日新闻日报，归档保留 90 期。

每次从已发布数据继承最近 30 天文章及原始排名历史；相同平台/URL/上游时间戳去重，缓存内容不会重复制造趋势。原始来源失败时保留先前数据的原始日期。无可用文章或无法读取上一版时停止部署，已有网站继续服务。数据健康状态在公开 JSON 的 sourceHealth 中，访问密钥、数据库和账号状态不发布。

本地：`node scripts/setup-trendradar.mjs`，`python -m pip install -r requirements-public.txt`，`python scripts/trendradar_bridge.py`，`node scripts/refresh-public-data.mjs`，`python scripts/localize-public-data.py`。设置 `VITE_PUBLIC_DATA=true` 后构建，把 `.artifacts/public-data/content-data.json` 放入 dist。

修改设计或逻辑后推送 main 即重新构建；在 Actions 查看 Update CUE website 是否成功。仓库长期无活动时 GitHub 可能暂停定时任务，应检查并重新启用。精选版块保持原分类与原文跳转，晨报保留原栏目及归档。
