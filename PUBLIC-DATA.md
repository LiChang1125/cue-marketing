# CUE 公共媒体版

首页和灵感档案仅从 `shared/media-sources.js` 中的行业媒体读取公开文章。来源名单来自提供的两张参考图；不能读取、停更或需登录的站点不会伪造内容。主页保持原有排版。付费抖音采集和账号浏览器采集已停用，Pages 不使用这些配置。

脉动按关键词和中英文同义词筛选，最多返回 10 篇最新报道。媒体关注图按真实发布日期计数；热榜轨迹按同一平台的原始名次绘制。两者不是全网讨论量，也不将标题情感猜测成舆论结论。首次运行只有一个排名点，历史由后续任务积累；搜索不执行付费调用，也不登录平台。

## TrendRadar

实际运行 [TrendRadar](https://github.com/sansan0/TrendRadar) 的原版 `DataFetcher`，独立 Python 进程获取 NewsNow 公开热榜。上游版本固定为 `86584f5544c66d4e22132f9b87c44a7ea3a32fea`；安装脚本核对文件校验值，并保存上游 GPL-3.0 LICENSE。未改动、未将上游代码打包进前端。不使用可选付费 AI、账号 Cookie 或通知渠道。上游源码及许可证可在该固定提交中查看。

## 自动更新与部署

`.github/workflows/pages.yml` 在 main 推送、手动运行、每小时 17/47 分钟以及北京时间 08:00 运行。免费 GitHub 托管任务读取媒体与热榜，再发布静态网页和公共 JSON。访客无须登录；网页每分钟重新读取数据。GitHub 定时任务可能排队，公开来源也可能失败，因此不承诺秒级实时或精确到分钟的日报发布。当天 08:00 后生成昨日新闻日报，归档保留 90 期。

每次从已发布数据继承最近 30 天文章及原始排名历史；相同平台/URL/上游时间戳去重，缓存内容不会重复制造趋势。原始来源失败时保留先前数据的原始日期。无可用文章或无法读取上一版时停止部署，已有网站继续服务。数据健康状态在公开 JSON 的 sourceHealth 中，访问密钥、数据库和账号状态不发布。

本地：`node scripts/setup-trendradar.mjs`，`python -m pip install requests==2.34.2`，`python scripts/trendradar_bridge.py`，`node scripts/refresh-public-data.mjs`。设置 `VITE_PUBLIC_DATA=true` 后构建，把 `.artifacts/public-data/content-data.json` 放入 dist。

修改设计或逻辑后推送 main 即重新构建；在 Actions 查看 Update CUE website 是否成功。仓库长期无活动时 GitHub 可能暂停定时任务，应检查并重新启用。精选版块保持原分类与原文跳转，晨报保留原栏目及归档。
