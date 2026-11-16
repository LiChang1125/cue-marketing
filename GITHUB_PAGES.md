# GitHub Pages 发布

用户于 2026-11-16 明确批准公开 `LiChang1125/cue-marketing`，并批准先发布现有内容预览版。当前仓库已改为公开；Pages 使用 `gh-pages` 分支的纯静态构建文件，源码仍在 `main`。不上传密钥、数据库、Cookie 或浏览器配置。

## 当前预览版

当前数据由已运行的腾讯云匿名网页接口导出，带有快照时间标识。搜索在该快照内匹配，趋势图使用已有真实观测，日报显示已经生成的内容。预览版不发起新的平台采集、不自动生成后续日报，也不宣称实时更新。实时后台开通后切换到下方实时构建。

```powershell
node scripts/export-preview.mjs
$env:VITE_PREVIEW='true'
node scripts/build-pages.mjs
Remove-Item Env:VITE_PREVIEW
```

输出 `.artifacts/pages-site` 是待发布的网站根目录，包含 `.nojekyll`、预览 JSON 和新闻封面。只将该目录内容提交到 `gh-pages`；不要整体发布 `.artifacts`。Pages 来源设置为 `gh-pages` 分支根目录，站点地址为 `https://lichang1125.github.io/cue-marketing/`。

## 实时服务依赖

Pages 仅提供静态页面，搜索、新闻更新、趋势与北京时间 08:00 日报均由腾讯云后台运行。浏览者无需登录内容平台。后台必须拥有可公开访问的 HTTPS 地址；`127.0.0.1`、SSH 隧道和 HTTP IP 地址不能作为 Pages 后台。

拟使用 `https://cuefankeji.cn`，目前域名尚未购得，实名模板审核中，ICP备案和 HTTPS 未完成。不能将当前构建包宣称为已上线实时网站。

## 构建

在 PowerShell 中运行：

```powershell
$env:VITE_API_ORIGIN='https://cuefankeji.cn'
$env:PAGES_BASE='/cue-marketing/'
node scripts/build-pages.mjs
Remove-Item Env:VITE_API_ORIGIN
Remove-Item Env:PAGES_BASE
```

构建包包含网页、样式、图标、主题封面和 `.nojekyll`，不包含服务端源码、Cookie、API Key、数据库或源代码映射。不得将源码目录、`.env` 或 `.artifacts` 整体上传公开仓库。

腾讯云 `.env` 设置 `PUBLIC_WEB_ORIGINS=https://lichang1125.github.io` 并重建容器；此配置只允许该网页来源读取公开接口和提交主题搜索，不授予维护操作权限。密钥始终只在服务器保存。

实时后台验收通过后，把实时构建包替换到 `gh-pages` 分支根目录，网站地址不变。

## 发布验收

1. 公开 HTTPS 后台的 `/api/health`、`/api/feed` 返回实际数据。
2. Pages 来源对 `/api/topics` 的 POST 预检返回 204，真实搜索正常；维护接口未授权仍拒绝。
3. 在 Pages 页面核对 Logo、封面、日报、筛选、主题搜索和趋势图，确保没有混合内容或跨域错误。
4. 从另一台无平台登录设备访问，间隔两个采集周期确认更新。
5. 后续设计修改需重新构建并更新公开构建仓库；腾讯云逻辑更新仍走原有备份与部署流程。
