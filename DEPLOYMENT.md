# CUE：无需付费 API 的云端部署

已选择腾讯云时，请按 [腾讯云逐步部署指南](TENCENT_DEPLOYMENT.md) 操作，包含购买、备案时长、首次登录、分享验收、备份和日后更新。

推荐用国内云厂商的常驻 Linux 云主机，运行本仓库 Docker Compose。GitHub 保存代码，服务器运行网页、定时任务和浏览器；访客只访问网站，不需要扫码。服务端复用持久化浏览器登录状态，首次登录和平台要求重新验证时仍需管理员处理。

## 选择服务器

建议起步配置：x86_64、2 vCPU、4 GB 内存、60 GB 以上 SSD、Ubuntu 24.04 LTS。这个配置是按当前单浏览器串行采集给出的起点，须在上线后观察内存和磁盘使用，不是并发性能保证。

- 腾讯云 Lighthouse：适合第一次部署单站点，提供中国内地和香港地域。官方价格和购买入口：https://cloud.tencent.com/product/lighthouse ，https://cloud.tencent.com/document/product/1207/73452 。
- 阿里云轻量应用服务器：同样适合部署；若已有阿里云账号可直接选用。https://www.aliyun.com/product/swas 。
- 百度智能云 BCC：如果团队已有百度智能云企业账号、预算或统一运维入口，优先复用。https://cloud.baidu.com/product/bcc.html 。

面向国内同事，优先考虑内地地域，网站域名上线需按云厂商要求完成备案；香港可用于不走大陆备案的部署，但跨境网络质量和平台访问必须另测。不要因为免备案就假定香港采集更稳定，也不要直接购买多年套餐。先按月验证网络、平台登录、持续更新，再决定续费。

工具没有 API 调用费，云主机、域名和备份仍可能产生费用。云厂商不代替内容平台提供采集权限，也不能保证其云 IP 不被限流。

2026-11-16 查阅上述官方页面：腾讯云内地 Linux 入门型 2 核 4GB、60GB SSD、5Mbps、500GB/月为 65 元/月，建议先购买一个月验证。百度 BCC 页面列有首购限量经济型 e1 2 核 4GB、40GB、3Mbps、39 元/年的活动；这是有资格和数量限制的活动价，不是通用续费价，磁盘扩容需另核价。购买前以账号结算页的规格、地域、资格与续费费用为准。

## 接入范围与当前证据

| 路径 | 能做什么 | 限制 |
| --- | --- | --- |
| OpenCLI + 云端 Chromium/CDP | 小红书、抖音、微博、知乎、B站关键词搜索 | 需要服务器浏览器的有效会话；登录失效时停止反复请求并退避 |
| 微博公开 HTTP 热搜 | 免登录获取热榜，5 分钟检查 | 是全站热榜，不是品牌搜索或全网讨论量；没有营销内容时不强行入选 |
| 知乎公开 HTTP 热榜 | 免登录获取问题、回答数、关注数、封面 | 实测曾返回 30 条，后续也出现 403，不承诺持续匿名可用 |
| SocialBeta、品牌星球、B站公开热门 | 后台直接更新新闻 | 按相关性和质量筛选，来源不可用保留旧数据 |

已实测：微博匿名热搜 50 条、知乎匿名热榜 30 条；此轮热榜没有通过营销筛选的条目，未用无关新闻填充首页。现有本地已登录 OpenCLI 采集仍可使用。独立云浏览器模式已在本机验证无需扩展连接，并以测试 Cookie 验证重启持久化；这不代表真实平台会话永不过期。

未验收：用户尚无云主机，当前没有远程部署、没有 Linux Docker 构建运行结果，也没有服务器真实登录会话。不能把 Windows 上的 CDP 检查说成云端全部来源验收通过。

## 部署步骤

1. 将代码推到 GitHub，内部项目可使用私有仓库。不要上传 data、.env、.tools、.artifacts、浏览器配置或 Cookie。本仓库的 .gitignore/.dockerignore 已排除它们。
2. 在云主机安装 Docker Engine 和 Compose 插件，拉取仓库并进入目录。Ubuntu 官方安装步骤：https://docs.docker.com/engine/install/ubuntu/ 。
3. 复制 .env.example 为 .env，为 ADMIN_TOKEN、VNC_PASSWORD 设置独立的随机值。保留文件仅管理员可读；不要粘贴到聊天或提交 GitHub。
4. 运行：

~~~sh
docker compose up -d --build
docker compose ps
docker compose logs --tail=60 cue
~~~

Compose 使用 PLATFORM_PROVIDER=selfhosted，不需要 TikHub Key。cue-data 命名卷保存新闻、日报、图片与 browser-profile；正常重建容器不会丢失。不要执行 docker compose down -v，这会删除持久数据。

## 首次平台登录

采集浏览器运行在服务器上，不把你电脑作为中转。管理员通过 SSH 隧道访问云端浏览器屏幕：

~~~sh
ssh -L 6080:127.0.0.1:6080 -L 4173:127.0.0.1:4173 用户名@服务器地址
~~~

在本机打开 http://127.0.0.1:6080/vnc.html ，输入 VNC_PASSWORD。首次维护前在服务器执行：

~~~sh
docker compose exec cue npm run collector:pause
~~~

等待当前读取结束后，在云端 Chromium 分别打开 xiaohongshu.com、douyin.com、weibo.com、zhihu.com，按平台要求完成登录或验证。登录状态保存在同一个持久卷里，访客不需要重复操作。完成后执行：

~~~sh
docker compose exec cue npm run collector:resume
~~~

失败退避最长 30 分钟；resume 会清除本进程的失败冷却，让下轮重试。平台验证码由管理员手动处理，不自动破解、不循环扫码。服务自动轮询最多 8 个公共主题；多来源串行读取可能排队，不承诺秒级推送。

## 分享网站

默认 4173 和 6080 都仅绑定服务器回环地址；SSH 隧道可供管理员先验收。确认采集正常后，在云主机 Nginx/Caddy 或公司入口将 HTTPS 域名反向代理到 127.0.0.1:4173。配置示例见 deploy/Caddyfile.example。分享 HTTPS 网站地址给同事即可。

不要把 6080 管理屏幕或 9222 浏览器控制端口暴露公网。内部使用字样不是访问认证；可在公司入口加统一认证。维护 API 使用 ADMIN_TOKEN，普通访客不能重置采集。浏览器管理和网站阅读是不同入口。

后台每 5 分钟检查公开来源与微博/知乎热榜；完整平台搜索按队列与退避更新。每日上午北京时间 08:00 自动生成昨日新闻日报，失败重试，重启补生成缺失的当期。必须保持机器与 Node 服务常驻。

## 验收

~~~sh
npm test
npm run build
npm run verify:deployment -- https://你的站点域名
~~~

上线验收脚本现在也检查微博、知乎搜索能力：只有热榜连通不算关键词搜索完成。随后还需：关闭开发电脑观察两个以上采集周期；另一台未登录平台的电脑/手机访问；重启容器验证历史、登录状态与日报保留；实测下一次北京时间 08:00。平台没有有效内容时不能靠放宽到娱乐时政内容来通过验收。

## 其他部署方式

render.yaml 已改为不需要 API Key 的 public 模式，可部署公开新闻和微博/知乎热榜，但不是完整四平台搜索方案。需要完整搜索时使用上述 Linux 云主机方案。付费 TikHub 接口作为可选模块保留，只有主动设置 PLATFORM_PROVIDER=tikhub 并填密钥才会调用，免费方案不会访问它。

## 工具选择依据

- OpenCLI 原生支持远程/无头 CDP，现有已验证适配器可以复用：https://github.com/jackwener/opencli/blob/main/docs/advanced/cdp.md 。
- RSSHub 的微博关键词路由依赖浏览器访客会话/可选 Cookie，知乎热榜也标有反爬，不能保证免登录完整搜索：https://github.com/DIYgod/RSSHub/blob/master/lib/routes/weibo/keyword.ts ，https://github.com/DIYgod/RSSHub/blob/master/lib/routes/zhihu/hot.ts 。
- xiaohongshu-mcp 支持服务器部署，但首次仍需登录；并不能消除会话过期：https://github.com/xpzouying/xiaohongshu-mcp 。
- MediaCrawler 提供登录缓存，但未采用它作为本项目运行依赖；不因更换工具就承诺免验证：https://github.com/NanmiCoder/MediaCrawler 。
