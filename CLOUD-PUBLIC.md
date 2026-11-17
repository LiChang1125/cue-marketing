# CUE 私有云端部署

新版使用公开媒体、RSS 和完整 TrendRadar 程序。无需抖音、小红书等平台账号，无需 TikHub 或付费模型。访问者使用 CUE 分配的人员账号登录。

## 账号与启动

先把本机私有的 `.artifacts/accounts/cloud-accounts.json` 安全复制到服务器 `/opt/cue-private/accounts.json`，不要上传 GitHub。文件包含人员名称、登录名和 scrypt 密码校验值，不含明文密码。确保容器的 node 用户能够只读该文件，限制其他系统用户读取。

```sh
export CUE_ACCOUNTS_FILE=/opt/cue-private/accounts.json
docker compose -f compose.free.yaml up -d --build
curl http://127.0.0.1:4173/api/health
docker compose -f compose.free.yaml logs --tail=100 cue-public
```

账号文件缺失时访问控制默认关闭访问，不会自动开放数据。正式服务需沿用 Caddy 等反向代理提供 HTTPS，连接到 `127.0.0.1:4173`。会话 Cookie 为 HttpOnly、Secure、SameSite=Strict；服务端校验账号，限制登录尝试，12 小时到期，退出立即失效。重启后需要重新登录 CUE，但不需要任何社交平台扫码。

旧容器若占用 4173，请先备份并停止旧服务。不要删除旧数据卷。此配置不会修改腾讯云防火墙、DNS 或旧账号采集服务。

## 自动更新

- 服务启动后立即采集；每轮完成后 10 分钟继续，失败保留上次快照并重试。采集不依赖访客操作或管理员电脑。
- 日报按北京时间每日 08:00 到期检查，在采集轮次生成，恢复运行后补生成当天应有日报。更新延迟包括源站、轮询和采集处理时间，不承诺秒级全网实时。
- TrendRadar 使用校验过的完整上游源码，原生采集、SQLite 存储、关键词分析和 HTML 报告运行在独立目录。保留全部默认热榜平台与启用的 RSS，额外补充公开来源，不启用付费 AI 分析、翻译或消息推送。
- 脉动直接嵌入原生报告，保留其标题搜索、来源切换、排名变化与导出。搜索的范围是该轮已取得的热点和订阅信息；它不是无限制搜索引擎，不把热榜排名解释为讨论人数。
- 新闻 JSON、原图、原生报告都受服务端会话保护。页面定期检查更新。健康接口仅返回运行状态，详细采集情况由登录后的 `/api/collector-status` 返回。
- 数据、TrendRadar SQLite 和翻译缓存保存在数据卷中，容器重启自动恢复。

## GitHub Pages 预览

用户已确认 GitHub Pages 仅展示登录交互，不是保密系统。预览账号包使用加密的展示资料，公开源码不列出人员名单或明文密码，但这些前端数据不能作为真正的访问控制。新闻和 TrendRadar 静态报告仍可通过 URL 读取。正式访问限制由上述云端服务提供。

## 更新

```sh
git pull --ff-only
export CUE_ACCOUNTS_FILE=/opt/cue-private/accounts.json
docker compose -f compose.free.yaml up -d --build
```

源码中不包含正式人员账号。修改账号时可用 `node scripts/provision-accounts.mjs 私有名单.json 私有账号.json` 生成密码校验文件；名单字段为 name、username、password。更新服务器账号文件并重启容器即可生效。

正式切换前需在腾讯云验收源站可达性、HTTPS 和持久卷。CI 测试不能代替云主机实际网络验收。
