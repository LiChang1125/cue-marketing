# 腾讯云购买、上线与更新指南

核对日期：2026-11-16。代码已保存到私有仓库 `LiChang1125/cue-marketing`，GitHub 单元测试、前端构建及 Linux 容器启动检查已通过。腾讯云实例已购买并配置专用 SSH 部署密钥；云端平台登录与持续采集需分别验收，CI 通过不代表平台接入通过。

## 1. 购买配置

打开 https://cloud.tencent.com/product/lighthouse ，登录、完成实名认证，进入购买页，选择「轻量应用服务器」。公司内部长期使用，优先使用公司认可的账号和备案主体。

| 选项 | 本项目建议 |
| --- | --- |
| 地域 | 北京；若使用者主要在华东或华南，选择更接近他们的上海或广州 |
| 镜像 | 系统镜像 → Ubuntu 24.04 LTS，x86_64 / amd64 |
| 套餐 | Linux 入门型，2 核 CPU、4GB 内存、60GB SSD、5Mbps、500GB/月 |
| 数量 | 1 台 |
| 时长 | 正式绑定内地网站域名：3 个月；仅先测试可 1 个月，备案前补足时长 |
| 登录 | SSH 密钥或强密码，记录在密码管理器中 |
| 其他 | 起步不需要另购数据库、GPU、负载均衡或付费采集 API |

官方当前套餐标价 65 元/月；3 个月按标价估算 195 元，实际以结算页为准，不含域名、备份和超额流量。2 核 4GB 是单浏览器串行采集的起步配置，不是性能保证；有更多访问者或内存压力时再升级。

官网价格：https://cloud.tencent.com/document/product/1207/73452

需要修正此前「先买一个月」的适用范围：内地资源申请腾讯云备案，包年包月累计购买时长需至少 3 个月（含续费），备案期间剩余有效期至少 1 个月。只买一个月可先测试，不能直接满足该备案资源条件。中国香港不需要大陆备案，但网络、定价和平台访问成功率要另验；本指南按内地部署展开。

官方备案资源说明：https://cloud.tencent.com/document/product/243/18908

## 2. 获取服务器地址和登录入口

购买后进入 https://console.cloud.tencent.com/lighthouse ，点实例，记录公网 IPv4。用「登录」进入终端，Ubuntu 默认用户通常为 ubuntu，以控制台实际显示为准。首次密码或密钥按控制台指引配置，不需要开启 root 远程登录。

实例「防火墙」中设置：TCP 22 仅允许管理员当前公网 IP；正式分享时开放 TCP 80、443。管理屏幕 6080、应用 4173、浏览器控制 9222 不放通公网。若另外启用了系统防火墙，也需放行相应访问。

官方防火墙说明：https://cloud.tencent.com/document/product/1207/44577

## 3. 把本地项目放到 GitHub

在自己电脑的 GitHub Desktop 中添加现有目录：

`C:\Users\李畅\Documents\ChatGPT\智能营销`

若提示不是 Git 仓库，按界面提示在该目录创建仓库。建议仓库名 cue，默认分支 main。检查待提交文件，提交代码，然后 Publish repository，保留私有仓库选项。

现有 .gitignore 排除了 data、.env、.tools、.artifacts、node_modules 和 dist。不要强制加入这些目录，也不要把平台 Cookie、浏览器配置、私钥或本地数据库上传 GitHub。仓库根目录应能看到 Dockerfile、compose.yaml、package-lock.json、src 和 server。GitHub Actions 中 Verify CUE 应通过。

当前 GitHub 工作流执行测试、前端构建及 Linux 容器启动检查，不会自动发布到腾讯云。GitHub Pages 不负责本项目的定时采集和日报后台。

## 4. 服务器安装 Docker

以下命令在服务器 Ubuntu 终端执行，逐段执行，遇到错误先停下，不跳过。适用于新建的 Ubuntu 24.04 系统镜像。

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git openssl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

添加官方软件源：

```bash
printf '%s\n' 'Types: deb' 'URIs: https://download.docker.com/linux/ubuntu' 'Suites: noble' 'Components: stable' 'Architectures: amd64' 'Signed-By: /etc/apt/keyrings/docker.asc' | sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker compose version
sudo docker run --rm hello-world
```

安装依据：https://docs.docker.com/engine/install/ubuntu/ 。如果 GitHub、Docker Hub 或浏览器下载地址在该地域访问超时，首次构建可能失败；需解决镜像/下载网络后再继续，不能把失败当作成功。

本次实测 Docker 官方软件源连接被重置，使用 Ubuntu 自带的已签名软件源安装成功：`sudo apt-get install -y docker.io docker-compose-v2`。不要同时混装两套 Docker 软件包。

腾讯云内网可使用官方容器镜像加速 `https://mirror.ccs.tencentyun.com`。Debian 安装包下载慢时，在项目 `.env` 增加 `DEBIAN_MIRROR=mirrors.cloud.tencent.com`，随后重新构建；这不会关闭软件包签名校验。镜像源说明：https://cloud.tencent.com/document/product/213/8623 。

Docker 使用 Debian 软件源维护的 Chromium，路径为 `/usr/bin/chromium`，不再额外下载 Playwright 的浏览器压缩包。每次修改镜像或浏览器版本后，仍需检查 CDP 启动和实际平台读取；可启动不代表采集成功。

## 5. 让服务器读取私有仓库

本次部署已通过加密 SSH 上传 Git bundle 并克隆源码，服务器没有保存 GitHub 账号令牌。下面的只读部署密钥是另一种后续更新方式；没有配置时，服务器不能直接 `git pull` 私有仓库，可继续从本机推送 GitHub 后上传 bundle 更新。

在服务器上生成仅供该仓库使用的密钥：

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
ssh-keygen -t ed25519 -C cue-server-readonly -f ~/.ssh/cue_github
cat ~/.ssh/cue_github.pub
```

ssh-keygen 会询问密钥口令，可设置并在每次拉取时输入。若文件已存在，不覆盖原密钥。复制最后显示的公钥，在 GitHub 仓库 Settings → Deploy keys → Add deploy key 中添加，不勾选 Allow write access。不要复制没有 .pub 后缀的私钥文件。

官方部署密钥说明：https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys

用 nano 编辑 `~/.ssh/config`，在末尾增加以下内容，保存退出：

```text
Host cue-github
    HostName github.com
    User git
    IdentityFile ~/.ssh/cue_github
    IdentitiesOnly yes
```

再执行（把 OWNER 换成实际 GitHub 用户名或组织名；仓库不叫 cue 时也要替换）：

```bash
chmod 600 ~/.ssh/config
git clone git@cue-github:OWNER/cue.git ~/cue
cd ~/cue
```

首次 SSH 连接的主机指纹应与 GitHub 官方公布值核对：https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints 。

## 6. 配置并启动网站

只在首次部署、~/cue/.env 不存在时执行下列初始化。它生成管理员密钥与独立 VNC 密码，不需要付费 API Key。

```bash
cd ~/cue
umask 077
if [ -e .env ]; then
  echo '.env 已存在，保留原配置，请勿覆盖。'
else
  printf 'ADMIN_TOKEN=%s\nVNC_PASSWORD=%s\n' "$(openssl rand -hex 32)" "$(openssl rand -hex 4)" > .env
fi
chmod 600 .env
sudo docker compose -p cue up -d --build
sudo docker compose -p cue ps
sudo docker compose -p cue logs --tail=60 cue
curl --fail http://127.0.0.1:4173/api/health
```

最后应返回 ok 为 true，容器稍后显示 healthy。首次构建会下载 Node、依赖和 Chromium，可能较慢。健康检查只代表服务可访问，还不代表每个平台采集成功。所有命令固定使用 `-p cue`，避免以后改目录名意外创建空数据卷。

新闻、日报、图片和登录状态保存到 Docker 命名卷 cue_cue-data。当前方案默认从云端重新积累数据，不会自动把开发电脑的历史新闻搬过去。如需历史迁移，要另做停机数据库/图片备份与导入，不能只上传网页文件。

## 7. 首次登录内容平台

先在服务器暂停浏览器采集，等当前读取结束：

```bash
cd ~/cue
sudo docker compose -p cue exec cue npm run collector:pause
```

然后在自己 Windows 电脑打开一个 PowerShell 窗口，执行下面命令。将 SERVER_IP 替换成服务器公网 IP；如果使用 SSH 密钥，添加 `-i "密钥文件完整路径"`。

```powershell
ssh -o ExitOnForwardFailure=yes -N -L 16080:127.0.0.1:6080 -L 14173:127.0.0.1:4173 ubuntu@SERVER_IP
```

保持该窗口打开。使用本地 14173 端口以避开电脑上正在运行的 4173 开发站点。

- 访问 http://127.0.0.1:16080/vnc.html ，点击连接，输入服务器 .env 中 VNC_PASSWORD 的值（在服务器用 nano 查看，只保存在自己的密码管理器里）。
- 在显示的云端 Chromium 里打开小红书、抖音、微博、知乎，逐个平台完成登录；B站搜索需要登录时也在此处理。
- 访问 http://127.0.0.1:14173 检查网站。平台登录发生在云端，不是电脑自己的浏览器。

登录完成，在服务器终端执行：

```bash
sudo docker compose -p cue exec cue npm run collector:resume
```

等待队列采集，再查看结果。平台要求验证时由管理员处理；不承诺登录永久有效。访客阅读网站无需平台登录。

## 8. 域名和 HTTPS

已有公司域名时可申请一个子域名，例如 cue.公司域名；没有域名则先购买并完成实名认证。中国内地正式提供网站服务前，按腾讯云流程完成所需备案；已有备案也需要核对接入和主体。备案办理入口：https://console.cloud.tencent.com/beian 。测试阶段可以继续通过上述 SSH 隧道使用。

在域名 DNS 控制台添加 A 记录，主机记录 cue，记录值为服务器公网 IPv4。等待解析正确后，在服务器安装 Caddy（以下为首次安装）：

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https gnupg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy
```

安装依据：https://caddyserver.com/docs/install 。用 `sudo nano /etc/caddy/Caddyfile` 将默认配置替换为以下内容，把 cue.example.com 换成自己的真实域名：

```caddyfile
cue.example.com {
    reverse_proxy 127.0.0.1:4173
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
```

域名解析、80/443 端口和证书签发条件满足后，Caddy 自动配置 HTTPS。浏览器打开 `https://你的真实域名` 验证，再分享该地址。只供内部人员时，应使用公司认可的访问认证入口；页面写着「内部使用」本身不限制访问。

## 9. 分享前做持续更新验收

在网站搜索「品牌联名」「香水」等公共主题，让后台完成首轮。随后在服务器执行：

```bash
cd ~/cue
sudo docker compose -p cue exec cue npm run verify:deployment -- http://127.0.0.1:4173
```

此脚本检查新闻、各平台最近成功记录、带图内容、可核实互动数据和日报排程。微博/知乎仅获取热榜不会算关键词搜索通过。失败项逐项解决，不能仅因为网站能打开就宣称全部平台接通。

继续进行以下实际验收：

1. 关闭开发电脑和 SSH 隧道，用另一台未登录内容平台的手机通过域名访问网站。
2. 服务器独立运行至少两个采集周期，观察后台成功记录推进；公开来源约 5 分钟检查，关键词搜索受队列和失败退避影响，不是秒级全量。
3. 执行 `sudo docker compose -p cue restart cue`，确认历史新闻、日报和登录状态保留，随后采集恢复。
4. 观察下一次北京时间 08:00：网页生成昨日新闻日报；无合格新闻或来源异常时应如实显示状态，不能编造一份日报充数。
5. 云主机开启续费提醒/按团队要求自动续费，设置 CPU、内存、磁盘、流量和站点可用性监控。Docker 已配置进程退出自动重启，但平台登录失效仍需要维护。

当前已知限制：知乎匿名请求实测有 403，云 IP 的平台访问能力需要真实验证。没有任何服务器套餐本身能保证平台不限制采集。完成上述验收后才能确认这台机器上的实际可用范围。

## 10. 以后修改网站

可以继续修改布局、Logo、栏目、筛选、趋势图、采集逻辑与日报。正常流程是：本地修改 → 本地测试和构建 → 提交并推送 GitHub → GitHub 检查通过 → 服务器更新。网站域名不变，访客刷新后看到新版本。

本地 PowerShell，在项目目录执行：

```powershell
npm test
npm run build
```

使用 GitHub Desktop 提交、推送。以下更新命令在服务器执行；先按下一节备份数据，再运行：

```bash
cd ~/cue
git rev-parse HEAD
git pull --ff-only
sudo docker compose -p cue build cue
sudo docker compose -p cue up -d --no-deps cue
sudo docker compose -p cue ps
sudo docker compose -p cue exec cue npm run verify:deployment -- http://127.0.0.1:4173
```

记录更新前的提交号以便回退。构建期间旧容器继续服务；更换容器时会有短暂中断，现阶段不是零停机发布。普通更新保留数据卷和登录状态，不需要重买服务器。不要执行 `docker compose down -v` 或删除数据卷。若改数据库结构，需要额外做迁移与回滚设计，不能保证仅回退代码就恢复旧数据格式。

## 11. 更新前备份

下面流程短暂停止应用，打包一致的数据备份后恢复服务。备份包含平台登录信息，应仅管理员可读，不上传 GitHub。服务器上同盘备份只能用于操作回退，还应安全保存一份异地副本。

```bash
cd ~/cue
umask 077
mkdir -p ~/cue-backups
cue_backup="$HOME/cue-backups/cue-$(date +%Y%m%d-%H%M%S).tar.gz"
sudo docker compose -p cue stop cue
sudo docker compose -p cue run --rm --no-deps -T --entrypoint tar cue -czf - -C /var/data/cue . > "$cue_backup"
cue_backup_status=$?
sudo docker compose -p cue start cue
if [ "$cue_backup_status" -eq 0 ]; then
  tar -tzf "$cue_backup" >/dev/null && echo '备份可读取，应用已重新启动。'
else
  echo '备份失败，请勿更新；先检查磁盘、权限和日志。'
fi
```

另外妥善备份 .env 和 Caddyfile。代码回滚需要使用之前记录的提交号重建；数据恢复需要停止应用后恢复同一数据卷，实际发生时按备份文件和故障状态操作，避免覆盖更新后的有效数据。
