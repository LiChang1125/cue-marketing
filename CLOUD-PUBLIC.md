# 免费公开内容版：腾讯云部署

本入口使用行业媒体公开页面、RSS、研究机构公开摘要及 TrendRadar 原始采集/报告模块。无需平台账号、浏览器桌面、TikHub、付费翻译或管理员电脑保持开机。旧的 compose.yaml 是此前账号采集方案；新部署请用 **compose.free.yaml**。

## 启动

在 Linux 云主机安装 Docker 与 Compose，拉取本仓库后：

```sh
docker compose -f compose.free.yaml up -d --build
curl http://127.0.0.1:4173/api/health
docker compose -f compose.free.yaml logs --tail=100 cue-public
```

如旧版容器占用 4173，请先备份旧数据并停止旧版服务；不删除旧数据卷。沿用已有 Caddy 将 HTTPS 域名反向代理到 `127.0.0.1:4173`。此配置不开放管理桌面或平台账号，也不会自动改变腾讯云防火墙或域名。

## 更新机制

- 启动时加载持久化快照，首次安装才从已发布的 GitHub 网站导入种子数据。
- 服务启动即自动采集。每轮完成后 10 分钟开始下一轮，单轮不会重叠；时间可通过 `COLLECT_INTERVAL_MS` 设置。
- 原始发布日期、逐站采集状态、中文标题摘要和 TrendRadar 报告一同更新；完成验证后原子替换公开 JSON。源站失败时保留上次内容，整轮失败不会清空网站，并自动重试。
- 日报在采集轮次中按北京时间 08:00 检查生成，断线恢复后补生成当天应有日报。它不是毫秒级实时服务：延迟包括源站发布、轮询间隔及采集处理时间。
- 页面自动检查更新，访客无需登录、扫码或手动刷新；网页关闭不影响后台采集。服务器重启后 Docker 自动恢复。
- 报告搜索检索定时扩展的独立报告库；云端可对任意输入主题调用 TrendRadar 原生报告模块生成汇总，并合并重复请求。GitHub 静态版提供同样的搜索筛选，以及十个常用主题的原生 HTML 汇总；不会假称全网搜索，也不将热搜排名解释为全网讨论人数。
- 健康接口 `/api/health` 含 `generatedAt`、`lastSuccess`、`lastError`，用于验收和运维；不展示在网页。

## 修改设计和逻辑后更新

```sh
git pull --ff-only
docker compose -f compose.free.yaml up -d --build
```

公开内容和翻译缓存保存在 Docker 数据卷中，重新构建不会清空。正式迁移前应备份数据卷，并在腾讯云实际测试网络可达性；本地/CI 通过不能代替云主机网络验收。
